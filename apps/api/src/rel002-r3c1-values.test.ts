import assert from "node:assert/strict";
import test from "node:test";
const instant = "2026-10-02T00:00:00.000Z";
const evidence = [{ type: "AUDIT", id: "audit-1", version: 1 }];
const organization = { organizationId: "org-1", organizationVersion: 1, tenantId: "tenant-1", status: "PROPOSED", evidenceReferences: evidence, createdAt: instant, updatedAt: instant };
const project = { projectId: "project-1", projectVersion: 1, organizationId: "org-1", tenantId: "tenant-1", status: "PROPOSED", containedScopes: [{ scopeType: "TEAM", scopeId: "team-1" }], evidenceReferences: evidence, createdAt: instant, updatedAt: instant };
const binding = { bindingId: "binding-1", bindingVersion: 1, registrationId: "registration-1", registrationVersion: 1, tenantId: "tenant-1", principalId: "principal-1", organizationId: "org-1", projectId: "project-1", scopeType: "TEAM", scopeId: "team-1", identityEvidenceRef: "identity-proof", organizationEvidenceRef: "organization-governance:org-1:1", projectEvidenceRef: "project-governance:project-1:1", scopeEvidenceRef: "administration-scope:tenant-1:TEAM_SCOPE:team-1:1", status: "PROPOSED", auditEvidenceRef: "binding-audit", createdAt: instant, updatedAt: instant };
const cases = [
  ["../../../modules/organization/src/organization-governance.js", "assertOrganizationGovernanceRecord", organization],
  ["../../../modules/administration/src/project-governance.js", "assertProjectGovernanceRecord", project],
  ["../../../modules/identity/src/workload-startup-binding.js", "assertWorkloadStartupBindingRecord", binding],
] as const;
for (const [path, name, record] of cases) {
  test(`${name} accepts canonical fields and rejects malformed/future authority`, async () => {
    const loaded = await import(path) as Record<string, (input: unknown) => void>;
    const validate = loaded[name]!;
    assert.doesNotThrow(() => validate(record));
    for (const change of [{ tenantId: " " }, { updatedAt: "bad" }, { createdAt: "2026-10-03T00:00:00.000Z" }, { status: "UNKNOWN" }, { bindingEvidenceRef: "forged" }]) assert.throws(() => validate({ ...record, ...change }));
  });
}
test("project rejects unmapped and duplicate scope containment", async () => {
  const path = "../../../modules/administration/src/project-governance.js";
  const loaded = await import(path) as { assertProjectGovernanceRecord: (input: unknown) => void };
  for (const scopes of [[{ scopeType: "RESOURCE", scopeId: "team-1" }], [...project.containedScopes, ...project.containedScopes]]) assert.throws(() => loaded.assertProjectGovernanceRecord({ ...project, containedScopes: scopes }));
});
test("binding refs pin exact organization/project/scope tuple and canonical version encoding", async () => {
  const path = "../../../modules/identity/src/workload-startup-binding.js";
  const loaded = await import(path) as { assertWorkloadStartupBindingRecord: (input: unknown) => void };
  for (const change of [{ scopeType: "RESOURCE" }, { organizationEvidenceRef: "organization-governance:wrong:1" }, { projectEvidenceRef: "project-governance:project-1:01" }, { scopeEvidenceRef: "administration-scope:wrong:TEAM_SCOPE:team-1:1" }, { registrationVersion: 0 }]) assert.throws(() => loaded.assertWorkloadStartupBindingRecord({ ...binding, ...change }));
});