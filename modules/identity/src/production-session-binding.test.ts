import assert from "node:assert/strict";
import test from "node:test";
import { assertProductionSessionBinding } from "./production-session-binding.js";
import { assertValidDurableSessionRecord, assertDurableSessionImmutableFields, type DurableSessionRecord } from "./session-persistence.js";

const legacy: DurableSessionRecord = { id:"session",principalId:"principal",principalType:"HUMAN",roles:[],state:"ACTIVE",assurance:"SINGLE_FACTOR",isMfaVerified:false,familyId:"family",refreshReference:"private-reference",sessionVersion:1,tenantBindingOrigin:"legacy-origin",issuedAt:"2026-10-03T00:00:00.000Z",auditEvidenceRef:"audit",lastAccessedAt:"2026-10-03T00:00:00.000Z" };
test("Production binding persists exact approved tuple while historical Sessions remain unbound", () => {
  assertValidDurableSessionRecord(legacy);
  assert.throws(()=>assertProductionSessionBinding(legacy,"tenant"));
  const bound = { ...legacy,tenantId:"tenant",teamId:"team",tenantBindingOrigin:"AUTHENTICATED_PRINCIPAL_TENANT",teamBindingOrigin:"EXPLICIT_TEAM_SELECTION_VALIDATED" };
  assertValidDurableSessionRecord(bound);
  assertProductionSessionBinding(bound,"tenant");
  for(const replacement of [{...bound,tenantId:"other"},{...bound,teamId:undefined},{...bound,teamBindingOrigin:"inferred"},{...bound,tenantBindingOrigin:"inferred"}]) assert.throws(()=>assertProductionSessionBinding(replacement,"tenant"));
  assert.throws(()=>assertDurableSessionImmutableFields(bound,{...bound,tenantId:"other"}));
  assert.throws(()=>assertDurableSessionImmutableFields(bound,{...bound,teamBindingOrigin:"inferred"}));
});
