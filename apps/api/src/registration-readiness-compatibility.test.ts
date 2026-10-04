import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parseRegistrationManifest } from "../../../modules/identity/src/register-service-workload.js";
import { R3C2B_EVIDENCE_CATALOG_QUERY } from "./r3c2b-postgresql-readiness.js";

test("registration compatibility separates only approved operator ACL and retains fail-closed security", () => {
  assert.match(R3C2B_EVIDENCE_CATALOG_QUERY, /ai_mls_production_registration_operator/u);
  assert.match(R3C2B_EVIDENCE_CATALOG_QUERY, /rolcanlogin/u);
  assert.match(R3C2B_EVIDENCE_CATALOG_QUERY, /is_grantable/u);
  assert.match(R3C2B_EVIDENCE_CATALOG_QUERY, /has_table_privilege\('ai_mls_production_runtime'/u);
});
test("approved deployment IDs and exact registration manifest remain frozen", async () => {
  const binding = JSON.parse(await readFile("docs/implementation/REL002_R3G1B4_PRODUCTION_DEPLOYMENT_IDENTITY_BINDING.json", "utf8")) as Record<string, unknown>;
  const manifest = parseRegistrationManifest(JSON.parse(await readFile("docs/implementation/REL002_R3G1B4_PRODUCTION_WORKLOAD_REGISTRATION_MANIFEST.json", "utf8")));
  assert.equal(binding["tenantId"], "bcc988b1-00c9-481b-9dbb-bfb56b5ea91f");
  assert.equal(binding["principalId"], "f2f97677-8f55-4d62-a5cc-2ff10e757718");
  assert.equal(manifest.registrationId, "53c1f7db-52de-4873-8b41-a016cab8e6c6");
  assert.equal(manifest.registrationVersion, 1);
  for (const key of ["tenantId", "principalId", "environment", "purpose", "audience"] as const) assert.equal(binding[key], manifest[key]);
  assert.equal(binding["schemaVersion"], 1); assert.equal(binding["service"], "AI_MLS_API");
  assert.equal(manifest.identityEvidenceRef, `workload-identity-evidence:${manifest.registrationId}:1`);
  assert.equal(manifest.auditEvidenceRef, `registered-service-workload-audit:${manifest.registrationId}:1`);
});
