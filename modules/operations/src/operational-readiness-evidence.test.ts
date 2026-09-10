import assert from "node:assert/strict";
import test from "node:test";

import {
  OperationalReadinessEvidenceError,
  deriveOperationalReadiness,
  validateOperationalReadinessEvidence,
  type OperationalReadinessBinding,
  type OperationalReadinessEvidence,
  type OperationalReadinessProjectionRequest,
} from "./operational-readiness-evidence.js";

const hash = (value: string): string => value.repeat(64).slice(0, 64);
const backupRef = `backup-readiness:sha256:${hash("a")}`;
const deploymentRef = `deployment-readiness:sha256:${hash("b")}`;
const rollbackRef = `rollback-readiness:sha256:${hash("c")}`;
const candidateRef = `release-candidate:sha256:${hash("d")}`;
const targetRef = `release-candidate:sha256:${hash("e")}`;
const protectedSetRef = `protected-set:sha256:${hash("f")}`;

function binding(kind: "BACKUP" | "DEPLOYMENT" | "ROLLBACK"): OperationalReadinessBinding {
  return {
    subjectRef: kind === "BACKUP" ? backupRef : kind === "DEPLOYMENT" ? deploymentRef : rollbackRef,
    tenantId: "tenant-a",
    scopeRef: "operations-a",
    candidateRef: kind === "DEPLOYMENT" ? candidateRef : null,
    environmentRef: kind === "DEPLOYMENT" ? "environment:production-001" : null,
    protectedSetRef: kind === "BACKUP" ? protectedSetRef : null,
    rollbackTargetRef: kind === "ROLLBACK" ? targetRef : null,
  };
}

function evidence(
  readinessType: "BACKUP" | "DEPLOYMENT" | "ROLLBACK",
  evidenceType: OperationalReadinessEvidence["evidenceType"],
  overrides: Partial<OperationalReadinessEvidence> = {},
): OperationalReadinessEvidence {
  const sourceByType: Record<string, OperationalReadinessEvidence["sourceClassification"]> = {
    BACKUP_CONFIGURATION: "BACKUP_SYSTEM", BACKUP_EXECUTION: "BACKUP_SYSTEM",
    BACKUP_INTEGRITY: "BACKUP_SYSTEM", RESTORE_VALIDATION: "RECOVERY_VALIDATOR",
    DEPLOYMENT_CHECKLIST: "RELEASE_GOVERNANCE", RELEASE_VERIFICATION: "RELEASE_GOVERNANCE",
    CANDIDATE_VERIFICATION: "BUILD_SYSTEM", ARCHITECTURE_CHECKSUM: "ARCHITECTURE_VALIDATOR",
    DEPENDENCY_AUDIT: "DEPENDENCY_AUDITOR", SECURITY_SCAN: "SECURITY_SCANNER",
    BACKUP_READINESS: "BACKUP_SYSTEM", ROLLBACK_READINESS: "RELEASE_GOVERNANCE",
    MONITORING_READINESS: "OPERATIONS_MONITORING", PRODUCTION_CONFIGURATION: "PRODUCTION_COMPOSITION",
    ROLLBACK_PROCEDURE: "RELEASE_GOVERNANCE", ROLLBACK_TARGET: "RELEASE_GOVERNANCE",
    ROLLBACK_COMPATIBILITY: "RELEASE_GOVERNANCE", ROLLBACK_CHECKLIST: "RELEASE_GOVERNANCE",
    BACKUP_RECOVERY_READINESS: "BACKUP_SYSTEM", POST_ROLLBACK_VALIDATION: "RECOVERY_VALIDATOR",
    F19_RECOVERY_REFERENCE: "F19_RECOVERY",
  };
  return {
    evidenceId: `readiness-evidence:${readinessType.toLowerCase()}-${evidenceType.toLowerCase().replaceAll("_", "-")}-001`,
    readinessType,
    evidenceType,
    sourceClassification: sourceByType[evidenceType],
    binding: binding(readinessType),
    outcome: "SATISFIED",
    occurredAt: "2026-09-10T01:00:00.000Z",
    freshnessThresholdMs: null,
    evidenceRefs: [`evidence:${readinessType.toLowerCase()}-${evidenceType.toLowerCase()}-001`],
    ...overrides,
  } as OperationalReadinessEvidence;
}

function request(
  readinessType: "BACKUP" | "DEPLOYMENT" | "ROLLBACK",
  records: readonly OperationalReadinessEvidence[],
): OperationalReadinessProjectionRequest {
  return {
    readinessProjectionId: `readiness-projection:${readinessType.toLowerCase()}-001`,
    readinessType,
    binding: binding(readinessType),
    evidence: records,
    evaluatedAt: "2026-09-10T01:05:00.000Z",
  };
}

const backupTypes = ["BACKUP_CONFIGURATION", "BACKUP_EXECUTION", "BACKUP_INTEGRITY", "RESTORE_VALIDATION"] as const;
const deploymentTypes = ["DEPLOYMENT_CHECKLIST", "RELEASE_VERIFICATION", "CANDIDATE_VERIFICATION", "ARCHITECTURE_CHECKSUM", "DEPENDENCY_AUDIT", "SECURITY_SCAN", "BACKUP_READINESS", "ROLLBACK_READINESS", "MONITORING_READINESS", "PRODUCTION_CONFIGURATION"] as const;
const rollbackTypes = ["ROLLBACK_PROCEDURE", "ROLLBACK_TARGET", "ROLLBACK_COMPATIBILITY", "ROLLBACK_CHECKLIST", "BACKUP_RECOVERY_READINESS", "POST_ROLLBACK_VALIDATION"] as const;

test("FEAT-023-F keeps backup UNKNOWN when only configuration evidence exists", () => {
  assert.equal(deriveOperationalReadiness(request("BACKUP", [evidence("BACKUP", "BACKUP_CONFIGURATION")])).readiness, "UNKNOWN");
});

test("FEAT-023-F derives READY only from a complete authoritative backup manifest", () => {
  const projection = deriveOperationalReadiness(request("BACKUP", backupTypes.map((type) => evidence("BACKUP", type))));
  assert.equal(projection.readiness, "READY");
  assert.equal(projection.freshness, "UNKNOWN");
  assert.equal(Object.isFrozen(projection), true);
});

test("FEAT-023-F derives deterministic READY for complete deployment and rollback manifests", () => {
  assert.equal(deriveOperationalReadiness(request("DEPLOYMENT", deploymentTypes.map((type) => evidence("DEPLOYMENT", type)))).readiness, "READY");
  assert.equal(deriveOperationalReadiness(request("ROLLBACK", rollbackTypes.map((type) => evidence("ROLLBACK", type)))).readiness, "READY");
});

test("FEAT-023-F ignores historical build evidence bound to another candidate", () => {
  const records = deploymentTypes.map((type) => evidence("DEPLOYMENT", type));
  const wrongCandidate = evidence("DEPLOYMENT", "CANDIDATE_VERIFICATION", {
    binding: { ...binding("DEPLOYMENT"), candidateRef: `release-candidate:sha256:${hash("9")}` },
  });
  const projection = deriveOperationalReadiness(request("DEPLOYMENT", records.map((record) => record.evidenceType === "CANDIDATE_VERIFICATION" ? wrongCandidate : record)));
  assert.equal(projection.readiness, "UNKNOWN");
});

test("FEAT-023-F rejects caller-authored PASS and unknown fields", () => {
  const valid = evidence("BACKUP", "BACKUP_EXECUTION");
  assert.throws(() => validateOperationalReadinessEvidence({ ...valid, outcome: "PASS" }), OperationalReadinessEvidenceError);
  assert.throws(() => validateOperationalReadinessEvidence({ ...valid, ready: true }), OperationalReadinessEvidenceError);
  assert.throws(() => validateOperationalReadinessEvidence({ ...valid, sourceClassification: "RELEASE_GOVERNANCE" }), OperationalReadinessEvidenceError);
  assert.throws(() => validateOperationalReadinessEvidence({
    ...valid,
    binding: { ...valid.binding, protectedSetRef: null, candidateRef: `release-candidate:sha256:${hash("d")}` },
  }), OperationalReadinessEvidenceError);
});

test("FEAT-023-F derives NOT_READY from an explicit authoritative failure", () => {
  const records = backupTypes.map((type) => evidence("BACKUP", type, type === "BACKUP_INTEGRITY" ? { outcome: "BLOCKING" } : {}));
  assert.equal(deriveOperationalReadiness(request("BACKUP", records)).readiness, "NOT_READY");
});

test("FEAT-023-F does not invent staleness without an approved threshold", () => {
  const records = backupTypes.map((type) => evidence("BACKUP", type, { occurredAt: "2020-01-01T00:00:00.000Z" }));
  const projection = deriveOperationalReadiness(request("BACKUP", records));
  assert.equal(projection.readiness, "READY");
  assert.equal(projection.freshness, "UNKNOWN");
});

test("FEAT-023-F makes a stale required gate NOT_READY only with an explicit threshold", () => {
  const records = backupTypes.map((type) => evidence("BACKUP", type, type === "BACKUP_INTEGRITY" ? { freshnessThresholdMs: 60_000 } : {}));
  const projection = deriveOperationalReadiness(request("BACKUP", records));
  assert.equal(projection.readiness, "NOT_READY");
  assert.equal(projection.freshness, "STALE");
});

test("FEAT-023-F propagates explicit DEGRADED only from a complete authoritative manifest", () => {
  const records = rollbackTypes.map((type) => evidence("ROLLBACK", type, type === "ROLLBACK_COMPATIBILITY" ? { outcome: "DEGRADED" } : {}));
  assert.equal(deriveOperationalReadiness(request("ROLLBACK", records)).readiness, "DEGRADED");
});

test("FEAT-023-F does not reinterpret F19 recovery evidence as backup restore success", () => {
  const records = [
    evidence("BACKUP", "BACKUP_CONFIGURATION"), evidence("BACKUP", "BACKUP_EXECUTION"),
    evidence("BACKUP", "BACKUP_INTEGRITY"), evidence("BACKUP", "F19_RECOVERY_REFERENCE"),
  ];
  assert.equal(deriveOperationalReadiness(request("BACKUP", records)).readiness, "UNKNOWN");
});

test("FEAT-023-F pure readiness derivation has no deployment backup or rollback side effect", () => {
  const executions = 0;
  const projection = deriveOperationalReadiness(request("ROLLBACK", rollbackTypes.map((type) => evidence("ROLLBACK", type))));
  assert.equal(projection.readiness, "READY");
  assert.equal(executions, 0);
});
