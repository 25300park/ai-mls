import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProductionPublicationInfrastructure, createPublicationInfrastructure } from "./publication-infrastructure.js";
import type { PublicationConnectorDispatcher, PublicationConnectorDispatchInput, PublicationConnectorOutcome } from "./publication-service.js";

const input: PublicationConnectorDispatchInput = Object.freeze({
  publicationId: "publication-e", tenantScopeId: "tenant-e", commandId: "command-e", attemptId: "attempt-e",
  targetId: "target-e", targetVersion: 1, channelId: "channel-e", channelPolicyVersion: "policy-e-v1",
  representationId: "representation-e", representationVersion: 1, representationChecksum: "sha256:representation-e",
  approvalDecisionReference: "approval-decision-e", providerIdempotencyKey: "publication:tenant-e:publication-e:command-e:attempt-e",
});

async function createAdapter(outcome: PublicationConnectorOutcome): Promise<PublicationConnectorDispatcher> {
  const publicationModule = await import("./index.js") as Readonly<Record<string, unknown>>;
  assert.equal(typeof publicationModule["DeterministicPublicationConnectorTestAdapter"], "function");
  const Adapter = publicationModule["DeterministicPublicationConnectorTestAdapter"] as new (outcome: PublicationConnectorOutcome) => PublicationConnectorDispatcher;
  return new Adapter(outcome);
}

test("F17-E deterministic adapter emits stable immutable normalized outcomes across calls and instances", async () => {
  for (const outcome of ["CONFIRMED", "REJECTED", "UNKNOWN"] as const) {
    const adapter = await createAdapter(outcome);
    const first = adapter.dispatch(input);
    assert.equal(first.outcome, outcome);
    assert.deepEqual(adapter.dispatch(input), first);
    assert.deepEqual((await createAdapter(outcome)).dispatch(input), first);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.evidenceRefs), true);
    assert.match(first.evidenceRefs[0] ?? "", /^test-provider:[a-f0-9]{64}:(confirmed|rejected|unknown)$/u);
    if (outcome === "CONFIRMED") assert.match(first.externalObjectReference ?? "", /^test-external:[a-f0-9]{64}$/u);
    else assert.equal(first.externalObjectReference, undefined);
    assert.deepEqual(Object.keys(first).sort(), outcome === "CONFIRMED" ? ["evidenceRefs", "externalObjectReference", "outcome"] : ["evidenceRefs", "outcome"]);
  }
});

test("F17-E deterministic adapter contains conflicting provider idempotency without overwriting prior observation", async () => {
  const adapter = await createAdapter("CONFIRMED");
  const first = adapter.dispatch(input);
  const changedBinding = adapter.dispatch({ ...input, targetId: "different-target" });
  const changedKey = adapter.dispatch({ ...input, providerIdempotencyKey: "different-key" });
  for (const result of [changedBinding, changedKey]) {
    assert.equal(result.outcome, "UNKNOWN");
    assert.equal(result.externalObjectReference, undefined);
    assert.match(result.evidenceRefs[0] ?? "", /^test-provider:[a-f0-9]{64}:idempotency-conflict$/u);
  }
  assert.deepEqual(adapter.dispatch(input), first);
});

test("F17-E deterministic adapter is explicitly injected into test composition and rejected by production", async () => {
  const adapter = await createAdapter("CONFIRMED");
  const testGraph = createPublicationInfrastructure({ connectorDispatcher: adapter });
  assert.equal(testGraph.connectorDispatcher.dispatch(input).outcome, "CONFIRMED");
  assert.throws(() => createPublicationInfrastructure().connectorDispatcher.dispatch(input), /connector is unavailable/u);
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f17-e-isolation-"));
  try {
    assert.throws(() => createProductionPublicationInfrastructure({
      databasePath: join(directory, "publication.sqlite"), configuration: { connectorDispatcher: adapter },
    }), /connector configuration is not approved/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F17-E deterministic adapter does not reflect arbitrary extra provider input into evidence", async () => {
  const adapter = await createAdapter("CONFIRMED");
  const first = adapter.dispatch(input);
  const extraInput = { ...input, rawPayload: "NON_SECRET_RAW_PROVIDER_FIXTURE", destination: "https://invalid.example", authorization: "NON_SECRET_HEADER_FIXTURE" };
  assert.deepEqual(adapter.dispatch(extraInput), first);
  assert.equal(JSON.stringify(first).includes("NON_SECRET"), false);
});
