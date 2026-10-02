import type { AsyncAdministrationUnitOfWork } from "../../administration/src/administration-async-persistence.js";
import { canonicalJson, requireValue, safeText, safeVersion } from "../../organization/src/governance-persistence-support.js";
import type { WorkloadStartupBindingRecord } from "./workload-startup-binding.js";
export interface WorkloadStartupTeamVerifier { assertTeamEligibility(binding: WorkloadStartupBindingRecord): Promise<void> }
export function assertStartupTeamEligibility(binding: Readonly<Record<string,unknown>>, team: Readonly<Record<string,unknown>> | undefined, assignments: readonly Readonly<Record<string,unknown>>[], now: Date): void {
  const selected=binding["authorizationTeamId"];
  requireValue(safeText(selected) && Number.isFinite(now.getTime()));
  requireValue(team?.["recordType"] === "TEAM_SCOPE" && team["teamId"] === selected && team["status"] === "ACTIVE" && team["tenantId"] === binding["tenantId"] && team["organizationId"] === binding["organizationId"]);
  const identities=new Map<string,string>();
  for(const row of assignments) {
    requireValue(row["tenantId"] === binding["tenantId"] && row["subjectPrincipalId"] === binding["principalId"] && row["subjectPrincipalType"] === "SERVICE" && safeText(row["roleAssignmentId"]) && safeVersion(row["version"]));
    const key=String(row["roleAssignmentId"]), value=canonicalJson(row);
    requireValue(!identities.has(key) || identities.get(key) === value); identities.set(key,value);
    requireValue(Array.isArray(row["teamIds"]) && row["teamIds"].every(safeText));
    const from=Date.parse(String(row["effectiveFrom"])),until=Date.parse(String(row["effectiveUntil"]));
    requireValue(Number.isFinite(from) && Number.isFinite(until) && from < until);
  }
  requireValue(assignments.some(row=>row["status"] === "ACTIVE" && (row["teamIds"] as readonly string[]).includes(String(selected)) && Date.parse(String(row["effectiveFrom"])) <= now.getTime() && now.getTime() < Date.parse(String(row["effectiveUntil"]))));
}
export class AdministrationWorkloadStartupTeamVerifier implements WorkloadStartupTeamVerifier {
  public constructor(private readonly administration: Pick<AsyncAdministrationUnitOfWork,"teamScopes"|"roleAssignments">, private readonly clock: ()=>Date) {}
  public async assertTeamEligibility(binding: WorkloadStartupBindingRecord): Promise<void> {
    requireValue(safeText(binding.authorizationTeamId));
    const team=await this.administration.teamScopes.find({tenantId:binding.tenantId,resourceType:"TEAM_SCOPE",resourceId:binding.authorizationTeamId});
    const assignments=await this.administration.roleAssignments.listBySubject(binding.tenantId,binding.principalId);
    assertStartupTeamEligibility({...binding},team ? {...team} : undefined,assignments.map(row=>({...row})),this.clock());
  }
}
export function startupAuthorizationResource(binding: Readonly<Record<string,unknown>>, version: number): {type:"Administration";id:string;tenantId:string;version:number;teamId:string} {
  const types: Readonly<Record<string,string>>={TEAM:"TEAM_SCOPE",POLICY:"POLICY",SOURCE:"SOURCE_REGISTRY",TARGET:"PUBLICATION_TARGET"};
  requireValue(safeText(binding["authorizationTeamId"]) && safeText(binding["tenantId"]) && safeText(binding["scopeId"]) && typeof binding["scopeType"] === "string" && Object.hasOwn(types,binding["scopeType"]) && safeVersion(version));
  return {type:"Administration",id:`Administration:${types[String(binding["scopeType"])]}:${String(binding["scopeId"])}`,tenantId:String(binding["tenantId"]),version,teamId:String(binding["authorizationTeamId"])};
}
