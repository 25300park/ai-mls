import assert from "node:assert/strict";
import test from "node:test";

import type { RegisteredServiceWorkloadAuthorityLease, RegisteredServiceWorkloadRecord } from "../../../modules/identity/src/index.js";
import { ProductionServiceIdentityResolver } from "./production-service-identity-resolver.js";
import { ProductionJobExecutionAdmissionAdapter } from "./production-job-execution-admission-adapter.js";
import { ProductionWorkloadAuthorizationAdapter } from "./production-workload-authorization-adapter.js";

const active: RegisteredServiceWorkloadRecord = Object.freeze({
  registrationId: "registration-api-017", tenantId: "tenant-a", principalId: "service-jobs",
  principalType: "SERVICE", assurance: "WORKLOAD", environment: "PRODUCTION", status: "ACTIVE",
  workloadPurpose: "JOB_RUNTIME", audience: "API-017", registrationVersion: 2,
  identityEvidenceRef: "identity-evidence:registration-api-017:v2", auditEvidenceRef: "audit-evidence:registration-api-017:v2",
  createdAt: "2026-09-18T00:00:00.000Z", updatedAt: "2026-09-18T01:00:00.000Z",
});

test("API-017 admission maps the canonical job.execute boundary and revalidates live registration on every call", () => {
  let current = active;
  const authority: RegisteredServiceWorkloadAuthorityLease = {
    assertSchemaReady(): void { return undefined; }, findByRegistrationId: () => current, close(): void { return undefined; },
  };
  const resolver = new ProductionServiceIdentityResolver({ authority, expectedWorkloadPurpose: "JOB_RUNTIME", expectedAudience: "API-017" });
  const binding = resolver.resolve({ registrationId: active.registrationId });
  const seen: unknown[] = [];
  const workload = new ProductionWorkloadAuthorizationAdapter(resolver, { evaluateWorkload(request) {
    seen.push(request);
    return Object.freeze({ effect: "ALLOW", reasonCode: "POLICY_ALLOWED", policyVersion: "policy-v1", obligations: Object.freeze(["AUDIT"] as const), assignmentIds: Object.freeze(["assignment-1"]) });
  } });
  const admission = new ProductionJobExecutionAdmissionAdapter(binding, workload);
  const context = Object.freeze({
    jobId: "job-1", prospectiveAttempt: 1, jobType: "AI_LISTING_PARSE" as const,
    tenantId: "tenant-a", scopeRef: "team:team-a", purpose: "JOB_EXECUTION",
    inputReferences: Object.freeze([]), policyVersion: "jobs-policy-v1",
    originatingAuthorityEvidenceRefs: Object.freeze(["evidence:origin:1"]), correlationId: "correlation-job-1",
  });
  assert.deepEqual(admission.evaluate(context), {
    status: "ALLOWED",
    evidenceRefs: [active.identityEvidenceRef, active.auditEvidenceRef],
  });
  assert.deepEqual(seen, [{
    subject: {
      registrationId: binding.registrationId, registrationVersion: binding.registrationVersion,
      tenantId: binding.tenantId, principalId: binding.principalId, principalType: "SERVICE", assurance: "WORKLOAD",
      identityEvidenceRef: binding.identityEvidenceRef, auditEvidenceRef: binding.auditEvidenceRef,
    }, action: "job.execute", resource: { type: "Job", id: "job-1", tenantId: "tenant-a" },
    purpose: "JOB_EXECUTION", correlationId: "correlation-job-1",
  }]);
  current = Object.freeze({ ...active, status: "SUSPENDED", registrationVersion: 3 });
  assert.throws(() => admission.evaluate(context), /Production workload authorization is unavailable/u);
});

test("revalidates registration immediately before every live authorization evaluation", () => {
  let current = active;
  const authority: RegisteredServiceWorkloadAuthorityLease = {
    assertSchemaReady(): void { return undefined; }, findByRegistrationId: () => current, close(): void { return undefined; },
  };
  const resolver = new ProductionServiceIdentityResolver({ authority, expectedWorkloadPurpose: "JOB_RUNTIME", expectedAudience: "API-017" });
  const binding = resolver.resolve({ registrationId: active.registrationId });
  let calls = 0;
  const adapter = new ProductionWorkloadAuthorizationAdapter(resolver, { evaluateWorkload(request) {
    calls += 1;
    assert.equal(Object.hasOwn(request.subject, "sessionId"), false);
    return Object.freeze({ effect: "ALLOW", reasonCode: "POLICY_ALLOWED", policyVersion: "policy-v1", obligations: Object.freeze(["AUDIT"] as const), assignmentIds: Object.freeze(["assignment-1"]) });
  } });
  const request = { identity: binding, action: "service.execute", resource: { type: "Job", id: "job-1", tenantId: "tenant-a" }, purpose: "JOB_EXECUTION", correlationId: "correlation-1" } as const;
  assert.equal(adapter.evaluate(request).effect, "ALLOW");
  current = Object.freeze({ ...active, status: "REVOKED", registrationVersion: 3 });
  assert.throws(() => adapter.evaluate(request), /Production workload authorization is unavailable/u);
  assert.equal(calls, 1);
});
