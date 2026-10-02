import type { PostgreSqlClientPort, PostgreSqlPoolPort } from "./postgresql-pool.js";
import { assertWorkloadStartupBindingRecord, type AsyncWorkloadStartupBindingPersistenceContract, type WorkloadBindingReferenceVerifier, type WorkloadStartupBindingRecord } from "./workload-startup-binding.js";
import { assertFrozenMatch, canonicalJson, closeLease, decodeColumns, GovernancePersistenceError, lockKeys, newLeaseState, operate, readBoundary, requireValue, safeText, safeVersion } from "../../organization/src/governance-persistence-support.js";
const mapping = { bindingId:"binding_id",bindingVersion:"binding_version",registrationId:"registration_id",registrationVersion:"registration_version",tenantId:"tenant_id",principalId:"principal_id",organizationId:"organization_id",projectId:"project_id",scopeType:"scope_type",scopeId:"scope_id",identityEvidenceRef:"identity_evidence_ref",organizationEvidenceRef:"organization_evidence_ref",projectEvidenceRef:"project_evidence_ref",scopeEvidenceRef:"scope_evidence_ref",status:"status",auditEvidenceRef:"audit_evidence_ref",createdAt:"created_at",updatedAt:"updated_at" } as const;
const columns = Object.values(mapping).join(",");
const mutable = ["status","auditEvidenceRef","updatedAt"];
export class PostgreSqlWorkloadStartupBindingStore implements AsyncWorkloadStartupBindingPersistenceContract {
  readonly #state = newLeaseState();
  public constructor(private readonly pool: PostgreSqlPoolPort, private readonly references: WorkloadBindingReferenceVerifier) { requireValue(typeof pool?.connect === "function" && typeof references?.assertBindingReferences === "function"); }
  public close(): Promise<void> { return closeLease(this.#state); }
  public async findVersion(bindingId: string, bindingVersion: number, tenantId: string): Promise<WorkloadStartupBindingRecord | undefined> {
    requireValue(safeText(bindingId) && safeVersion(bindingVersion) && safeText(tenantId));
    return operate(this.pool,this.#state,false,async client => this.select(client,bindingId,bindingVersion,tenantId));
  }
  public async findActive(registrationId: string, registrationVersion: number, tenantId: string, principalId: string): Promise<WorkloadStartupBindingRecord | undefined> {
    requireValue(safeText(registrationId) && safeVersion(registrationVersion) && safeText(tenantId) && safeText(principalId));
    return operate(this.pool,this.#state,false,async client => {
      const result = await client.query(`SELECT ${columns} FROM app_identity.workload_startup_binding_versions WHERE registration_id=$1 AND registration_version=$2 AND status='ACTIVE'`,[registrationId,registrationVersion]);
      if (result.rows.length>1) throw new GovernancePersistenceError("CONFLICT");
      if (!result.rows[0]) return undefined;
      const record = this.decode(result.rows[0]);
      if (record.tenantId !== tenantId || record.principalId !== principalId) throw new GovernancePersistenceError("CONFLICT");
      return record;
    });
  }
  public async createProposed(input: WorkloadStartupBindingRecord): Promise<WorkloadStartupBindingRecord> {
    assertWorkloadStartupBindingRecord(input); const record=structuredClone(input); requireValue(record.status === "PROPOSED");
    const replay=await this.findVersion(record.bindingId,record.bindingVersion,record.tenantId);
    if (replay) { assertFrozenMatch(replay,record,mutable); return replay; }
    await readBoundary(() => this.references.assertBindingReferences(structuredClone(record)));
    return operate(this.pool,this.#state,true,async client => {
      await lockKeys(client,this.keys(record));
      const existing=await this.select(client,record.bindingId,record.bindingVersion,record.tenantId,true);
      if (existing) { assertFrozenMatch(existing,record,mutable); return existing; }
      await this.insert(client,record); return record;
    });
  }
  public async transition(expectedInput: WorkloadStartupBindingRecord, nextInput: WorkloadStartupBindingRecord): Promise<WorkloadStartupBindingRecord> {
    assertWorkloadStartupBindingRecord(expectedInput); assertWorkloadStartupBindingRecord(nextInput);
    const expected=structuredClone(expectedInput),next=structuredClone(nextInput); assertFrozenMatch(expected,next,mutable);
    const replay=await this.findVersion(expected.bindingId,expected.bindingVersion,expected.tenantId);
    if (canonicalJson(replay) === canonicalJson(next)) return next;
    if (!replay || canonicalJson(replay) !== canonicalJson(expected)) throw new GovernancePersistenceError("CONFLICT");
    if (next.status === "ACTIVE") await readBoundary(() => this.references.assertBindingReferences(structuredClone(next)));
    return operate(this.pool,this.#state,true,async client => {
      await lockKeys(client,this.keys(expected));
      const current=await this.select(client,expected.bindingId,expected.bindingVersion,expected.tenantId,true);
      if (canonicalJson(current) === canonicalJson(next)) return next;
      if (!current || canonicalJson(current) !== canonicalJson(expected)) throw new GovernancePersistenceError("CONFLICT");
      await this.update(client,expected,next); return next;
    });
  }
  public async replaceActive(expectedInput: WorkloadStartupBindingRecord, proposedInput: WorkloadStartupBindingRecord, auditEvidenceRef: string, updatedAt: string): Promise<WorkloadStartupBindingRecord> {
    assertWorkloadStartupBindingRecord(expectedInput); assertWorkloadStartupBindingRecord(proposedInput);
    const expected=structuredClone(expectedInput),proposed=structuredClone(proposedInput);
    requireValue(expected.status === "ACTIVE" && proposed.status === "PROPOSED" && proposed.bindingId === expected.bindingId && proposed.bindingVersion>expected.bindingVersion && proposed.registrationId === expected.registrationId && proposed.registrationVersion === expected.registrationVersion && proposed.tenantId === expected.tenantId && proposed.principalId === expected.principalId);
    const revoked: WorkloadStartupBindingRecord={...expected,status:"REVOKED",auditEvidenceRef,updatedAt};
    const activated: WorkloadStartupBindingRecord={...proposed,status:"ACTIVE",auditEvidenceRef,updatedAt};
    assertWorkloadStartupBindingRecord(revoked); assertWorkloadStartupBindingRecord(activated);
    const replayCurrent=await this.findVersion(expected.bindingId,expected.bindingVersion,expected.tenantId);
    const replayReplacement=await this.findVersion(proposed.bindingId,proposed.bindingVersion,proposed.tenantId);
    if (canonicalJson(replayCurrent) === canonicalJson(revoked) && canonicalJson(replayReplacement) === canonicalJson(activated)) return activated;
    if (canonicalJson(replayCurrent) !== canonicalJson(expected) || (replayReplacement && canonicalJson(replayReplacement) !== canonicalJson(proposed))) throw new GovernancePersistenceError("CONFLICT");
    await readBoundary(() => this.references.assertBindingReferences(structuredClone(activated)));
    return operate(this.pool,this.#state,true,async client => {
      await lockKeys(client,[...this.keys(expected),...this.keys(proposed)]);
      const current=await this.select(client,expected.bindingId,expected.bindingVersion,expected.tenantId,true);
      const replacement=await this.select(client,proposed.bindingId,proposed.bindingVersion,proposed.tenantId,true);
      if (canonicalJson(current) === canonicalJson(revoked) && canonicalJson(replacement) === canonicalJson(activated)) return activated;
      if (canonicalJson(current) !== canonicalJson(expected) || (replacement && canonicalJson(replacement) !== canonicalJson(proposed))) throw new GovernancePersistenceError("CONFLICT");
      if (!replacement) await this.insert(client,proposed);
      await this.update(client,expected,revoked); await this.update(client,proposed,activated);
      return activated;
    });
  }
  private keys(record: WorkloadStartupBindingRecord): readonly string[] { return [`binding:${record.bindingId}`,`registration:${record.registrationId}:${record.registrationVersion}`]; }
  private async select(client: PostgreSqlClientPort, id: string, version: number, tenant: string, lock=false): Promise<WorkloadStartupBindingRecord | undefined> {
    const result=await client.query(`SELECT ${columns} FROM app_identity.workload_startup_binding_versions WHERE binding_id=$1 AND binding_version=$2 AND tenant_id=$3${lock ? " FOR UPDATE" : ""}`,[id,version,tenant]);
    if (result.rows.length>1) throw new GovernancePersistenceError("CONFLICT");
    return result.rows[0] ? this.decode(result.rows[0]) : undefined;
  }
  private async insert(client: PostgreSqlClientPort, record: WorkloadStartupBindingRecord): Promise<void> {
    await client.query(`INSERT INTO app_identity.workload_startup_binding_versions (${columns}) VALUES (${Object.keys(mapping).map((_,i)=>`$${i+1}`).join(",")})`,Object.keys(mapping).map(field=>record[field as keyof WorkloadStartupBindingRecord]));
  }
  private async update(client: PostgreSqlClientPort, expected: WorkloadStartupBindingRecord, next: WorkloadStartupBindingRecord): Promise<void> {
    const result=await client.query("UPDATE app_identity.workload_startup_binding_versions SET status=$1,audit_evidence_ref=$2,updated_at=$3 WHERE binding_id=$4 AND binding_version=$5 AND tenant_id=$6 AND status=$7",[next.status,next.auditEvidenceRef,next.updatedAt,expected.bindingId,expected.bindingVersion,expected.tenantId,expected.status]);
    if (result.rowCount !== 1) throw new GovernancePersistenceError("CONFLICT");
  }
  private decode(row: Record<string,unknown>): WorkloadStartupBindingRecord { const record=decodeColumns(row,mapping); assertWorkloadStartupBindingRecord(record); return record; }
}
