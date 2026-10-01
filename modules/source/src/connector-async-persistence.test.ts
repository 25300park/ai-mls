import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AsyncDurableConnectorExecutionUnitOfWork } from "./connector-async-persistence.js";

const scope = Object.freeze({
  tenantId: "tenant-r3b4",
  scopeType: "TEAM" as const,
  scopeId: "team-r3b4",
  sourceId: "source-r3b4",
  connectorId: "connector-r3b4",
});

test("R3-B4 SQLite async adapter preserves the canonical Connector execution lifecycle", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-r3b4-sqlite-"));
  const persistence = new AsyncDurableConnectorExecutionUnitOfWork({ databasePath: join(directory, "connector.sqlite") });
  try {
    await persistence.acquireLease({
      ...scope,
      leaseId: "lease-r3b4",
      ownerId: "worker-r3b4",
      acquiredAt: "2026-09-30T00:00:00.000Z",
      expiresAt: "2026-09-30T00:05:00.000Z",
      expectedScopeRevision: 0,
    });
    await persistence.prepareInvocation({
      ...scope,
      invocationId: "invocation-r3b4",
      leaseId: "lease-r3b4",
      idempotencyKey: "test-r3b4-1",
      inputFingerprint: "fingerprint-r3b4",
      inputReference: "input:r3b4",
      inputVersion: 1,
      sourcePolicyVersion: 1,
      connectorVersion: 1,
      expectedCheckpointVersion: 0,
      preparedAt: "2026-09-30T00:00:01.000Z",
    });
    await persistence.markExecutionStarted(scope, "invocation-r3b4", "2026-09-30T00:00:02.000Z");
    const completed = await persistence.completeInvocation({
      ...scope,
      invocationId: "invocation-r3b4",
      resultId: "result-r3b4",
      outcome: "SUCCEEDED",
      reasonCode: "CONFIRMED",
      safeEvidenceReference: "evidence:r3b4",
      checkpointReference: "checkpoint:r3b4",
      completedAt: "2026-09-30T00:00:03.000Z",
    });

    assert.equal(completed.state, "SUCCEEDED");
    assert.equal((await persistence.findCheckpoint(scope))?.version, 1);
    assert.deepEqual((await persistence.listEvidence(scope)).map((item) => item.kind), [
      "INTENT_PREPARED",
      "EXECUTION_STARTED",
      "RESULT_RECORDED",
    ]);
  } finally {
    await persistence.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
