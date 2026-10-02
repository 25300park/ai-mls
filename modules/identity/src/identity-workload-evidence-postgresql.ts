import { plainRecord, requireValue, safeText, safeVersion } from "../../organization/src/governance-persistence-support.js";
export interface IdentityWorkloadEvidenceRecord {
  readonly identityEvidenceRef: string;
  readonly registrationId: string;
  readonly registrationVersion: number;
  readonly tenantId: string;
  readonly principalId: string;
  readonly schemaVersion: 1;
  readonly immutable: true;
}
export function assertIdentityWorkloadEvidence(value: unknown): asserts value is IdentityWorkloadEvidenceRecord {
  plainRecord(value, ["identityEvidenceRef", "registrationId", "registrationVersion", "tenantId", "principalId", "schemaVersion", "immutable"]);
  requireValue(["identityEvidenceRef", "registrationId", "tenantId", "principalId"].every(field => safeText(value[field])));
  requireValue(safeVersion(value["registrationVersion"]) && value["schemaVersion"] === 1 && value["immutable"] === true);
}

import type { PostgreSqlPoolPort } from "./postgresql-pool.js";
import { closeLease, GovernancePersistenceError, newLeaseState, operate } from "../../organization/src/governance-persistence-support.js";
export class PostgreSqlIdentityWorkloadEvidenceReader {
  readonly #state = newLeaseState();
  public constructor(private readonly pool: PostgreSqlPoolPort) { requireValue(typeof pool?.connect === "function"); }
  public close(): Promise<void> { return closeLease(this.#state); }
  public async findByEvidenceRef(identityEvidenceRef: string): Promise<IdentityWorkloadEvidenceRecord | undefined> {
    requireValue(safeText(identityEvidenceRef));
    return operate(this.pool, this.#state, false, async client => {
      const result = await client.query("SELECT identity_evidence_ref,registration_id,registration_version,tenant_id,principal_id,schema_version,immutable FROM app_identity.identity_workload_evidence WHERE identity_evidence_ref=$1", [identityEvidenceRef]);
      if (result.rows.length > 1) throw new GovernancePersistenceError("CONFLICT");
      const row = result.rows[0];
      if (!row) return undefined;
      const record = { identityEvidenceRef: row["identity_evidence_ref"], registrationId: row["registration_id"], registrationVersion: Number(row["registration_version"]), tenantId: row["tenant_id"], principalId: row["principal_id"], schemaVersion: Number(row["schema_version"]), immutable: row["immutable"] };
      assertIdentityWorkloadEvidence(record);
      requireValue(record.identityEvidenceRef === identityEvidenceRef);
      return record;
    });
  }
}

export function assertIdentityEvidenceMatchesRegistration(value: unknown, registration: Readonly<Record<string, unknown>>): asserts value is IdentityWorkloadEvidenceRecord {
  assertIdentityWorkloadEvidence(value);
  requireValue(value.identityEvidenceRef === registration["identityEvidenceRef"]);
  for (const field of ["registrationId", "registrationVersion", "tenantId", "principalId"] as const) requireValue(value[field] === registration[field]);
}
