import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";

import { assertRegisteredServiceWorkloadSchemaCompatible } from "./registered-service-workload-schema.js";

export type RegisteredServiceWorkloadStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface RegisteredServiceWorkloadRecord {
  readonly registrationId: string;
  readonly tenantId: string;
  readonly principalId: string;
  readonly principalType: "SERVICE";
  readonly assurance: "WORKLOAD";
  readonly environment: "PRODUCTION";
  readonly status: RegisteredServiceWorkloadStatus;
  readonly workloadPurpose: string;
  readonly audience: string;
  readonly registrationVersion: number;
  readonly identityEvidenceRef: string;
  readonly auditEvidenceRef: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RegisteredServiceWorkloadEvidenceVerifier {
  assertRegisteredWorkloadEvidence(record: RegisteredServiceWorkloadRecord): void;
}

export interface RegisteredServiceWorkloadAuthorityLease {
  assertSchemaReady(): void;
  findByRegistrationId(registrationId: string): Readonly<RegisteredServiceWorkloadRecord> | undefined;
  close(): void;
}

export type RegisteredServiceWorkloadErrorCode = "IDENTITY_AUTHORITY_UNAVAILABLE";

export class RegisteredServiceWorkloadError extends Error {
  public constructor(public readonly code: RegisteredServiceWorkloadErrorCode) {
    super("Registered service workload authority is unavailable.");
    this.name = "RegisteredServiceWorkloadError";
  }
}

export interface DurableRegisteredServiceWorkloadStoreOptions {
  readonly databasePath: string;
  readonly evidenceVerifier: RegisteredServiceWorkloadEvidenceVerifier;
  readonly busyTimeoutMilliseconds?: number;
}

export class DurableRegisteredServiceWorkloadStore implements RegisteredServiceWorkloadAuthorityLease {
  readonly #database: DatabaseSync;
  readonly #evidenceVerifier: RegisteredServiceWorkloadEvidenceVerifier;
  #closed = false;

  public constructor(options: DurableRegisteredServiceWorkloadStoreOptions) {
    const timeout = options.busyTimeoutMilliseconds ?? 5000;
    if (!validDatabasePath(options.databasePath) || !existsSync(options.databasePath)
      || !validVerifier(options.evidenceVerifier) || !Number.isInteger(timeout) || timeout < 1 || timeout > 60_000) {
      throw unavailable();
    }
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(options.databasePath, { readOnly: true });
      database.exec(`PRAGMA busy_timeout = ${String(timeout)}`);
      this.#database = database;
      this.#evidenceVerifier = options.evidenceVerifier;
      this.assertSchemaReady();
    } catch {
      try { database?.close(); } catch { /* preserve safe startup failure */ }
      throw unavailable();
    }
  }

  public assertSchemaReady(): void {
    this.#assertOpen();
    try { assertRegisteredServiceWorkloadSchemaCompatible(this.#database); }
    catch { throw unavailable(); }
  }

  public findByRegistrationId(registrationId: string): Readonly<RegisteredServiceWorkloadRecord> | undefined {
    this.#assertOpen();
    if (!safeText(registrationId)) return undefined;
    try {
      const row = this.#database.prepare(`SELECT
        registration_id, tenant_id, principal_id, principal_type, assurance, environment, status,
        workload_purpose, audience, registration_version, identity_evidence_ref, audit_evidence_ref,
        created_at, updated_at
        FROM identity_registered_service_workloads WHERE registration_id = ?`).get(registrationId);
      if (row === undefined) return undefined;
      const record = decodeRecord(row);
      this.#evidenceVerifier.assertRegisteredWorkloadEvidence(record);
      return Object.freeze(record);
    } catch { throw unavailable(); }
  }

  public close(): void {
    if (this.#closed) return;
    this.#closed = true;
    try { this.#database.close(); } catch { throw unavailable(); }
  }

  #assertOpen(): void {
    if (this.#closed) throw unavailable();
  }
}

function decodeRecord(row: Record<string, SQLOutputValue>): RegisteredServiceWorkloadRecord {
  const status = row["status"];
  const version = Number(row["registration_version"]);
  const record = {
    registrationId: row["registration_id"], tenantId: row["tenant_id"], principalId: row["principal_id"],
    principalType: row["principal_type"], assurance: row["assurance"], environment: row["environment"], status,
    workloadPurpose: row["workload_purpose"], audience: row["audience"], registrationVersion: version,
    identityEvidenceRef: row["identity_evidence_ref"], auditEvidenceRef: row["audit_evidence_ref"],
    createdAt: row["created_at"], updatedAt: row["updated_at"],
  };
  if (!safeText(record.registrationId) || !safeText(record.tenantId) || !safeText(record.principalId)
    || record.principalType !== "SERVICE" || record.assurance !== "WORKLOAD" || record.environment !== "PRODUCTION"
    || (status !== "ACTIVE" && status !== "SUSPENDED" && status !== "REVOKED")
    || !safeText(record.workloadPurpose) || !safeText(record.audience) || !Number.isInteger(version) || version < 1
    || !safeText(record.identityEvidenceRef) || !safeText(record.auditEvidenceRef)
    || !instant(record.createdAt) || !instant(record.updatedAt)) {
    throw unavailable();
  }
  return record as RegisteredServiceWorkloadRecord;
}

function validDatabasePath(value: string): boolean {
  return typeof value === "string" && isAbsolute(value) && value !== ":memory:" && !value.startsWith("file:");
}

function validVerifier(value: RegisteredServiceWorkloadEvidenceVerifier): boolean {
  return typeof value === "object" && value !== null
    && typeof value.assertRegisteredWorkloadEvidence === "function";
}

function safeText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value) && !/[\\]|(?:\.{2}[/])/u.test(value);
}

function instant(value: unknown): value is string {
  return safeText(value) && !Number.isNaN(Date.parse(value));
}

function unavailable(): RegisteredServiceWorkloadError {
  return new RegisteredServiceWorkloadError("IDENTITY_AUTHORITY_UNAVAILABLE");
}
