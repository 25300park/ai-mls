import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { DurableAdvisoryStore } from "./advisory-durable-persistence.js";
import { createProductionAdvisoryRuntime } from "./advisory-production-composition.js";
import type { AdvisoryExecutionRequest, AdvisoryPromptRecord, TrustedAdvisorySnapshot } from "./advisory-runtime-contracts.js";

const subject = Object.freeze({ entityType: "RawSource", entityId: "raw-production", version: "1" });
const snapshot = Object.freeze<TrustedAdvisorySnapshot>({ tenantId: "tenant-a", scopeRef: "team:team-a", subjectRef: subject, provenance: [subject], inputClassifications: ["INTERNAL"], inputFingerprint: "sha256:prod-input", evidenceFingerprint: "sha256:prod-evidence" });
const prompt = Object.freeze<AdvisoryPromptRecord>({ promptId: "PRM-AI-001-PROD", promptVersion: "v1.0", capabilityId: "AI-001", schemaId: "urn:ai-mls:schema:listing-parser-output:v0.1", contentFingerprint: "sha256:prod-prompt", status: "ACTIVE", createdAt: "2026-09-09T02:00:00.000Z" });
const request = Object.freeze<AdvisoryExecutionRequest>({ tenantId: snapshot.tenantId, scopeRef: snapshot.scopeRef, capabilityId: "AI-001", schemaId: prompt.schemaId, inputReference: subject, promptId: prompt.promptId, promptVersion: prompt.promptVersion, idempotencyKey: "idem-production" });

function expectCode(run: () => unknown, code: string): void { assert.throws(run, (error: unknown) => error instanceof Error && "code" in error && error.code === code); }

test("FEAT-022-C production requires durable configuration and rejects adapter injection", () => {
  assert.throws(() => createProductionAdvisoryRuntime({ databasePath: "", snapshotResolver: { resolve: () => snapshot } }), /configuration is invalid/u);
  const directory = mkdtempSync(join(tmpdir(), "feat-022-c-prod-options-"));
  try {
    assert.throws(() => createProductionAdvisoryRuntime({ databasePath: join(directory, "advisory.sqlite"), snapshotResolver: { resolve: () => snapshot }, adapter: { adapterVersion: "arbitrary", generate: () => ({}) } } as never), /configuration is invalid/u);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("FEAT-022-C production is unavailable and persists no advisory", () => {
  const directory = mkdtempSync(join(tmpdir(), "feat-022-c-prod-unavailable-"));
  const databasePath = join(directory, "advisory.sqlite");
  const seed = new DurableAdvisoryStore({ databasePath }); seed.registerPrompt(prompt); seed.close();
  const graph = createProductionAdvisoryRuntime({ databasePath, snapshotResolver: { resolve: () => snapshot } });
  try {
    expectCode(() => graph.runtime.execute(request), "ADVISORY_UNAVAILABLE");
  } finally { graph.close(); }
  const verify = new DurableAdvisoryStore({ databasePath });
  try { assert.equal(verify.findReplay(snapshot.tenantId, snapshot.scopeRef, request.idempotencyKey, "irrelevant"), undefined); }
  finally { verify.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("FEAT-022-C production composition imports no API UI network or domain command path", () => {
  const source = readFileSync(new URL("./advisory-production-composition.js", import.meta.url), "utf8");
  for (const forbidden of ["node:http", "apps/", "modules/domain", "fetch(", "axios", "provider-sdk"]) assert.equal(source.includes(forbidden), false, forbidden);
});
