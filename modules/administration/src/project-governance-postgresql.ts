import type { PostgreSqlClientPort, PostgreSqlPoolPort } from "../../identity/src/postgresql-pool.js";
import { assertProjectGovernanceRecord, type ProjectGovernanceRecord, type AsyncProjectGovernancePersistenceContract } from "./project-governance.js";
import { assertOrganizationGovernanceRecord, type AsyncOrganizationGovernanceReadContract } from "../../organization/src/organization-governance.js";
import { assertFrozenMatch, canonicalJson, closeLease, decodeColumns, GovernancePersistenceError, lockKeys, newLeaseState, operate, readBoundary, requireValue, safeText, safeVersion } from "../../organization/src/governance-persistence-support.js";
const mapping = {"projectId":"project_id","projectVersion":"project_version","organizationId":"organization_id","tenantId":"tenant_id","status":"status","containedScopes":"contained_scopes","evidenceReferences":"evidence_references","createdAt":"created_at","updatedAt":"updated_at"} as const;
const columns = Object.values(mapping).join(",");
export class PostgreSqlProjectGovernanceStore implements AsyncProjectGovernancePersistenceContract {
  readonly #state = newLeaseState();
  public constructor(private readonly pool: PostgreSqlPoolPort, private readonly organizations: AsyncOrganizationGovernanceReadContract) {
    requireValue(typeof pool?.connect === "function" && typeof organizations?.findActive === "function");
  }
  public close(): Promise<void> { return closeLease(this.#state); }
  public async findVersion(projectId: string, projectVersion: number, tenantId: string): Promise<ProjectGovernanceRecord | undefined> {
    requireValue(safeText(projectId) && safeVersion(projectVersion) && safeText(tenantId));
    return operate(this.pool,this.#state,false,async client => this.select(client,projectId,projectVersion,tenantId));
  }
  public async findActive(projectId: string, tenantId: string): Promise<ProjectGovernanceRecord | undefined> {
    requireValue(safeText(projectId) && safeText(tenantId));
    return operate(this.pool,this.#state,false,async client => {
      const result = await client.query("SELECT "+columns+" FROM app_administration.project_governance_versions WHERE project_id=$1 AND tenant_id=$2 AND status='ACTIVE'",[projectId,tenantId]);
      if (result.rows.length > 1) throw new GovernancePersistenceError("CONFLICT");
      return result.rows[0] ? this.decode(result.rows[0]) : undefined;
    });
  }
  public async createProposed(input: ProjectGovernanceRecord): Promise<ProjectGovernanceRecord> {
    assertProjectGovernanceRecord(input); const record = structuredClone(input); requireValue(record.status === "PROPOSED");
    const replay = await this.findVersion(record.projectId,record.projectVersion,record.tenantId);
    if (replay) { assertFrozenMatch(replay,record,["status","updatedAt"]); return replay; }
    await this.assertOrganization(record);
    return operate(this.pool,this.#state,true,async client => {
      await lockKeys(client,["project:"+record.projectId]);
      const existing = await this.select(client,record.projectId,record.projectVersion,record.tenantId,true);
      if (existing) { assertFrozenMatch(existing,record,["status","updatedAt"]); return existing; }
      await client.query("INSERT INTO app_administration.project_governance_versions ("+columns+") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",[record.projectId,record.projectVersion,record.organizationId,record.tenantId,record.status,JSON.stringify(record.containedScopes),JSON.stringify(record.evidenceReferences),record.createdAt,record.updatedAt]);
      return record;
    });
  }
  public async transition(expectedInput: ProjectGovernanceRecord, nextInput: ProjectGovernanceRecord): Promise<ProjectGovernanceRecord> {
    assertProjectGovernanceRecord(expectedInput); assertProjectGovernanceRecord(nextInput);
    const expected=structuredClone(expectedInput), next=structuredClone(nextInput);
    assertFrozenMatch(expected,next,["status","updatedAt"]);
    const replay = await this.findVersion(expected.projectId,expected.projectVersion,expected.tenantId);
    if (canonicalJson(replay) === canonicalJson(next)) return next;
    if (!replay || canonicalJson(replay) !== canonicalJson(expected)) throw new GovernancePersistenceError("CONFLICT");
    if (next.status === "ACTIVE") await this.assertOrganization(next);
    return operate(this.pool,this.#state,true,async client => {
      await lockKeys(client,["project:"+expected.projectId]);
      const current=await this.select(client,expected.projectId,expected.projectVersion,expected.tenantId,true);
      if (canonicalJson(current) === canonicalJson(next)) return next;
      if (!current || canonicalJson(current) !== canonicalJson(expected)) throw new GovernancePersistenceError("CONFLICT");
      const updated=await client.query("UPDATE app_administration.project_governance_versions SET status=$1,updated_at=$2 WHERE project_id=$3 AND project_version=$4 AND tenant_id=$5 AND status=$6",[next.status,next.updatedAt,expected.projectId,expected.projectVersion,expected.tenantId,expected.status]);
      if (updated.rowCount !== 1) throw new GovernancePersistenceError("CONFLICT");
      return next;
    });
  }
  private async select(client: PostgreSqlClientPort, id: string, version: number, tenant: string, lock=false): Promise<ProjectGovernanceRecord | undefined> {
    const result=await client.query("SELECT "+columns+" FROM app_administration.project_governance_versions WHERE project_id=$1 AND project_version=$2 AND tenant_id=$3"+(lock ? " FOR UPDATE" : ""),[id,version,tenant]);
    if (result.rows.length>1) throw new GovernancePersistenceError("CONFLICT");
    return result.rows[0] ? this.decode(result.rows[0]) : undefined;
  }
  private decode(row: Record<string,unknown>): ProjectGovernanceRecord { const value=decodeColumns(row,mapping); assertProjectGovernanceRecord(value); return value; }
  private async assertOrganization(record: ProjectGovernanceRecord): Promise<void> {
    const parent = await readBoundary(() => this.organizations.findActive(record.organizationId,record.tenantId));
    if (!parent) throw new GovernancePersistenceError("CONFLICT");
    assertOrganizationGovernanceRecord(parent);
    if (parent.organizationId !== record.organizationId || parent.tenantId !== record.tenantId || parent.status !== "ACTIVE") throw new GovernancePersistenceError("CONFLICT");
  }
}
