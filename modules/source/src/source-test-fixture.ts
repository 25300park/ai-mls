import { AuditLog } from "../../audit/src/audit-log.js";
import {
  AuthorizationService,
  type RoleAssignment,
} from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import {
  SourceRegistryService,
  type SourcePolicy,
} from "./source-registry-service.js";

export function sourceSession(
  principalId: string,
  role: "COL" | "SVC",
  principalType: "HUMAN" | "SERVICE" = "HUMAN",
): SessionContext {
  return Object.freeze({
    id: `session-${principalId}`,
    principalId,
    principalType,
    roles: [role],
    teamId: "team-a",
    state: "ACTIVE",
    assurance: principalType === "SERVICE" ? "WORKLOAD" : "MFA",
    isMfaVerified: principalType === "HUMAN",
    authenticatedAt: "2026-07-19T00:00:00.000Z",
    expiresAt: "2026-07-19T01:00:00.000Z",
    absoluteExpiresAt: "2026-07-19T02:00:00.000Z",
    familyId: `family-${principalId}`,
    refreshReference: `refresh-${principalId}`,
  });
}

export const activePolicy: SourcePolicy = Object.freeze({
  id: "source-policy-1",
  name: "Approved manual source",
  sourceType: "STAFF_OBSERVED",
  status: "ACTIVE",
  policyVersion: 3,
  allowedMethods: ["MANUAL_REFERENCE"],
  allowedPurposes: ["SOURCE_INTAKE"],
  classification: "CONFIDENTIAL_BUSINESS",
  proposedBy: "user-source-owner",
  reviewedAt: "2026-07-18T00:00:00.000Z",
});

export function sourceFixture(initialSources: readonly SourcePolicy[] = [activePolicy]): {
  readonly service: SourceRegistryService;
  readonly auditLog: AuditLog;
} {
  let sequence = 0;
  const clock = (): Date => new Date("2026-07-19T00:05:00.000Z");
  const auditLog = new AuditLog({
    clock,
    idFactory: (): string => `audit-source-${String(++sequence)}`,
  });
  const assignments: readonly RoleAssignment[] = [
    { principalId: "user-collector-1", role: "COL" as const },
    { principalId: "service-collector-1", role: "SVC" as const },
  ].map((subject, index) => ({
    id: `source-assignment-${String(index + 1)}`,
    ...subject,
    teamIds: ["team-a"],
    resourceTypes: ["SourceRegistry", "RawSource"],
    purposes: ["SOURCE_INTAKE", "SOURCE_GOVERNANCE"],
    effectiveFrom: "2026-07-18T00:00:00.000Z",
    effectiveUntil: "2026-07-20T00:00:00.000Z",
    status: "ACTIVE",
  }));
  return {
    service: new SourceRegistryService({
      initialSources,
      authorizationService: new AuthorizationService({
        assignments,
        authoritySource: "STATIC_TEST_COMPATIBILITY",
        auditSink: auditLog,
        clock,
        policyVersion: "authorization-v1",
      }),
      auditSink: auditLog,
      clock,
      idFactory: () => `source-policy-${String(++sequence)}`,
      policyVersion: "source-registry-v1",
    }),
    auditLog,
  };
}
