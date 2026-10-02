import type { PostgreSqlClientPort, PostgreSqlPoolPort } from "../../identity/src/postgresql-pool.js";
import { assertOrganizationGovernanceRecord, type OrganizationGovernanceRecord, type AsyncOrganizationGovernancePersistenceContract } from "./organization-governance.js";

import { assertFrozenMatch, canonicalJson, closeLease, decodeColumns, GovernancePersistenceError, lockKeys, newLeaseState, operate, requireValue, safeText, safeVersion } from "./governance-persistence-support.js";
const mapping = {"organizationId":"organization_id","organizationVersion":"organization_version","tenantId":"tenant_id","status":"status","evidenceReferences":"evidence_references","createdAt":"created_at","updatedAt":"updated_at"} as const;
const columns = Object.values(mapping).join(",");
export class PostgreSqlOrganizationGovernanceStore implements AsyncOrganizationGovernancePersistenceContract {
  readonly #state = newLeaseState();
  public constructor(private readonly pool: PostgreSqlPoolPort) {
    requireValue(typeof pool?.connect === "function");
  }
  public close(): Promise<void> { return closeLease(this.#state); }
  public async findVersion(organizationId: string, organizationVersion: number, tenantId: string): Promise<OrganizationGovernanceRecord | undefined> {
    requireValue(safeText(organizationId) && safeVersion(organizationVersion) && safeText(tenantId));
    return operate(this.pool,this.#state,false,async client => this.select(client,organizationId,organizationVersion,tenantId));
  }
  public async findActive(organizationId: string, tenantId: string): Promise<OrganizationGovernanceRecord | undefined> {
    requireValue(safeText(organizationId) && safeText(tenantId));
    return operate(this.pool,this.#state,false,async client => {
      const result = await client.query("SELECT "+columns+" FROM app_organization.organization_governance_versions WHERE organization_id=$1 AND tenant_id=$2 AND status='ACTIVE'",[organizationId,tenantId]);
      if (result.rows.length > 1) throw new GovernancePersistenceError("CONFLICT");
      return result.rows[0] ? this.decode(result.rows[0]) : undefined;
    });
  }
  public async createProposed(input: OrganizationGovernanceRecord): Promise<OrganizationGovernanceRecord> {
    assertOrganizationGovernanceRecord(input); const record = structuredClone(input); requireValue(record.status === "PROPOSED");

    return operate(this.pool,this.#state,true,async client => {
      await lockKeys(client,["organization:"+record.organizationId]);
      const existing = await this.select(client,record.organizationId,record.organizationVersion,record.tenantId,true);
      if (existing) { assertFrozenMatch(existing,record,["status","updatedAt"]); return existing; }
      await client.query("INSERT INTO app_organization.organization_governance_versions ("+columns+") VALUES ($1,$2,$3,$4,$5,$6,$7)",[record.organizationId,record.organizationVersion,record.tenantId,record.status,JSON.stringify(record.evidenceReferences),record.createdAt,record.updatedAt]);
      return record;
    });
  }
  public async transition(expectedInput: OrganizationGovernanceRecord, nextInput: OrganizationGovernanceRecord): Promise<OrganizationGovernanceRecord> {
    assertOrganizationGovernanceRecord(expectedInput); assertOrganizationGovernanceRecord(nextInput);
    const expected=structuredClone(expectedInput), next=structuredClone(nextInput);
    assertFrozenMatch(expected,next,["status","updatedAt"]);

    return operate(this.pool,this.#state,true,async client => {
      await lockKeys(client,["organization:"+expected.organizationId]);
      const current=await this.select(client,expected.organizationId,expected.organizationVersion,expected.tenantId,true);
      if (canonicalJson(current) === canonicalJson(next)) return next;
      if (!current || canonicalJson(current) !== canonicalJson(expected)) throw new GovernancePersistenceError("CONFLICT");
      const updated=await client.query("UPDATE app_organization.organization_governance_versions SET status=$1,updated_at=$2 WHERE organization_id=$3 AND organization_version=$4 AND tenant_id=$5 AND status=$6",[next.status,next.updatedAt,expected.organizationId,expected.organizationVersion,expected.tenantId,expected.status]);
      if (updated.rowCount !== 1) throw new GovernancePersistenceError("CONFLICT");
      return next;
    });
  }
  private async select(client: PostgreSqlClientPort, id: string, version: number, tenant: string, lock=false): Promise<OrganizationGovernanceRecord | undefined> {
    const result=await client.query("SELECT "+columns+" FROM app_organization.organization_governance_versions WHERE organization_id=$1 AND organization_version=$2 AND tenant_id=$3"+(lock ? " FOR UPDATE" : ""),[id,version,tenant]);
    if (result.rows.length>1) throw new GovernancePersistenceError("CONFLICT");
    return result.rows[0] ? this.decode(result.rows[0]) : undefined;
  }
  private decode(row: Record<string,unknown>): OrganizationGovernanceRecord { const value=decodeColumns(row,mapping); assertOrganizationGovernanceRecord(value); return value; }

}
