import assert from "node:assert/strict";
import test from "node:test";
import { validateExplicitTeamBinding } from "./production-team-binding.js";
import type { TeamScopePersistenceRecord } from "./administration-persistence.js";
import type { LiveRoleAssignment } from "../../authorization/src/authorization-service.js";
const context={tenantId:"tenant",principalId:"principal",requestedTeamId:"team"};
const now=new Date("2026-10-03T00:00:00.000Z");
const team:TeamScopePersistenceRecord={recordType:"TEAM_SCOPE",tenantId:"tenant",teamId:"team",scope:{tenantId:"tenant",scopeType:"TEAM",scopeId:"team"},status:"ACTIVE",organizationId:"organization",version:1,evidenceReferences:[{type:"AUDIT",id:"evidence",version:1}]};
const assignment:LiveRoleAssignment={id:"assignment",principalId:"principal",subjectPrincipalType:"HUMAN",tenantId:"tenant",role:"AGT",teamIds:["other","team"],resourceTypes:["Property"],purposes:["PROPERTY_ADMINISTRATION"],effectiveFrom:"2026-10-02T00:00:00.000Z",effectiveUntil:"2026-10-04T00:00:00.000Z",status:"ACTIVE",version:2};
test("explicit selection is validated and remains exact regardless of team array order",()=>{
  assert.deepEqual(validateExplicitTeamBinding(context,team,[assignment],now),["AGT"]);
  assert.deepEqual(validateExplicitTeamBinding(context,team,[{...assignment,teamIds:["team","other"]}],now),["AGT"]);
  assert.throws(()=>validateExplicitTeamBinding({...context,requestedTeamId:""},team,[assignment],now));
});
test("missing inactive wrong tenant team and inapplicable live membership fail closed",()=>{
  for(const candidate of [undefined,{...team,status:"REVOKED" as const},{...team,tenantId:"other"},{...team,teamId:"other"}])assert.throws(()=>validateExplicitTeamBinding(context,candidate,[assignment],now));
  for(const candidates of [[],[{...assignment,teamIds:["other"]}],[{...assignment,tenantId:"other"}],[{...assignment,principalId:"other"}],[{...assignment,effectiveUntil:now.toISOString()}]])assert.throws(()=>validateExplicitTeamBinding(context,team,candidates,now));
});
