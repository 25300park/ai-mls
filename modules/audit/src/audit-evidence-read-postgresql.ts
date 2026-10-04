import { plainRecord, requireValue, safeText, safeVersion, validInstant } from "../../organization/src/governance-persistence-support.js";
export interface AuditEvidenceReadRecord {
  readonly auditEvidenceRef: string;
  readonly sourceDomain: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly eventType: string;
  readonly payloadSchemaVersion: 1 | 2;
  readonly final: true;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
  readonly materializedAt: string;
}
const registrationFields = ["registrationId", "registrationVersion", "tenantId", "principalId", "principalType", "assurance", "environment"];
const tuple = ["bindingId", "bindingVersion", "registrationId", "registrationVersion", "tenantId", "principalId"];
const activation = [...tuple, "organizationId", "projectId", "scopeType", "scopeId", "status"];
export function assertAuditEvidence(value: unknown): asserts value is AuditEvidenceReadRecord {
  plainRecord(value, ["auditEvidenceRef", "sourceDomain", "aggregateType", "aggregateId", "aggregateVersion", "eventType", "payloadSchemaVersion", "final", "tenantId", "scopeRef", "payload", "occurredAt", "materializedAt"]);
  requireValue(["auditEvidenceRef", "sourceDomain", "aggregateType", "aggregateId", "eventType", "tenantId", "scopeRef"].every(field => safeText(value[field])));
  requireValue(safeVersion(value["aggregateVersion"]) && (value["payloadSchemaVersion"] === 1 || value["payloadSchemaVersion"] === 2) && value["final"] === true);
  requireValue(validInstant(value["occurredAt"]) && validInstant(value["materializedAt"]) && value["materializedAt"] >= value["occurredAt"]);
  requireValue(value["sourceDomain"] === "IDENTITY");
  if (value["aggregateType"] === "REGISTERED_SERVICE_WORKLOAD") {
    requireValue(value["eventType"] === "REGISTERED_SERVICE_WORKLOAD.REGISTERED" && value["payloadSchemaVersion"] === 1);
    const payload = value["payload"];
    plainRecord(payload, registrationFields);
    requireValue(["registrationId", "tenantId", "principalId"].every(field => safeText(payload[field])) && safeVersion(payload["registrationVersion"]));
    requireValue(payload["principalType"] === "SERVICE" && payload["assurance"] === "WORKLOAD" && payload["environment"] === "PRODUCTION");
    requireValue(payload["registrationId"] === value["aggregateId"] && payload["registrationVersion"] === value["aggregateVersion"] && payload["tenantId"] === value["tenantId"]);
    return;
  }
  requireValue(value["aggregateType"] === "WORKLOAD_STARTUP_BINDING");
  requireValue(value["eventType"] === "WORKLOAD_STARTUP_BINDING.ACTIVATED" || value["eventType"] === "WORKLOAD_STARTUP_BINDING.REVOKED");
  const payload = value["payload"];
  const active = value["eventType"] === "WORKLOAD_STARTUP_BINDING.ACTIVATED";
  requireValue(payload !== null && typeof payload === "object" && !Array.isArray(payload));
  const hasReplacement = Object.hasOwn(payload, "replacementBindingId") || Object.hasOwn(payload, "replacementBindingVersion");
  requireValue(active || value["payloadSchemaVersion"] === 1);
  const teamFields = active && value["payloadSchemaVersion"] === 2 ? ["authorizationTeamId"] : [];
  plainRecord(payload, active ? [...activation,...teamFields] : [...tuple, "status", ...(hasReplacement ? ["replacementBindingId", "replacementBindingVersion"] : [])]);
  requireValue(tuple.filter(field => !field.endsWith("Version")).every(field => safeText(payload[field])));
  requireValue(safeVersion(payload["bindingVersion"]) && safeVersion(payload["registrationVersion"]));
  requireValue(payload["bindingId"] === value["aggregateId"] && payload["bindingVersion"] === value["aggregateVersion"] && payload["tenantId"] === value["tenantId"]);
  requireValue(payload["status"] === (active ? "ACTIVE" : "REVOKED"));
  requireValue(teamFields.every(field=>safeText(payload[field])));
  if (active) requireValue(["organizationId", "projectId", "scopeId"].every(field => safeText(payload[field])) && ["TEAM", "POLICY", "SOURCE", "TARGET"].includes(String(payload["scopeType"])));
  if (hasReplacement) requireValue(!active && safeText(payload["replacementBindingId"]) && safeVersion(payload["replacementBindingVersion"]));
}
export function assertBindingAuditEvidence(value: unknown, binding: Readonly<Record<string, unknown>>): asserts value is AuditEvidenceReadRecord {
  assertAuditEvidence(value);
  requireValue(value.aggregateType === "WORKLOAD_STARTUP_BINDING" && value.auditEvidenceRef === binding["auditEvidenceRef"]);
  if (value.eventType === "WORKLOAD_STARTUP_BINDING.ACTIVATED" && Object.hasOwn(binding,"authorizationTeamId")) requireValue(value.payloadSchemaVersion === 2 && safeText(binding["authorizationTeamId"]) && value.payload["authorizationTeamId"] === binding["authorizationTeamId"]);
  for (const field of value.eventType === "WORKLOAD_STARTUP_BINDING.ACTIVATED" ? activation : [...tuple, "status"]) requireValue(value.payload[field] === binding[field]);
}

import type { PostgreSqlClientPort, PostgreSqlPoolPort } from "../../identity/src/postgresql-pool.js";
import { canonicalJson, closeLease, GovernancePersistenceError, lockKeys, newLeaseState, operate } from "../../organization/src/governance-persistence-support.js";
const columns = "audit_evidence_ref,source_domain,aggregate_type,aggregate_id,aggregate_version,event_type,payload_schema_version,final,tenant_id,scope_ref,payload,occurred_at,materialized_at";
export interface AuditEvidenceTransactionParticipant {
  materializeOnClient(client: PostgreSqlClientPort, record: AuditEvidenceReadRecord): Promise<AuditEvidenceReadRecord>;
}
export class PostgreSqlAuditEvidenceStore implements AuditEvidenceTransactionParticipant {
  readonly #state = newLeaseState();
  public constructor(private readonly pool: PostgreSqlPoolPort) { requireValue(typeof pool?.connect === "function"); }
  public close(): Promise<void> { return closeLease(this.#state); }
  public async findByEvidenceRef(auditEvidenceRef: string): Promise<AuditEvidenceReadRecord | undefined> {
    requireValue(safeText(auditEvidenceRef));
    return operate(this.pool, this.#state, false, client => this.select(client, auditEvidenceRef));
  }
  public async materialize(input: AuditEvidenceReadRecord): Promise<AuditEvidenceReadRecord> {
    assertAuditEvidence(input);
    const record = structuredClone(input);
    return operate(this.pool, this.#state, true, async client => {
      await lockKeys(client, [`audit-evidence:${record.auditEvidenceRef}`]);
      return this.materializeOnClient(client, record);
    });
  }
  // Audit owns validation and INSERT; the caller owns BEGIN/COMMIT/ROLLBACK/release.
  public async materializeOnClient(client: PostgreSqlClientPort, input: AuditEvidenceReadRecord): Promise<AuditEvidenceReadRecord> {
    return this.materializeForRole(client, input, "ai_mls_production_runtime");
  }
  // Bounded one-shot Identity registration only; existing runtime participant is unchanged.
  public async materializeRegistrationOnClient(client: PostgreSqlClientPort, input: AuditEvidenceReadRecord): Promise<AuditEvidenceReadRecord> {
    assertAuditEvidence(input);
    requireValue(input.eventType === "REGISTERED_SERVICE_WORKLOAD.REGISTERED"
      && input.scopeRef === `registered-service-workload:${input.aggregateId}:${input.aggregateVersion}`);
    return this.materializeForRole(client, input, "ai_mls_production_registration_operator");
  }
  private async materializeForRole(client: PostgreSqlClientPort, input: AuditEvidenceReadRecord, expectedRole: string): Promise<AuditEvidenceReadRecord> {
    if (this.#state.closed || this.#state.quarantined) throw new GovernancePersistenceError("UNAVAILABLE");
    assertAuditEvidence(input);
    const record = structuredClone(input);
    this.#state.active++;
    try {
    const role = await client.query("SELECT current_user AS role");
    if (role.rows[0]?.["role"] !== expectedRole) throw new GovernancePersistenceError("UNAVAILABLE");
    const replay = await this.select(client,record.auditEvidenceRef);
    if (replay) { if (canonicalJson(replay) !== canonicalJson(record)) throw new GovernancePersistenceError("CONFLICT"); return record; }
    requireValue(record.eventType !== "WORKLOAD_STARTUP_BINDING.ACTIVATED" || record.payloadSchemaVersion === 2);
    const values = [record.auditEvidenceRef, record.sourceDomain, record.aggregateType, record.aggregateId, record.aggregateVersion, record.eventType, record.payloadSchemaVersion, record.final, record.tenantId, record.scopeRef, JSON.stringify(record.payload), record.occurredAt, record.materializedAt];
    await client.query(`INSERT INTO app_audit.audit_evidence_read_records (${columns}) VALUES (${values.map((_, index) => `$${index + 1}`).join(",")}) ON CONFLICT (audit_evidence_ref) DO NOTHING`, values);
    const existing = await this.select(client, record.auditEvidenceRef);
    if (canonicalJson(existing) !== canonicalJson(record)) throw new GovernancePersistenceError("CONFLICT");
    return record;
    } finally {
      this.#state.active--;
      if (this.#state.active === 0) this.#state.drain?.();
    }
  }
  private async select(client: PostgreSqlClientPort, ref: string): Promise<AuditEvidenceReadRecord | undefined> {
    const result = await client.query(`SELECT ${columns} FROM app_audit.audit_evidence_read_records WHERE audit_evidence_ref=$1`, [ref]);
    if (result.rows.length > 1) throw new GovernancePersistenceError("CONFLICT");
    const row = result.rows[0];
    if (!row) return undefined;
    const instant = (value: unknown): unknown => value instanceof Date ? value.toISOString() : value;
    const record = { auditEvidenceRef: row["audit_evidence_ref"], sourceDomain: row["source_domain"], aggregateType: row["aggregate_type"], aggregateId: row["aggregate_id"], aggregateVersion: Number(row["aggregate_version"]), eventType: row["event_type"], payloadSchemaVersion: Number(row["payload_schema_version"]), final: row["final"], tenantId: row["tenant_id"], scopeRef: row["scope_ref"], payload: row["payload"], occurredAt: instant(row["occurred_at"]), materializedAt: instant(row["materialized_at"]) };
    assertAuditEvidence(record);
    requireValue(record.auditEvidenceRef === ref);
    return record;
  }
}

export function assertRegistrationAuditEvidence(value: unknown, registration: Readonly<Record<string, unknown>>): asserts value is AuditEvidenceReadRecord {
  assertAuditEvidence(value);
  requireValue(value.aggregateType === "REGISTERED_SERVICE_WORKLOAD" && value.eventType === "REGISTERED_SERVICE_WORKLOAD.REGISTERED" && value.auditEvidenceRef === registration["auditEvidenceRef"]);
  for (const field of registrationFields) requireValue(value.payload[field] === registration[field]);
}
export interface BindingAuditEvidencePair { readonly revocation: AuditEvidenceReadRecord; readonly activation: AuditEvidenceReadRecord }
