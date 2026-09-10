import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import { AuthorizationService, type LiveRoleAssignment } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import { DurableOperationalEvidenceStore } from "./durable-operational-evidence-store.js";
import { createTestOperationalReadinessEvidenceAdmission } from "./operational-readiness-test-support.js";
import type { OperationalAlertProjection } from "./operational-alert-projection.js";
import type { OperationalTelemetryRecord } from "./operational-telemetry-contracts.js";
import type { OperationalStatusSnapshot } from "./operational-status-projection.js";
import type { OperationalReadinessProjection } from "./operational-readiness-evidence.js";

interface SecurityAccessRequest {
  readonly session: SessionContext;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly resourceRef: string;
  readonly correlationId: string;
}

interface SecurityReadinessRequest extends SecurityAccessRequest {
  readonly telemetryEventId: string;
  readonly statusSnapshotId: string;
  readonly health: "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";
  readonly readiness: "READY" | "NOT_READY" | "DEGRADED" | "UNKNOWN";
  readonly evaluatedAt: string;
  readonly freshnessThresholdMs: number | null;
  readonly reason: string;
}

interface Controls {
  readEvidence(request: SecurityAccessRequest): readonly OperationalTelemetryRecord[];
  readAlerts(request: Omit<SecurityAccessRequest, "resourceRef">): readonly OperationalAlertProjection[];
  readReadiness(request: Omit<SecurityAccessRequest, "resourceRef">): readonly OperationalReadinessProjection[];
  projectSecurityReadiness(request: SecurityReadinessRequest): OperationalStatusSnapshot | undefined;
}

type ControlsConstructor = new (dependencies: Readonly<{
  authorizationService: AuthorizationService;
  evidenceStore: DurableOperationalEvidenceStore;
}>) => Controls;

async function controlsConstructor(): Promise<ControlsConstructor | undefined> {
  const path = `./security-privacy-operational-controls${""}.js`;
  try {
    const loaded = await import(path) as Readonly<Record<string, unknown>>;
    return loaded["SecurityPrivacyOperationalControlService"] as ControlsConstructor | undefined;
  } catch { return undefined; }
}

const securityRef = `security-event:sha256:${"c".repeat(64)}`;

function telemetry(overrides: Partial<OperationalTelemetryRecord> = {}): OperationalTelemetryRecord {
  return {
    telemetryEventId: "telemetry:security-001",
    eventType: "AUTHORIZATION_FAILURE",
    component: "SECURITY",
    operation: "SECURITY_MONITORING",
    resourceType: "SECURITY_EVENT",
    resourceRef: securityRef,
    outcome: "DENIED",
    safeErrorCode: "SCOPE_DENIED",
    correlationId: "correlation:security-001",
    evidenceRefs: ["evidence:security:001"],
    occurredAt: "2026-09-10T01:00:00.000Z",
    ...overrides,
  };
}

function session(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    id: "session-security-001",
    principalId: "security-operator-001",
    principalType: "HUMAN",
    roles: ["SEC"],
    teamId: "team-001",
    state: "ACTIVE",
    assurance: "MFA",
    isMfaVerified: true,
    authenticatedAt: "2026-09-10T00:00:00.000Z",
    expiresAt: "2026-09-10T02:00:00.000Z",
    absoluteExpiresAt: "2026-09-10T08:00:00.000Z",
    familyId: "family-security-001",
    refreshReference: "refresh-security-001",
    ...overrides,
  };
}

function assignment(): LiveRoleAssignment {
  return {
    id: "assignment-security-001",
    principalId: "security-operator-001",
    subjectPrincipalType: "HUMAN",
    tenantId: "tenant-001",
    role: "SEC",
    teamIds: ["team-001"],
    resourceTypes: ["OPERATIONAL_EVIDENCE"],
    purposes: ["SECURITY_MONITORING"],
    effectiveFrom: "2026-09-09T00:00:00.000Z",
    effectiveUntil: "2026-09-11T00:00:00.000Z",
    status: "ACTIVE",
    version: 1,
  };
}

function authorization(assignments: readonly LiveRoleAssignment[]): AuthorizationService {
  let auditSequence = 0;
  return new AuthorizationService({
    auditSink: new AuditLog({ clock: () => new Date("2026-09-10T01:30:00.000Z"), idFactory: () => `audit:security:${String(++auditSequence)}` }),
    clock: () => new Date("2026-09-10T01:30:00.000Z"),
    policyVersion: "security-policy-v1",
    liveAssignmentResolver: {
      resolveCurrentAssignments: ({ tenantId, teamId, purpose }) =>
        tenantId === "tenant-001" && teamId === "team-001" && purpose === "SECURITY_MONITORING" ? assignments : [],
    },
  });
}

function withStore(run: (store: DurableOperationalEvidenceStore) => Promise<void>): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), "feat-023-d-"));
  const store = new DurableOperationalEvidenceStore({ databasePath: join(directory, "operations.sqlite") }, createTestOperationalReadinessEvidenceAdmission());
  return run(store).finally(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
}

function access(overrides: Partial<SecurityAccessRequest> = {}): SecurityAccessRequest {
  return {
    session: session(),
    tenantId: "tenant-001",
    scopeRef: "team-001",
    resourceRef: securityRef,
    correlationId: "correlation:security-read-001",
    ...overrides,
  };
}

test("FEAT-023-D requires the single internal security privacy operational control service", async () => {
  assert.equal(typeof await controlsConstructor(), "function");
});

test("FEAT-023-D conceals unbound cross-tenant cross-scope and caller-purpose evidence access", async () => withStore(async (store) => {
  const Constructor = await controlsConstructor();
  assert.equal(typeof Constructor, "function");
  const controls = new Constructor!({ authorizationService: authorization([assignment()]), evidenceStore: store });
  store.append(telemetry());
  assert.deepEqual(controls.readEvidence(access()), []);

  store.appendScoped(telemetry({ telemetryEventId: "telemetry:security-002" }), { tenantId: "tenant-001", scopeRef: "team-001" });
  assert.equal(controls.readEvidence(access()).length, 1);
  assert.deepEqual(controls.readEvidence(access({
    session: session({ assurance: "SINGLE_FACTOR", isMfaVerified: false }),
  })), []);
  assert.deepEqual(controls.readEvidence(access({ tenantId: "tenant-002" })), []);
  assert.deepEqual(controls.readEvidence(access({ scopeRef: "team-002" })), []);
  assert.deepEqual(controls.readEvidence({ ...access(), purpose: "CALLER_OVERRIDE" } as unknown as SecurityAccessRequest), []);
}));

test("FEAT-023-D ignores process-local roles and revalidates live authority", async () => withStore(async (store) => {
  const Constructor = await controlsConstructor();
  assert.equal(typeof Constructor, "function");
  const controls = new Constructor!({ authorizationService: authorization([]), evidenceStore: store });
  store.appendScoped(telemetry(), { tenantId: "tenant-001", scopeRef: "team-001" });

  assert.deepEqual(controls.readEvidence(access({ session: session({ roles: ["SEC", "ADM"] }) })), []);
}));

test("FEAT-023-E Alert visibility reuses live security authorization and tenant scope concealment", async () => withStore(async (store) => {
  const Constructor = await controlsConstructor();
  assert.equal(typeof Constructor, "function");
  const controls = new Constructor!({ authorizationService: authorization([assignment()]), evidenceStore: store });
  store.appendScoped(telemetry({ telemetryEventId: "telemetry:security-alert-001", component: "SECURITY",
    resourceRef: securityRef, evidenceRefs: ["evidence:security:alert-001"], occurredAt: "2026-09-10T01:00:00.000Z" }),
  { tenantId: "tenant-001", scopeRef: "team-001" });
  store.projectStatus({ statusSnapshotId: "status-snapshot:security-alert-001", telemetryEventId: "telemetry:security-alert-001",
    health: "UNHEALTHY", readiness: "READY", evaluatedAt: "2026-09-10T01:00:00.000Z", freshnessThresholdMs: null });
  const request = { session: session(), tenantId: "tenant-001", scopeRef: "team-001", correlationId: "correlation:security-alert-read-001" };
  assert.equal(controls.readAlerts(request).length, 1);
  assert.deepEqual(controls.readAlerts({ ...request, tenantId: "tenant-002" }), []);
  assert.deepEqual(controls.readAlerts({ ...request, scopeRef: "team-002" }), []);
  assert.deepEqual(controls.readAlerts({ ...request, session: session({ assurance: "SINGLE_FACTOR", isMfaVerified: false }) }), []);
  assert.equal(store.listAlertsScoped({ tenantId: "tenant-001", scopeRef: "team-001" }).length, 1);
}));

test("FEAT-023-F readiness visibility reuses live MFA authorization and tenant scope concealment", async () => withStore(async (store) => {
  const Constructor = await controlsConstructor();
  const controls = new Constructor!({ authorizationService: authorization([assignment()]), evidenceStore: store });
  const readinessBinding = { subjectRef: `backup-readiness:sha256:${"d".repeat(64)}`, tenantId: "tenant-001", scopeRef: "team-001",
    candidateRef: null, environmentRef: null, protectedSetRef: `protected-set:sha256:${"e".repeat(64)}`, rollbackTargetRef: null } as const;
  const evidenceTypes = ["BACKUP_CONFIGURATION", "BACKUP_EXECUTION", "BACKUP_INTEGRITY", "RESTORE_VALIDATION"] as const;
  evidenceTypes.forEach((evidenceType, index) => store.appendReadinessEvidence({
    evidenceId: `readiness-evidence:security-backup-${String(index + 1)}`, readinessType: "BACKUP", evidenceType,
    sourceClassification: evidenceType === "RESTORE_VALIDATION" ? "RECOVERY_VALIDATOR" : "BACKUP_SYSTEM",
    binding: readinessBinding, outcome: "SATISFIED", occurredAt: "2026-09-10T01:00:00.000Z", freshnessThresholdMs: null,
    evidenceRefs: [`evidence:security-backup-${String(index + 1)}`],
  }));
  store.projectReadiness({ readinessProjectionId: "readiness-projection:security-backup-001", readinessType: "BACKUP",
    binding: readinessBinding, evidenceIds: evidenceTypes.map((_, index) => `readiness-evidence:security-backup-${String(index + 1)}`),
    evaluatedAt: "2026-09-10T01:30:00.000Z" });
  const request = { session: session(), tenantId: "tenant-001", scopeRef: "team-001", correlationId: "correlation:security-readiness-read-001" };
  assert.equal(controls.readReadiness(request).length, 1);
  assert.deepEqual(controls.readReadiness({ ...request, tenantId: "tenant-002" }), []);
  assert.deepEqual(controls.readReadiness({ ...request, scopeRef: "team-002" }), []);
  assert.deepEqual(controls.readReadiness({ ...request, session: session({ assurance: "SINGLE_FACTOR", isMfaVerified: false }) }), []);
}));

test("FEAT-023-D security readiness requires live MFA and creates no projection on denial", async () => withStore(async (store) => {
  const Constructor = await controlsConstructor();
  assert.equal(typeof Constructor, "function");
  const controls = new Constructor!({ authorizationService: authorization([assignment()]), evidenceStore: store });
  store.appendScoped(telemetry(), { tenantId: "tenant-001", scopeRef: "team-001" });
  const request: SecurityReadinessRequest = {
    ...access(), telemetryEventId: "telemetry:security-001", statusSnapshotId: "status-snapshot:security-001",
    health: "DEGRADED", readiness: "NOT_READY", evaluatedAt: "2026-09-10T01:30:00.000Z",
    freshnessThresholdMs: null, reason: "Review security control readiness",
  };

  assert.equal(controls.projectSecurityReadiness({ ...request, session: session({ assurance: "SINGLE_FACTOR", isMfaVerified: false }) }), undefined);
  assert.equal(store.listStatuses().length, 0);
  const projected = controls.projectSecurityReadiness(request);
  assert.equal(projected?.health, "DEGRADED");
  assert.equal(projected?.readiness, "NOT_READY");
  assert.equal(projected?.freshness, "UNKNOWN");
  assert.equal(store.listStatuses().length, 1);
}));
