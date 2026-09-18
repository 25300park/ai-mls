import assert from "node:assert/strict";
import test from "node:test";

import type { RegisteredServiceWorkloadAuthorityLease, RegisteredServiceWorkloadRecord } from "../../../modules/identity/src/index.js";
import {
  ProductionServiceIdentityError,
  ProductionServiceIdentityResolver,
} from "./production-service-identity-resolver.js";

const active: RegisteredServiceWorkloadRecord = Object.freeze({
  registrationId: "registration-api-014", tenantId: "tenant-a", principalId: "service-publication",
  principalType: "SERVICE", assurance: "WORKLOAD", environment: "PRODUCTION", status: "ACTIVE",
  workloadPurpose: "PUBLICATION_RUNTIME", audience: "API-014", registrationVersion: 4,
  identityEvidenceRef: "identity-evidence:registration-api-014", auditEvidenceRef: "audit-evidence:registration-api-014",
  createdAt: "2026-09-18T00:00:00.000Z", updatedAt: "2026-09-18T01:00:00.000Z",
});

function lease(read: () => RegisteredServiceWorkloadRecord | undefined): RegisteredServiceWorkloadAuthorityLease {
  return { assertSchemaReady: () => undefined, findByRegistrationId: read, close: () => undefined };
}

function resolver(read: () => RegisteredServiceWorkloadRecord | undefined = () => active): ProductionServiceIdentityResolver {
  return new ProductionServiceIdentityResolver({
    authority: lease(read), expectedWorkloadPurpose: "PUBLICATION_RUNTIME", expectedAudience: "API-014",
  });
}

function expectDenied(operation: () => unknown): void {
  assert.throws(operation, (error: unknown) => error instanceof ProductionServiceIdentityError
    && error.code === "PRODUCTION_SERVICE_IDENTITY_UNAVAILABLE"
    && error.message === "Production service identity is unavailable.");
}

test("derives the exact immutable tenant/principal binding from registrationId only", () => {
  const binding = resolver().resolve({ registrationId: "registration-api-014" });
  assert.deepEqual(binding, {
    registrationId: "registration-api-014", tenantId: "tenant-a", principalId: "service-publication",
    principalType: "SERVICE", assurance: "WORKLOAD", environment: "PRODUCTION",
    workloadPurpose: "PUBLICATION_RUNTIME", audience: "API-014", registrationVersion: 4,
    identityEvidenceRef: "identity-evidence:registration-api-014",
    auditEvidenceRef: "audit-evidence:registration-api-014",
  });
  assert.deepEqual(Object.keys(binding).sort(), [
    "assurance", "audience", "auditEvidenceRef", "environment", "identityEvidenceRef", "principalId", "principalType",
    "registrationId", "registrationVersion", "tenantId", "workloadPurpose",
  ]);
  assert.equal(Object.isFrozen(binding), true);
});

test("caller tenant/principal/readiness and authorization claims are not accepted inputs", () => {
  const input = {
    registrationId: "registration-api-014", tenantId: "forged", principalId: "forged", readiness: "READY",
    roles: ["ADMIN"], scopes: ["*"], capabilities: ["publication.publish"],
  } as unknown as Parameters<ProductionServiceIdentityResolver["resolve"]>[0];
  expectDenied(() => resolver().resolve(input));
});

test("missing, inactive, lower-environment, type, assurance, purpose and audience mismatches fail closed", () => {
  expectDenied(() => resolver(() => undefined).resolve({ registrationId: "missing" }));
  for (const record of [
    { ...active, status: "SUSPENDED" }, { ...active, status: "REVOKED" },
    { ...active, environment: "STAGING" }, { ...active, principalType: "HUMAN" },
    { ...active, assurance: "MFA" }, { ...active, workloadPurpose: "OTHER" }, { ...active, audience: "API-015" },
  ] as unknown as RegisteredServiceWorkloadRecord[]) {
    expectDenied(() => resolver(() => record).resolve({ registrationId: active.registrationId }));
  }
});

test("runtime revalidation fails closed after lifecycle, version, tenant or principal changes", () => {
  let current: RegisteredServiceWorkloadRecord = active;
  const service = resolver(() => current);
  const binding = service.resolve({ registrationId: active.registrationId });
  service.assertStillActive(binding);
  for (const replacement of [
    { ...active, status: "REVOKED" }, { ...active, registrationVersion: 5 },
    { ...active, tenantId: "tenant-b" }, { ...active, principalId: "service-other" },
  ] as RegisteredServiceWorkloadRecord[]) {
    current = replacement;
    expectDenied(() => service.assertStillActive(binding));
  }
});

test("unknown fields and malformed identifiers fail closed without leaking diagnostics", () => {
  expectDenied(() => resolver().resolve({ registrationId: "" }));
  expectDenied(() => resolver().resolve({ registrationId: "C:\\private\\identity.sqlite" }));
  const unsafe = lease(() => { throw new Error("SELECT * FROM identity_registered_service_workloads at C:\\private\\identity.sqlite"); });
  expectDenied(() => new ProductionServiceIdentityResolver({ authority: unsafe, expectedWorkloadPurpose: "PUBLICATION_RUNTIME", expectedAudience: "API-014" }).resolve({ registrationId: active.registrationId }));
});
