import { assertChronology, assertEvidence, canonicalJson, plainRecord, requireValue, safeText, safeVersion, type GovernanceEvidenceReference, type GovernanceLifecycle } from "../../organization/src/governance-persistence-support.js";
export type WorkloadBindingScopeType = "TEAM" | "POLICY" | "SOURCE" | "TARGET";
export interface ProjectGovernanceRecord {
  readonly projectId: string; readonly projectVersion: number; readonly organizationId: string; readonly tenantId: string;
  readonly status: GovernanceLifecycle; readonly containedScopes: readonly Readonly<{ scopeType: WorkloadBindingScopeType; scopeId: string }>[];
  readonly evidenceReferences: readonly GovernanceEvidenceReference[]; readonly createdAt: string; readonly updatedAt: string;
}
export interface AsyncProjectGovernanceReadContract {
  findVersion(projectId: string, projectVersion: number, tenantId: string): Promise<ProjectGovernanceRecord | undefined>;
  findActive(projectId: string, tenantId: string): Promise<ProjectGovernanceRecord | undefined>;
}
export function assertProjectGovernanceRecord(value: unknown): asserts value is ProjectGovernanceRecord {
  plainRecord(value,["projectId","projectVersion","organizationId","tenantId","status","containedScopes","evidenceReferences","createdAt","updatedAt"]);
  requireValue(["projectId","organizationId","tenantId"].every(field => safeText(value[field])) && safeVersion(value["projectVersion"]) && ["PROPOSED","ACTIVE","SUSPENDED","RETIRED"].includes(String(value["status"])));
  assertChronology(value); assertEvidence(value["evidenceReferences"]);
  const scopes: unknown = value["containedScopes"];
  requireValue(Array.isArray(scopes) && scopes.length > 0 && scopes.length <= 256);
  for (const scope of scopes as unknown[]) { plainRecord(scope,["scopeType","scopeId"]); requireValue(["TEAM","POLICY","SOURCE","TARGET"].includes(String(scope["scopeType"])) && safeText(scope["scopeId"])); }
  requireValue(new Set((scopes as unknown[]).map(canonicalJson)).size === scopes.length);
}
export interface AsyncProjectGovernancePersistenceContract extends AsyncProjectGovernanceReadContract {
  createProposed(record: ProjectGovernanceRecord): Promise<ProjectGovernanceRecord>;
  transition(expected: ProjectGovernanceRecord, next: ProjectGovernanceRecord): Promise<ProjectGovernanceRecord>;
  close(): Promise<void>;
}
