import assert from "node:assert/strict";
import test from "node:test";

import {
  RegisteredServiceWorkloadEvidenceAuthorityAdapter,
  type RegisteredServiceWorkloadAuditEvidence,
  type RegisteredServiceWorkloadIdentityEvidence,
} from "./registered-service-workload-evidence-authority.js";
import type { RegisteredServiceWorkloadRecord } from "./registered-service-workload.js";

const record: RegisteredServiceWorkloadRecord = Object.freeze({
  registrationId: "registration-api-014", tenantId: "tenant-a", principalId: "service-publication",
  principalType: "SERVICE", assurance: "WORKLOAD", environment: "PRODUCTION", status: "ACTIVE",
  workloadPurpose: "PUBLICATION_RUNTIME", audience: "API-014", registrationVersion: 4,
  identityEvidenceRef: "identity-evidence:registration-api-014:v4", auditEvidenceRef: "audit-evidence:registration-api-014:v4",
  createdAt: "2026-09-18T00:00:00.000Z", updatedAt: "2026-09-18T01:00:00.000Z",
});

function identity(overrides: Record<string, unknown> = {}): RegisteredServiceWorkloadIdentityEvidence {
  return Object.freeze({
    evidenceRef: record.identityEvidenceRef, schemaVersion: 1, registrationId: record.registrationId,
    registrationVersion: record.registrationVersion, tenantId: record.tenantId, principalId: record.principalId,
    immutable: true, ...overrides,
  });
}

function audit(overrides: Record<string, unknown> = {}): RegisteredServiceWorkloadAuditEvidence {
  return Object.freeze({ ...identity({ evidenceRef: record.auditEvidenceRef }), final: true, ...overrides });
}

test("requires independently authoritative Identity and final API-016 evidence bound to the exact registration", () => {
  const adapter = new RegisteredServiceWorkloadEvidenceAuthorityAdapter(
    { findIdentityEvidence: () => identity() },
    { findFinalAuditEvidence: () => audit() },
  );
  assert.doesNotThrow(() => adapter.assertRegisteredWorkloadEvidence(record));
});

test("missing, mutable, non-final, mismatched, extra-field or unavailable evidence fails closed", () => {
  const cases = [
    [undefined, audit()], [identity({ immutable: false }), audit()], [identity(), undefined],
    [identity(), audit({ final: false })], [identity({ tenantId: "tenant-other" }), audit()],
    [identity(), audit({ registrationVersion: 3 })], [identity({ unexpected: "authority" }), audit()],
  ] as const;
  for (const [identityEvidence, auditEvidence] of cases) {
    const adapter = new RegisteredServiceWorkloadEvidenceAuthorityAdapter(
      { findIdentityEvidence: () => identityEvidence }, { findFinalAuditEvidence: () => auditEvidence },
    );
    assert.throws(() => adapter.assertRegisteredWorkloadEvidence(record), /evidence is unavailable/u);
  }
  const unavailable = new RegisteredServiceWorkloadEvidenceAuthorityAdapter(
    { findIdentityEvidence: () => { throw new Error("C:\\private\\identity.sqlite raw stack"); } },
    { findFinalAuditEvidence: () => audit() },
  );
  assert.throws(() => unavailable.assertRegisteredWorkloadEvidence(record), (error: unknown) =>
    error instanceof Error && error.message === "Registered service workload evidence is unavailable.");
});
