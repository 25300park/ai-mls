import { assertChronology, assertEvidence, plainRecord, requireValue, safeText, safeVersion, type GovernanceEvidenceReference, type GovernanceLifecycle } from "./governance-persistence-support.js";
export interface OrganizationGovernanceRecord {
  readonly organizationId: string; readonly organizationVersion: number; readonly tenantId: string;
  readonly status: GovernanceLifecycle; readonly evidenceReferences: readonly GovernanceEvidenceReference[];
  readonly createdAt: string; readonly updatedAt: string;
}
export interface AsyncOrganizationGovernanceReadContract {
  findVersion(organizationId: string, organizationVersion: number, tenantId: string): Promise<OrganizationGovernanceRecord | undefined>;
  findActive(organizationId: string, tenantId: string): Promise<OrganizationGovernanceRecord | undefined>;
}
export function assertOrganizationGovernanceRecord(value: unknown): asserts value is OrganizationGovernanceRecord {
  plainRecord(value,["organizationId","organizationVersion","tenantId","status","evidenceReferences","createdAt","updatedAt"]);
  requireValue(safeText(value["organizationId"]) && safeVersion(value["organizationVersion"]) && safeText(value["tenantId"]) && ["PROPOSED","ACTIVE","SUSPENDED","RETIRED"].includes(String(value["status"])));
  assertChronology(value); assertEvidence(value["evidenceReferences"]);
}
export interface AsyncOrganizationGovernancePersistenceContract extends AsyncOrganizationGovernanceReadContract {
  createProposed(record: OrganizationGovernanceRecord): Promise<OrganizationGovernanceRecord>;
  transition(expected: OrganizationGovernanceRecord, next: OrganizationGovernanceRecord): Promise<OrganizationGovernanceRecord>;
  close(): Promise<void>;
}
