import type {
  RegisteredServiceWorkloadRecord,
} from "./registered-service-workload.js";
import { RegisteredServiceWorkloadError } from "./registered-service-workload.js";
import type { PostgreSqlClientPort, PostgreSqlPoolPort } from "./postgresql-pool.js";
import {
  inspectPostgreSqlRegisteredServiceWorkloadSchemaEvidence,
  type PostgreSqlIdentitySchemaReadinessProvenance,
} from "./registered-service-workload-postgresql-schema.js";

export interface AsyncRegisteredServiceWorkloadAuthorityLease {
  assertSchemaReady(): Promise<PostgreSqlIdentitySchemaReadinessProvenance>;
  findByRegistrationId(registrationId: string): Promise<Readonly<RegisteredServiceWorkloadRecord> | undefined>;
  close(): Promise<void>;
}

export class PostgreSqlRegisteredServiceWorkloadStore implements AsyncRegisteredServiceWorkloadAuthorityLease {
  #closed = false;

  public constructor(
    private readonly pool: PostgreSqlPoolPort,
    private readonly evidenceVerifier: { assertRegisteredWorkloadEvidence(record: RegisteredServiceWorkloadRecord): void | Promise<void> },
  ) {
    if (typeof pool?.connect !== "function" || typeof evidenceVerifier?.assertRegisteredWorkloadEvidence !== "function") {
      throw unavailable();
    }
  }

  public async assertSchemaReady(): Promise<PostgreSqlIdentitySchemaReadinessProvenance> {
    this.assertOpen();
    const evidence = await inspectPostgreSqlRegisteredServiceWorkloadSchemaEvidence(this.pool);
    if (evidence.readiness !== "READY" || evidence.provenance === null) throw unavailable();
    return evidence.provenance;
  }

  public async findByRegistrationId(registrationId: string): Promise<Readonly<RegisteredServiceWorkloadRecord> | undefined> {
    this.assertOpen();
    if (!safeText(registrationId)) return undefined;
    try {
      const client = await this.connect();
      let record: RegisteredServiceWorkloadRecord;
      try {
      const result = await client.query(`SELECT registration_id, tenant_id, principal_id, principal_type,
        assurance, environment, status, workload_purpose, audience, registration_version,
        identity_evidence_ref, audit_evidence_ref, created_at, updated_at
        FROM app_identity.identity_registered_service_workloads WHERE registration_id = $1`, [registrationId]);
      if (result.rowCount === 0) return undefined;
      record = decodeRecord(result.rows[0]);
      } finally { client.release(); }
      // Durable evidence may use the same max=1 pool: never retain this client while awaiting it.
      await this.evidenceVerifier.assertRegisteredWorkloadEvidence(record);
      this.assertOpen();
      return Object.freeze(record);
    } catch { throw unavailable(); }
  }

  public close(): Promise<void> {
    this.#closed = true;
    return Promise.resolve();
  }

  private assertOpen(): void {
    if (this.#closed) throw unavailable();
  }

  private async connect(): Promise<PostgreSqlClientPort> {
    try { return await this.pool.connect(); } catch { throw unavailable(); }
  }
}

function decodeRecord(row: Readonly<Record<string, unknown>> | undefined): RegisteredServiceWorkloadRecord {
  const version = Number(row?.["registration_version"]);
  const createdAt = toInstant(row?.["created_at"]);
  const updatedAt = toInstant(row?.["updated_at"]);
  const record = {
    registrationId: row?.["registration_id"], tenantId: row?.["tenant_id"], principalId: row?.["principal_id"],
    principalType: row?.["principal_type"], assurance: row?.["assurance"], environment: row?.["environment"],
    status: row?.["status"], workloadPurpose: row?.["workload_purpose"], audience: row?.["audience"],
    registrationVersion: version, identityEvidenceRef: row?.["identity_evidence_ref"],
    auditEvidenceRef: row?.["audit_evidence_ref"], timestampCreated: createdAt, timestampUpdated: updatedAt,
  };
  if (!safeText(record.registrationId) || !safeText(record.tenantId) || !safeText(record.principalId)
    || record.principalType !== "SERVICE" || record.assurance !== "WORKLOAD" || record.environment !== "PRODUCTION"
    || !["ACTIVE", "SUSPENDED", "REVOKED"].includes(String(record.status)) || !safeText(record.workloadPurpose)
    || !safeText(record.audience) || !Number.isSafeInteger(version) || version < 1
    || !safeText(record.identityEvidenceRef) || !safeText(record.auditEvidenceRef)
    || createdAt === undefined || updatedAt === undefined) throw unavailable();
  return {
    registrationId: record.registrationId, tenantId: record.tenantId, principalId: record.principalId,
    principalType: "SERVICE", assurance: "WORKLOAD", environment: "PRODUCTION",
    status: record.status as RegisteredServiceWorkloadRecord["status"], workloadPurpose: record.workloadPurpose,
    audience: record.audience, registrationVersion: version, identityEvidenceRef: record.identityEvidenceRef,
    auditEvidenceRef: record.auditEvidenceRef, createdAt, updatedAt,
  };
}

function safeText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function toInstant(value: unknown): string | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  return safeText(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
}

function unavailable(): RegisteredServiceWorkloadError {
  return new RegisteredServiceWorkloadError("IDENTITY_AUTHORITY_UNAVAILABLE");
}
