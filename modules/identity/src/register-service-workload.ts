import { PostgreSqlAuditEvidenceStore, assertAuditEvidence, type AuditEvidenceReadRecord } from "../../audit/src/audit-evidence-read-postgresql.js";
import { canonicalJson, safeText, safeVersion, validInstant } from "../../organization/src/governance-persistence-support.js";
import type { PostgreSqlClientPort, PostgreSqlPoolPort } from "./postgresql-pool.js";
import { registrationOperatorAclReady } from "./registration-operator-acl.js";

export const REGISTRATION_OPERATOR = "ai_mls_production_registration_operator";
export const REGISTRATION_DATABASE_TARGET = Object.freeze({ host: "db.mfonujjeokvpsfucfxuq.supabase.co", database: "postgres", projectRef: "mfonujjeokvpsfucfxuq", region: "ap-southeast-1" });
export interface ProductionWorkloadRegistrationManifestV1 {
  readonly schemaVersion: 1;
  readonly registrationId: string;
  readonly registrationVersion: number;
  readonly tenantId: string;
  readonly principalId: string;
  readonly environment: "PRODUCTION";
  readonly purpose: "AI_MLS_PRODUCTION_API_RUNTIME";
  readonly audience: "ai-mls-api";
  readonly scopeRef: string;
  readonly identityEvidenceRef: string;
  readonly auditEvidenceRef: string;
  readonly expectedDatabaseTarget: typeof REGISTRATION_DATABASE_TARGET;
  readonly expectedExecutionRole: typeof REGISTRATION_OPERATOR;
  readonly expectedWrites: 3;
  readonly timestampPolicy: "GENERATED_AT_EXECUTION";
}
export class RegistrationCommandError extends Error {
  public constructor(public readonly code: "INPUT_INVALID" | "CONFLICT" | "UNAVAILABLE") { super(`Registration command: ${code}`); this.name = "RegistrationCommandError"; }
}
function demand(condition: unknown, code: "INPUT_INVALID" | "CONFLICT" | "UNAVAILABLE" = "INPUT_INVALID"): asserts condition { if (!condition) throw new RegistrationCommandError(code); }
function exactObject(value: unknown, fields: readonly string[]): asserts value is Record<string, unknown> {
  demand(value !== null && typeof value === "object" && !Array.isArray(value));
  demand(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  demand(Reflect.ownKeys(value).length === fields.length && fields.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor !== undefined && "value" in descriptor && descriptor.enumerable;
  }));
}
export function parseRegistrationManifest(input: unknown): Readonly<ProductionWorkloadRegistrationManifestV1> {
  const fields = ["schemaVersion","registrationId","registrationVersion","tenantId","principalId","environment","purpose","audience","scopeRef","identityEvidenceRef","auditEvidenceRef","expectedDatabaseTarget","expectedExecutionRole","expectedWrites","timestampPolicy"];
  exactObject(input, fields);
  demand(["registrationId","tenantId","principalId","identityEvidenceRef","auditEvidenceRef"].every(key => safeText(input[key])));
  demand(["registrationId","tenantId","principalId","identityEvidenceRef","auditEvidenceRef"].every(key => !/postgres(?:ql)?:\/\/|-----BEGIN .*PRIVATE KEY|(?:password|token|secret)=/iu.test(String(input[key]))));
  demand(safeVersion(input["registrationVersion"]) && input["schemaVersion"] === 1 && input["environment"] === "PRODUCTION"
    && input["purpose"] === "AI_MLS_PRODUCTION_API_RUNTIME" && input["audience"] === "ai-mls-api"
    && input["expectedExecutionRole"] === REGISTRATION_OPERATOR && input["expectedWrites"] === 3 && input["timestampPolicy"] === "GENERATED_AT_EXECUTION");
  demand(safeText(input["scopeRef"]) && input["scopeRef"] === `registered-service-workload:${String(input["registrationId"])}:${String(input["registrationVersion"])}`);
  exactObject(input["expectedDatabaseTarget"], Object.keys(REGISTRATION_DATABASE_TARGET));
  demand(canonicalJson(input["expectedDatabaseTarget"]) === canonicalJson(REGISTRATION_DATABASE_TARGET));
  return Object.freeze({ ...input, expectedDatabaseTarget: REGISTRATION_DATABASE_TARGET }) as unknown as Readonly<ProductionWorkloadRegistrationManifestV1>;
}
export interface RegistrationResult { readonly mode: "DRY_RUN" | "EXECUTE"; readonly result: "CREATED" | "NO_OP" | "VALIDATED"; readonly expectedWrites: 3; readonly actualWrites: 0 | 3 }
const tables = ["app_identity.identity_registered_service_workloads","app_identity.identity_workload_evidence","app_audit.audit_evidence_read_records"];
const registrationColumns = "registration_id,tenant_id,principal_id,principal_type,assurance,environment,status,workload_purpose,audience,registration_version,identity_evidence_ref,audit_evidence_ref,created_at,updated_at";

/** Identity-owned one-shot transaction. Pool ownership stays with the runner. */
export class RegisterServiceWorkloadCommand {
  private quarantined = false;
  private readonly audit: PostgreSqlAuditEvidenceStore;
  public constructor(private readonly pool: PostgreSqlPoolPort, private readonly clock: () => Date = () => new Date()) { this.audit = new PostgreSqlAuditEvidenceStore(pool); }
  public async run(input: unknown, mode: "DRY_RUN" | "EXECUTE"): Promise<RegistrationResult> {
    const manifest = parseRegistrationManifest(input);
    demand(mode === "DRY_RUN" || mode === "EXECUTE");
    demand(!this.quarantined, "UNAVAILABLE");
    let client: PostgreSqlClientPort | undefined; let begun = false, commitStarted = false, discard = false;
    try {
      client = await this.pool.connect();
      const identity = (await client.query("SELECT current_user,session_user,current_database() AS database")).rows[0];
      demand(identity?.["current_user"] === REGISTRATION_OPERATOR && identity["session_user"] === REGISTRATION_OPERATOR && identity["database"] === manifest.expectedDatabaseTarget.database, "UNAVAILABLE");
      demand(await registrationOperatorAclReady(client), "UNAVAILABLE");
      for (const schema of ["app_identity","app_audit"]) {
        const acl = (await client.query("SELECT has_schema_privilege(current_user,$1,'USAGE') AS use,has_schema_privilege(current_user,$1,'CREATE') AS create", [schema])).rows[0];
        demand(acl?.["use"] === true && acl["create"] === false, "UNAVAILABLE");
      }
      for (const table of tables) {
        const acl = (await client.query("SELECT has_table_privilege(current_user,$1,'SELECT') AS read,has_table_privilege(current_user,$1,'INSERT') AS insert,has_table_privilege(current_user,$1,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS forbidden", [table])).rows[0];
        demand(acl?.["read"] === true && acl["insert"] === true && acl["forbidden"] === false, "UNAVAILABLE");
      }
      await client.query(mode === "DRY_RUN" ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN"); begun = true;
      if (mode === "EXECUTE") await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`registration:${manifest.registrationId}`]);
      const replay = await this.inspect(client, manifest);
      let actualWrites: 0 | 3 = 0;
      if (!replay && mode === "EXECUTE") {
        const occurredAt = this.clock().toISOString(); demand(validInstant(occurredAt));
        await client.query(`INSERT INTO ${tables[0]} (${registrationColumns}) VALUES ($1,$2,$3,'SERVICE','WORKLOAD','PRODUCTION','ACTIVE',$4,$5,$6,$7,$8,$9,$9)`, [manifest.registrationId,manifest.tenantId,manifest.principalId,manifest.purpose,manifest.audience,manifest.registrationVersion,manifest.identityEvidenceRef,manifest.auditEvidenceRef,occurredAt]);
        await client.query(`INSERT INTO ${tables[1]} (identity_evidence_ref,registration_id,registration_version,tenant_id,principal_id,schema_version,immutable) VALUES ($1,$2,$3,$4,$5,1,true)`, [manifest.identityEvidenceRef,manifest.registrationId,manifest.registrationVersion,manifest.tenantId,manifest.principalId]);
        const materializedAt = this.clock().toISOString(); demand(validInstant(materializedAt) && materializedAt >= occurredAt);
        await this.audit.materializeRegistrationOnClient(client, this.event(manifest, occurredAt, materializedAt));
        demand(await this.inspect(client, manifest), "CONFLICT"); actualWrites = 3;
      }
      commitStarted = true; await client.query("COMMIT"); begun = false;
      return Object.freeze({ mode, result: replay ? "NO_OP" : mode === "DRY_RUN" ? "VALIDATED" : "CREATED", expectedWrites: 3, actualWrites });
    } catch (error) {
      if (commitStarted) { discard = true; this.quarantined = true; }
      else if (begun && client) { try { await client.query("ROLLBACK"); } catch { discard = true; this.quarantined = true; } }
      if (error instanceof RegistrationCommandError) throw error;
      const descriptor = error !== null && typeof error === "object" ? Object.getOwnPropertyDescriptor(error, "code") : undefined;
      const code: unknown = descriptor && "value" in descriptor ? descriptor.value : undefined;
      if (typeof code === "string" && /^(235|55000)/u.test(code)) throw new RegistrationCommandError("CONFLICT");
      discard = true; throw new RegistrationCommandError("UNAVAILABLE");
    } finally { if (client) { try { client.release(discard); } catch { this.quarantined = true; throw new RegistrationCommandError("UNAVAILABLE"); } } }
  }
  private event(m: ProductionWorkloadRegistrationManifestV1, occurredAt: string, materializedAt: string): AuditEvidenceReadRecord {
    return { auditEvidenceRef:m.auditEvidenceRef,sourceDomain:"IDENTITY",aggregateType:"REGISTERED_SERVICE_WORKLOAD",aggregateId:m.registrationId,aggregateVersion:m.registrationVersion,eventType:"REGISTERED_SERVICE_WORKLOAD.REGISTERED",payloadSchemaVersion:1,final:true,tenantId:m.tenantId,scopeRef:m.scopeRef,payload:{registrationId:m.registrationId,registrationVersion:m.registrationVersion,tenantId:m.tenantId,principalId:m.principalId,principalType:"SERVICE",assurance:"WORKLOAD",environment:"PRODUCTION"},occurredAt,materializedAt };
  }
  private async inspect(client: PostgreSqlClientPort, m: ProductionWorkloadRegistrationManifestV1): Promise<boolean> {
    const reg = await client.query(`SELECT ${registrationColumns} FROM ${tables[0]} WHERE registration_id=$1 OR (tenant_id=$2 AND principal_id=$3)`, [m.registrationId,m.tenantId,m.principalId]);
    const proof = await client.query(`SELECT * FROM ${tables[1]} WHERE identity_evidence_ref=$1`, [m.identityEvidenceRef]);
    const event = await client.query(`SELECT * FROM ${tables[2]} WHERE audit_evidence_ref=$1`, [m.auditEvidenceRef]);
    if (reg.rows.length === 0 && proof.rows.length === 0 && event.rows.length === 0) return false;
    demand(reg.rows.length === 1 && proof.rows.length === 1 && event.rows.length === 1, "CONFLICT");
    const r = reg.rows[0]!, p = proof.rows[0]!, a = event.rows[0]!;
    const expected = { registration_id:m.registrationId,tenant_id:m.tenantId,principal_id:m.principalId,principal_type:"SERVICE",assurance:"WORKLOAD",environment:"PRODUCTION",status:"ACTIVE",workload_purpose:m.purpose,audience:m.audience,registration_version:String(m.registrationVersion),identity_evidence_ref:m.identityEvidenceRef,audit_evidence_ref:m.auditEvidenceRef };
    demand(Object.entries(expected).every(([key,value]) => String(r[key]) === value), "CONFLICT");
    const instant = (value: unknown): string => value instanceof Date ? value.toISOString() : String(value);
    const occurredAt = instant(r["created_at"]); demand(validInstant(occurredAt) && instant(r["updated_at"]) === occurredAt, "CONFLICT");
    demand(p["registration_id"] === m.registrationId && Number(p["registration_version"]) === m.registrationVersion && p["tenant_id"] === m.tenantId && p["principal_id"] === m.principalId && p["schema_version"] === 1 && p["immutable"] === true, "CONFLICT");
    const auditRecord = { auditEvidenceRef:a["audit_evidence_ref"],sourceDomain:a["source_domain"],aggregateType:a["aggregate_type"],aggregateId:a["aggregate_id"],aggregateVersion:Number(a["aggregate_version"]),eventType:a["event_type"],payloadSchemaVersion:a["payload_schema_version"],final:a["final"],tenantId:a["tenant_id"],scopeRef:a["scope_ref"],payload:a["payload"],occurredAt:instant(a["occurred_at"]),materializedAt:instant(a["materialized_at"]) };
    assertAuditEvidence(auditRecord);
    demand(canonicalJson(auditRecord) === canonicalJson(this.event(m,occurredAt,auditRecord.materializedAt)), "CONFLICT");
    return true;
  }
}
