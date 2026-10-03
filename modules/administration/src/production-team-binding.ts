import type { PostgreSqlClientPort } from "../../identity/src/postgresql-pool.js";
import type { RoleCode } from "../../../packages/security-contracts/src/index.js";
import { isCanonicalRoleCode, type LiveRoleAssignment } from "../../authorization/src/authorization-service.js";
import type { TeamScopePersistenceRecord } from "./administration-persistence.js";
import { readAdministrationOnClient } from "./administration-postgresql-persistence.js";
import { AdministrationLiveAssignmentAdapter } from "./live-assignment-adapter.js";

export interface ExplicitTeamSelection { readonly tenantId:string; readonly principalId:string; readonly requestedTeamId:string }
export class ProductionTeamBindingError extends Error {
  public constructor() { super("Trusted binding unavailable."); this.name="ProductionTeamBindingError"; }
}
export function validateExplicitTeamBinding(context:ExplicitTeamSelection,team:TeamScopePersistenceRecord|undefined,assignments:readonly LiveRoleAssignment[],now:Date):readonly RoleCode[] {
  if (![context.tenantId,context.principalId,context.requestedTeamId].every(exactId)
    || team?.recordType!=="TEAM_SCOPE" || team.teamId!==context.requestedTeamId || team.tenantId!==context.tenantId
    || team.scope.tenantId!==context.tenantId || team.status!=="ACTIVE" || !Number.isFinite(now.getTime())) throw new ProductionTeamBindingError();
  const roles=new Set<RoleCode>();
  for(const item of assignments){
    if(item.principalId!==context.principalId || item.tenantId!==context.tenantId || item.subjectPrincipalType!=="HUMAN" || !isCanonicalRoleCode(item.role))throw new ProductionTeamBindingError();
    if(item.status==="ACTIVE" && item.teamIds.includes(context.requestedTeamId)
      && now.getTime()>=Date.parse(item.effectiveFrom) && now.getTime()<Date.parse(item.effectiveUntil))roles.add(item.role);
  }
  if(roles.size===0)throw new ProductionTeamBindingError();
  return Object.freeze([...roles].sort());
}
// Same-client read participant. No BEGIN/COMMIT/release, no Administration mutation.
export async function resolveExplicitTeamOnClient(client:PostgreSqlClientPort,context:ExplicitTeamSelection,now:Date):Promise<readonly RoleCode[]>{
  return (await resolveExplicitTeamAuthorityOnClient(client,context,now)).roles;
}
export async function resolveExplicitTeamAuthorityOnClient(client:PostgreSqlClientPort,context:ExplicitTeamSelection,now:Date):Promise<{roles:readonly RoleCode[];repositories:Awaited<ReturnType<typeof readAdministrationOnClient>>}>{
  if(![context.tenantId,context.principalId,context.requestedTeamId].every(exactId))throw new ProductionTeamBindingError();
  try{
    // Canonical writers lock these existing resource revision rows before mutation.
    // Deterministic shared locks keep membership/team/role eligibility valid through issuance.
    const locked=await client.query(`SELECT rev.tenant_id,rev.resource_type,rev.resource_id
      FROM app_administration.administration_revisions rev
      JOIN app_administration.administration_resources r USING(tenant_id,resource_type,resource_id)
      WHERE rev.tenant_id=$1 AND (
        (rev.resource_type='TEAM_SCOPE' AND rev.resource_id=$3)
        OR (rev.resource_type='ROLE_ASSIGNMENT' AND r.payload_json->>'subjectPrincipalId'=$2)
        OR (rev.resource_type='ROLE' AND EXISTS(SELECT 1 FROM app_administration.administration_resources assignment WHERE assignment.tenant_id=$1 AND assignment.resource_type='ROLE_ASSIGNMENT' AND assignment.payload_json->>'subjectPrincipalId'=$2 AND assignment.payload_json->>'roleId'=rev.resource_id)))
      ORDER BY rev.tenant_id,rev.resource_type,rev.resource_id FOR SHARE OF rev,r`,[context.tenantId,context.principalId,context.requestedTeamId]);
    const repositories=await readAdministrationOnClient(client);
    const keys=new Set(locked.rows.map(row=>`${String(row["resource_type"])}:${String(row["resource_id"])}`));
    if(!keys.has(`TEAM_SCOPE:${context.requestedTeamId}`))throw new ProductionTeamBindingError();
    // READ COMMITTED hydration may see a new assignment absent from the lock snapshot.
    // Never use an unprotected assignment/role to establish or authorize a binding.
    for(const assignment of repositories.roleAssignments.listBySubject(context.tenantId,context.principalId)){
      if(!keys.has(`ROLE_ASSIGNMENT:${assignment.roleAssignmentId}`) || !keys.has(`ROLE:${assignment.roleId}`))throw new ProductionTeamBindingError();
    }
    const team=repositories.teamScopes.find({tenantId:context.tenantId,resourceType:"TEAM_SCOPE",resourceId:context.requestedTeamId});
    const assignments=new AdministrationLiveAssignmentAdapter(repositories).resolveSubjectTeamAssignments({tenantId:context.tenantId,subjectPrincipalId:context.principalId,subjectPrincipalType:"HUMAN",teamId:context.requestedTeamId});
    return {roles:validateExplicitTeamBinding(context,team,assignments,now),repositories};
  }catch{throw new ProductionTeamBindingError();}
}
function exactId(value:unknown):value is string{return typeof value==="string" && value.length>0 && value.length<=512 && value.trim()===value && !/[\u0000-\u001f\u007f\\]/u.test(value);}
