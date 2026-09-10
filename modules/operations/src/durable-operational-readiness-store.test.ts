import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { DurableOperationalEvidenceStore } from "./durable-operational-evidence-store.js";
import { createTestOperationalReadinessEvidenceAdmission } from "./operational-readiness-test-support.js";
import {
  OperationalReadinessEvidenceError,
  type OperationalReadinessBinding,
  type OperationalReadinessEvidence,
  type OperationalReadinessEvidenceType,
  type OperationalReadinessProjection,
  type OperationalReadinessSourceClassification,
} from "./operational-readiness-evidence.js";

interface ReadinessStore {
  appendReadinessEvidence(record: OperationalReadinessEvidence): OperationalReadinessEvidence;
  projectReadiness(request: Readonly<{
    readinessProjectionId: string;
    readinessType: "BACKUP" | "DEPLOYMENT" | "ROLLBACK";
    binding: OperationalReadinessBinding;
    evidenceIds: readonly string[];
    evaluatedAt: string;
  }>): OperationalReadinessProjection;
  listReadinessScoped(binding: Readonly<{ tenantId: string; scopeRef: string }>): readonly OperationalReadinessProjection[];
}

const resourceRef = `backup-readiness:sha256:${"a".repeat(64)}`;
const readinessBinding: OperationalReadinessBinding = {
  subjectRef: resourceRef, tenantId: "tenant-a", scopeRef: "operations-a",
  candidateRef: null, environmentRef: null,
  protectedSetRef: `protected-set:sha256:${"b".repeat(64)}`, rollbackTargetRef: null,
};
const types = ["BACKUP_CONFIGURATION", "BACKUP_EXECUTION", "BACKUP_INTEGRITY", "RESTORE_VALIDATION"] as const;
const sources: Record<OperationalReadinessEvidenceType, OperationalReadinessSourceClassification> = {
  BACKUP_CONFIGURATION: "BACKUP_SYSTEM", BACKUP_EXECUTION: "BACKUP_SYSTEM", BACKUP_INTEGRITY: "BACKUP_SYSTEM",
  RESTORE_VALIDATION: "RECOVERY_VALIDATOR", DEPLOYMENT_CHECKLIST: "RELEASE_GOVERNANCE",
  RELEASE_VERIFICATION: "RELEASE_GOVERNANCE", CANDIDATE_VERIFICATION: "BUILD_SYSTEM",
  ARCHITECTURE_CHECKSUM: "ARCHITECTURE_VALIDATOR", DEPENDENCY_AUDIT: "DEPENDENCY_AUDITOR", SECURITY_SCAN: "SECURITY_SCANNER",
  BACKUP_READINESS: "BACKUP_SYSTEM", ROLLBACK_READINESS: "RELEASE_GOVERNANCE", MONITORING_READINESS: "OPERATIONS_MONITORING",
  PRODUCTION_CONFIGURATION: "PRODUCTION_COMPOSITION", ROLLBACK_PROCEDURE: "RELEASE_GOVERNANCE",
  ROLLBACK_TARGET: "RELEASE_GOVERNANCE", ROLLBACK_COMPATIBILITY: "RELEASE_GOVERNANCE",
  ROLLBACK_CHECKLIST: "RELEASE_GOVERNANCE", BACKUP_RECOVERY_READINESS: "BACKUP_SYSTEM",
  POST_ROLLBACK_VALIDATION: "RECOVERY_VALIDATOR", F19_RECOVERY_REFERENCE: "F19_RECOVERY",
};

function record(type: OperationalReadinessEvidenceType, overrides: Partial<OperationalReadinessEvidence> = {}): OperationalReadinessEvidence {
  return {
    evidenceId: `readiness-evidence:backup-${type.toLowerCase().replaceAll("_", "-")}-001`,
    readinessType: "BACKUP", evidenceType: type, sourceClassification: sources[type], binding: readinessBinding,
    outcome: "SATISFIED", occurredAt: "2026-09-10T01:00:00.000Z", freshnessThresholdMs: null,
    evidenceRefs: [`evidence:backup-${type.toLowerCase()}-001`], ...overrides,
  };
}

function withDatabase(run: (databasePath: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "feat-023-f-"));
  let primaryFailure: unknown;
  try { run(join(directory, "operations.sqlite")); } catch (error) { primaryFailure = error; }
  try { rmSync(directory, { recursive: true, force: true }); } catch (cleanupFailure) {
    if (primaryFailure === undefined) primaryFailure = cleanupFailure;
  }
  if (primaryFailure instanceof Error) throw primaryFailure;
  if (primaryFailure !== undefined) throw new Error("Non-Error test failure", { cause: primaryFailure });
}

test("FEAT-023-F readiness evidence and projection survive restart in the existing operational store", () => withDatabase((databasePath) => {
  let store = new DurableOperationalEvidenceStore({ databasePath }, createTestOperationalReadinessEvidenceAdmission()) as DurableOperationalEvidenceStore & ReadinessStore;
  const records = types.map((type) => store.appendReadinessEvidence(record(type)));
  const projection = store.projectReadiness({
    readinessProjectionId: "readiness-projection:backup-001", readinessType: "BACKUP", binding: readinessBinding,
    evidenceIds: records.map(({ evidenceId }) => evidenceId), evaluatedAt: "2026-09-10T01:05:00.000Z",
  });
  assert.equal(projection.readiness, "READY");
  store.close();

  store = new DurableOperationalEvidenceStore({ databasePath }, createTestOperationalReadinessEvidenceAdmission());
  assert.deepEqual(store.listReadinessScoped({ tenantId: "tenant-a", scopeRef: "operations-a" }), [projection]);
  assert.equal(store.listReadinessScoped({ tenantId: "tenant-b", scopeRef: "operations-a" }).length, 0);
  assert.equal(store.listReadinessScoped({ tenantId: "tenant-a", scopeRef: "operations-b" }).length, 0);
  store.close();
}));

test("FEAT-023-F durable readiness identities are immutable and evidence tables are append-only", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath }, createTestOperationalReadinessEvidenceAdmission()) as DurableOperationalEvidenceStore & ReadinessStore;
  store.appendReadinessEvidence(record("BACKUP_CONFIGURATION"));
  assert.throws(() => store.appendReadinessEvidence(record("BACKUP_CONFIGURATION", { outcome: "BLOCKING" })), OperationalReadinessEvidenceError);
  for (const type of types.slice(1)) store.appendReadinessEvidence(record(type));
  store.projectReadiness({ readinessProjectionId: "readiness-projection:backup-001", readinessType: "BACKUP", binding: readinessBinding,
    evidenceIds: types.map((type) => record(type).evidenceId), evaluatedAt: "2026-09-10T01:05:00.000Z" });
  assert.throws(() => store.projectReadiness({ readinessProjectionId: "readiness-projection:backup-001", readinessType: "BACKUP", binding: readinessBinding,
    evidenceIds: types.map((type) => record(type).evidenceId), evaluatedAt: "2026-09-10T01:06:00.000Z" }), OperationalReadinessEvidenceError);
  store.close();

  const raw = new DatabaseSync(databasePath);
  assert.throws(() => raw.exec("UPDATE operational_readiness_evidence SET payload_json = '{}'"), /append-only/iu);
  assert.throws(() => raw.exec("DELETE FROM operational_readiness_projection"), /append-only/iu);
  raw.close();
}));

test("FEAT-023-F rejects missing durable evidence and unsafe evidence references", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath }, createTestOperationalReadinessEvidenceAdmission()) as DurableOperationalEvidenceStore & ReadinessStore;
  assert.throws(() => store.appendReadinessEvidence(record("BACKUP_EXECUTION", { evidenceRefs: ["evidence:token-secret-001"] })), OperationalReadinessEvidenceError);
  assert.throws(() => store.projectReadiness({ readinessProjectionId: "readiness-projection:backup-001", readinessType: "BACKUP", binding: readinessBinding,
    evidenceIds: [record("BACKUP_EXECUTION").evidenceId], evaluatedAt: "2026-09-10T01:05:00.000Z" }), OperationalReadinessEvidenceError);
  store.close();
}));

test("FEAT-023-F emits a HIGH backup alert only from a durable NOT_READY projection", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath }, createTestOperationalReadinessEvidenceAdmission()) as DurableOperationalEvidenceStore & ReadinessStore;
  const blocking = types.map((type) => store.appendReadinessEvidence(record(type, type === "BACKUP_INTEGRITY" ? {
    evidenceId: "readiness-evidence:backup-integrity-blocking-002", outcome: "BLOCKING",
  } : { evidenceId: `readiness-evidence:backup-${type.toLowerCase().replaceAll("_", "-")}-002` })));
  store.projectReadiness({ readinessProjectionId: "readiness-projection:backup-not-ready-002", readinessType: "BACKUP", binding: readinessBinding,
    evidenceIds: blocking.map(({ evidenceId }) => evidenceId), evaluatedAt: "2026-09-10T01:05:00.000Z" });
  const [alert] = store.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "operations-a" });
  assert.equal(alert?.alertType, "BACKUP_READINESS_FAILURE");
  assert.equal(alert?.severity, "HIGH");
  assert.equal(alert?.currentState, "ACTIVE");

  const satisfied = types.map((type) => store.appendReadinessEvidence(record(type, {
    evidenceId: `readiness-evidence:backup-${type.toLowerCase().replaceAll("_", "-")}-ready-003`,
  })));
  store.projectReadiness({ readinessProjectionId: "readiness-projection:backup-ready-003", readinessType: "BACKUP", binding: readinessBinding,
    evidenceIds: satisfied.map(({ evidenceId }) => evidenceId), evaluatedAt: "2026-09-10T01:06:00.000Z" });
  const [cleared] = store.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "operations-a" });
  assert.equal(cleared?.alertType, "BACKUP_READINESS_FAILURE");
  assert.equal(cleared?.currentState, "CLEARED");
  store.close();
}));

test("FEAT-023-F persists an evidence-free UNKNOWN initial projection without a failure alert", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath }, createTestOperationalReadinessEvidenceAdmission()) as DurableOperationalEvidenceStore & ReadinessStore;
  const projection = store.projectReadiness({ readinessProjectionId: "readiness-projection:backup-unknown-003", readinessType: "BACKUP",
    binding: readinessBinding, evidenceIds: [], evaluatedAt: "2026-09-10T01:05:00.000Z" });
  assert.equal(projection.readiness, "UNKNOWN");
  assert.equal(projection.evidenceRefs.length, 0);
  assert.equal(store.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "operations-a" }).length, 0);
  store.close();
}));
