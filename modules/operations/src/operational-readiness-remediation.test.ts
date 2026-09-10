import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DurableOperationalEvidenceStore,
  createProductionOperationalEvidenceStore,
} from "./durable-operational-evidence-store.js";
import {
  OperationalReadinessEvidenceError,
  type OperationalReadinessBinding,
  type OperationalReadinessEvidence,
  type OperationalReadinessEvidenceType,
  type OperationalReadinessSourceClassification,
  type OperationalReadinessType,
} from "./operational-readiness-evidence.js";
import { createTestOperationalReadinessEvidenceAdmission } from "./operational-readiness-test-support.js";

const sourceByType: Readonly<Record<OperationalReadinessEvidenceType, OperationalReadinessSourceClassification>> = {
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
const required: Readonly<Record<OperationalReadinessType, readonly OperationalReadinessEvidenceType[]>> = {
  BACKUP: ["BACKUP_CONFIGURATION", "BACKUP_EXECUTION", "BACKUP_INTEGRITY", "RESTORE_VALIDATION"],
  DEPLOYMENT: ["DEPLOYMENT_CHECKLIST", "RELEASE_VERIFICATION", "CANDIDATE_VERIFICATION", "ARCHITECTURE_CHECKSUM", "DEPENDENCY_AUDIT", "SECURITY_SCAN", "BACKUP_READINESS", "ROLLBACK_READINESS", "MONITORING_READINESS", "PRODUCTION_CONFIGURATION"],
  ROLLBACK: ["ROLLBACK_PROCEDURE", "ROLLBACK_TARGET", "ROLLBACK_COMPATIBILITY", "ROLLBACK_CHECKLIST", "BACKUP_RECOVERY_READINESS", "POST_ROLLBACK_VALIDATION"],
};

function hash(character: string): string { return character.repeat(64); }
function binding(type: OperationalReadinessType, discriminator: string): OperationalReadinessBinding {
  return {
    subjectRef: `${type.toLowerCase()}-readiness:sha256:${hash("a")}`,
    tenantId: "tenant-a", scopeRef: "operations-a",
    candidateRef: type === "DEPLOYMENT" ? `release-candidate:sha256:${hash(discriminator)}` : null,
    environmentRef: type === "DEPLOYMENT" ? `environment:sha256:${hash(discriminator === "b" ? "c" : "d")}` : null,
    protectedSetRef: type === "BACKUP" ? `protected-set:sha256:${hash(discriminator)}` : null,
    rollbackTargetRef: type === "ROLLBACK" ? `release-candidate:sha256:${hash(discriminator)}` : null,
  };
}
function evidence(type: OperationalReadinessType, evidenceType: OperationalReadinessEvidenceType, target: OperationalReadinessBinding, suffix: string, overrides: Partial<OperationalReadinessEvidence> = {}): OperationalReadinessEvidence {
  return {
    evidenceId: `readiness-evidence:${type.toLowerCase()}-${evidenceType.toLowerCase().replaceAll("_", "-")}-${suffix}`,
    readinessType: type, evidenceType, sourceClassification: sourceByType[evidenceType], binding: target,
    outcome: "SATISFIED", occurredAt: "2026-09-10T01:00:00.000Z", freshnessThresholdMs: null,
    evidenceRefs: [`evidence:${type.toLowerCase()}-${evidenceType.toLowerCase()}-${suffix}`], ...overrides,
  };
}
function withDatabase(run: (databasePath: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "feat-023-f-remediation-"));
  let primaryFailure: unknown;
  try { run(join(directory, "operations.sqlite")); } catch (error) { primaryFailure = error; }
  try { rmSync(directory, { recursive: true, force: true }); } catch (cleanupFailure) {
    if (primaryFailure === undefined) primaryFailure = cleanupFailure;
  }
  if (primaryFailure instanceof Error) throw primaryFailure;
  if (primaryFailure !== undefined) throw new Error("Non-Error test failure", { cause: primaryFailure });
}

test("FEAT-023-F rejects caller-manufactured SATISFIED evidence and freshness thresholds without admission", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath });
  const target = binding("BACKUP", "b");
  assert.throws(() => store.appendReadinessEvidence(evidence("BACKUP", "BACKUP_EXECUTION", target, "direct-001")), OperationalReadinessEvidenceError);
  assert.throws(() => store.appendReadinessEvidence(evidence("BACKUP", "BACKUP_EXECUTION", target, "threshold-001", { freshnessThresholdMs: 60_000 })), OperationalReadinessEvidenceError);
  store.close();
}));

test("FEAT-023-F production composition rejects test admission injection and exposes no evidence writer", () => withDatabase((databasePath) => {
  assert.throws(() => createProductionOperationalEvidenceStore({ databasePath, readinessEvidenceAdmission: { resolve: () => undefined } } as never));
  const production = createProductionOperationalEvidenceStore({ databasePath });
  assert.equal(Object.hasOwn(production, "appendReadinessEvidence"), false);
  assert.equal(Object.hasOwn(production, "projectReadiness"), false);
  production.close();
}));

test("FEAT-023-F keeps same resource projections distinct across candidate and environment bindings", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath }, createTestOperationalReadinessEvidenceAdmission());
  const first = binding("DEPLOYMENT", "b");
  const secondCandidate = { ...binding("DEPLOYMENT", "c"), environmentRef: first.environmentRef };
  const secondEnvironment = { ...binding("DEPLOYMENT", "b"), environmentRef: `environment:sha256:${hash("e")}` };
  for (const [target, suffix] of [[first, "candidate-a-001"], [secondCandidate, "candidate-b-002"], [secondEnvironment, "environment-b-003"]] as const) {
    const records = required.DEPLOYMENT.map((type) => store.appendReadinessEvidence(evidence("DEPLOYMENT", type, target, suffix)));
    store.projectReadiness({ readinessProjectionId: `readiness-projection:deployment-${suffix}`, readinessType: "DEPLOYMENT", binding: target,
      evidenceIds: records.map(({ evidenceId }) => evidenceId), evaluatedAt: "2026-09-10T01:05:00.000Z" });
  }
  assert.equal(store.listReadinessScoped({ tenantId: "tenant-a", scopeRef: "operations-a" }).length, 3);
  store.close();
}));

test("FEAT-023-F keeps different rollback targets distinct", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath }, createTestOperationalReadinessEvidenceAdmission());
  for (const [target, suffix] of [[binding("ROLLBACK", "b"), "target-a-001"], [binding("ROLLBACK", "c"), "target-b-002"]] as const) {
    const records = required.ROLLBACK.map((type) => store.appendReadinessEvidence(evidence("ROLLBACK", type, target, suffix)));
    store.projectReadiness({ readinessProjectionId: `readiness-projection:rollback-${suffix}`, readinessType: "ROLLBACK", binding: target,
      evidenceIds: records.map(({ evidenceId }) => evidenceId), evaluatedAt: "2026-09-10T01:05:00.000Z" });
  }
  assert.equal(store.listReadinessScoped({ tenantId: "tenant-a", scopeRef: "operations-a" }).length, 2);
  store.close();
}));

test("FEAT-023-F has no public unscoped readiness lookup", () => {
  assert.equal(Object.hasOwn(DurableOperationalEvidenceStore.prototype, "findReadiness"), false);
});

test("FEAT-023-F alert identities do not collide across candidates or environments", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath }, createTestOperationalReadinessEvidenceAdmission());
  const targets = [binding("DEPLOYMENT", "b"), binding("DEPLOYMENT", "c"), { ...binding("DEPLOYMENT", "b"), environmentRef: `environment:sha256:${hash("e")}` }];
  targets.forEach((target, index) => {
    const suffix = `blocked-${index + 1}`;
    const records = required.DEPLOYMENT.map((type) => store.appendReadinessEvidence(evidence("DEPLOYMENT", type, target, suffix,
      type === "DEPENDENCY_AUDIT" ? { outcome: "BLOCKING" } : {})));
    store.projectReadiness({ readinessProjectionId: `readiness-projection:deployment-${suffix}`, readinessType: "DEPLOYMENT", binding: target,
      evidenceIds: records.map(({ evidenceId }) => evidenceId), evaluatedAt: `2026-09-10T01:0${index + 5}:00.000Z` });
  });
  const alerts = store.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "operations-a" }, { currentState: "ACTIVE" });
  assert.equal(alerts.length, 3);
  assert.equal(new Set(alerts.map(({ alertId }) => alertId)).size, 3);
  store.close();
}));
