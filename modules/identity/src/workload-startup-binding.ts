import type { WorkloadBindingScopeType } from "../../administration/src/project-governance.js";
import { assertChronology, plainRecord, requireValue, safeText, safeVersion } from "../../organization/src/governance-persistence-support.js";
export interface WorkloadStartupBindingRecord {
  readonly bindingId: string; readonly bindingVersion: number; readonly registrationId: string; readonly registrationVersion: number;
  readonly tenantId: string; readonly principalId: string; readonly organizationId: string; readonly projectId: string;
  readonly scopeType: WorkloadBindingScopeType; readonly scopeId: string; readonly identityEvidenceRef: string;
  readonly organizationEvidenceRef: string; readonly projectEvidenceRef: string; readonly scopeEvidenceRef: string;
  readonly status: "PROPOSED" | "ACTIVE" | "REVOKED"; readonly auditEvidenceRef: string; readonly createdAt: string; readonly updatedAt: string;
}
// Read/evidence boundary injected by the owning caller; no resolver activation in R3-C1.
export interface WorkloadBindingReferenceVerifier { assertBindingReferences(record: WorkloadStartupBindingRecord): Promise<void> }
export function decodeCanonicalReference(reference: string, prefix: string, identifiers: readonly string[]): number {
  const parts = reference.split(":"); requireValue(parts.length === identifiers.length + 2 && parts[0] === prefix);
  for (let i=0;i<identifiers.length;i++) requireValue(parts[i+1] === encodeURIComponent(identifiers[i]!));
  const last = parts.at(-1)!; const version = Number(last);
  requireValue(safeVersion(version) && String(version) === last); return version;
}
export function assertWorkloadStartupBindingRecord(value: unknown): asserts value is WorkloadStartupBindingRecord {
  const textFields = ["bindingId","registrationId","tenantId","principalId","organizationId","projectId","scopeId","identityEvidenceRef","organizationEvidenceRef","projectEvidenceRef","scopeEvidenceRef","auditEvidenceRef"];
  plainRecord(value,[...textFields,"bindingVersion","registrationVersion","scopeType","status","createdAt","updatedAt"]);
  requireValue(textFields.every(field => safeText(value[field])) && safeVersion(value["bindingVersion"]) && safeVersion(value["registrationVersion"]) && ["PROPOSED","ACTIVE","REVOKED"].includes(String(value["status"])));
  const types: Readonly<Record<string,string>> = { TEAM: "TEAM_SCOPE", POLICY: "POLICY", SOURCE: "SOURCE_REGISTRY", TARGET: "PUBLICATION_TARGET" };
  requireValue(typeof value["scopeType"] === "string" && Object.hasOwn(types,value["scopeType"]));
  assertChronology(value);
  decodeCanonicalReference(String(value["organizationEvidenceRef"]),"organization-governance",[String(value["organizationId"])]);
  decodeCanonicalReference(String(value["projectEvidenceRef"]),"project-governance",[String(value["projectId"])]);
  decodeCanonicalReference(String(value["scopeEvidenceRef"]),"administration-scope",[String(value["tenantId"]),types[value["scopeType"]]!,String(value["scopeId"])]);
}
export interface AsyncWorkloadStartupBindingPersistenceContract {
  findVersion(bindingId: string, bindingVersion: number, tenantId: string): Promise<WorkloadStartupBindingRecord | undefined>;
  findActive(registrationId: string, registrationVersion: number, tenantId: string, principalId: string): Promise<WorkloadStartupBindingRecord | undefined>;
  createProposed(record: WorkloadStartupBindingRecord): Promise<WorkloadStartupBindingRecord>;
  transition(expected: WorkloadStartupBindingRecord, next: WorkloadStartupBindingRecord): Promise<WorkloadStartupBindingRecord>;
  replaceActive(expected: WorkloadStartupBindingRecord, proposed: WorkloadStartupBindingRecord, auditEvidenceRef: string, updatedAt: string): Promise<WorkloadStartupBindingRecord>;
  close(): Promise<void>;
}
