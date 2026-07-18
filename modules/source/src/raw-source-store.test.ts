import assert from "node:assert/strict";
import test from "node:test";

import { RawSourceStore } from "./raw-source-store.js";
import {
  activePolicy,
  sourceFixture,
  sourceSession,
} from "./source-test-fixture.js";

function captureRequest(
  overrides: Partial<Parameters<RawSourceStore["capture"]>[0]> = {},
): Parameters<RawSourceStore["capture"]>[0] {
  return {
    actor: sourceSession("user-collector-1", "COL"),
    sourceId: activePolicy.id,
    sourcePolicyVersion: activePolicy.policyVersion,
    method: "MANUAL_REFERENCE",
    purpose: "SOURCE_INTAKE",
    evidenceReference: "evidence-object-1",
    observedAt: "2026-07-18T23:50:00.000Z",
    capturedAt: "2026-07-19T00:05:00.000Z",
    fingerprint: "sha256-fixture-evidence-1",
    language: "en",
    classification: "CONFIDENTIAL_BUSINESS",
    retentionClass: "SOURCE_BOUNDED",
    correlationId: "correlation-raw-capture",
    ...overrides,
  };
}

test("TEST-014 captures immutable source evidence without raw content", () => {
  const { service, auditLog } = sourceFixture();
  let sequence = 0;
  const store = new RawSourceStore({
    sourceRegistryService: service,
    auditSink: auditLog,
    clock: () => new Date("2026-07-19T00:05:00.000Z"),
    idFactory: () => `raw-source-${String(++sequence)}`,
    policyVersion: "raw-source-v1",
  });
  const raw = store.capture({
    ...captureRequest(),
    rawContent: "synthetic content that must not persist",
  } as Parameters<RawSourceStore["capture"]>[0] & { rawContent: string });

  assert.equal(raw.status, "ACCEPTED");
  assert.equal(raw.evidenceReference, "evidence-object-1");
  assert.equal(Object.isFrozen(raw), true);
  assert.equal(JSON.stringify(raw).includes("synthetic content"), false);
});

test("TEST-027 rejects stale policy versions and disallowed methods", () => {
  const { service, auditLog } = sourceFixture();
  const store = new RawSourceStore({
    sourceRegistryService: service,
    auditSink: auditLog,
    clock: () => new Date("2026-07-19T00:05:00.000Z"),
    idFactory: () => "raw-source-1",
    policyVersion: "raw-source-v1",
  });

  assert.throws(
    () => store.capture(captureRequest({ sourcePolicyVersion: 2 })),
    /SOURCE_POLICY_STALE/,
  );
  assert.throws(
    () => store.capture(captureRequest({ method: "AUTONOMOUS_SCRAPE" })),
    /SOURCE_NOT_ALLOWED/,
  );
});

test("TEST-036 permits bounded service capture but blocks inactive policy", () => {
  const blocked = { ...activePolicy, status: "BLOCKED" as const };
  const { service, auditLog } = sourceFixture([blocked]);
  const store = new RawSourceStore({
    sourceRegistryService: service,
    auditSink: auditLog,
    clock: () => new Date("2026-07-19T00:05:00.000Z"),
    idFactory: () => "raw-source-1",
    policyVersion: "raw-source-v1",
  });

  assert.throws(
    () =>
      store.capture(captureRequest({
        actor: sourceSession("service-collector-1", "SVC", "SERVICE"),
      })),
    /SOURCE_NOT_ALLOWED/,
  );
});
