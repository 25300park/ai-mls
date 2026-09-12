import { createHash } from "node:crypto";

import type {
  AuditPrincipal,
  PrincipalType,
  RoleCode,
} from "../../../packages/security-contracts/src/index.js";

export interface DurableSessionRecord {
  readonly id: string;
  readonly principalId: string;
  readonly principalType: PrincipalType;
  readonly roles: readonly RoleCode[];
  readonly teamId?: string;
  readonly state: "ACTIVE" | "REVOKED" | "EXPIRED";
  readonly assurance: "SINGLE_FACTOR" | "MFA" | "WORKLOAD";
  readonly isMfaVerified: boolean;
  readonly familyId: string;
  readonly refreshReference: string;
  readonly sessionVersion: number;
  readonly tenantBindingOrigin: string;
  readonly issuedAt: string;
  readonly revokedAt?: string;
  readonly revocationEvidenceRef?: string;
  readonly auditEvidenceRef: string;
  readonly lastAccessedAt: string;
  readonly lastMfaVerifiedAt?: string;
}

export interface SessionRevocationRecord {
  readonly sessionId: string;
  readonly revokedAt: string;
  readonly revocationEvidenceRef: string;
  readonly auditEvidenceRef: string;
}

export interface SessionMutationIdentity {
  readonly sessionId: string;
  readonly expectedVersion: number;
}

export interface SessionRepository {
  find(sessionId: string): DurableSessionRecord | undefined;
  listByFamily(familyId: string): readonly DurableSessionRecord[];
  create(record: DurableSessionRecord): void;
  update(expectedVersion: number, record: DurableSessionRecord): void;
  appendRevocation(expectedVersion: number, input: SessionRevocationRecord): void;
}

export interface SessionUnitOfWork {
  readonly sessions: SessionRepository;
  transaction<Result>(identity: SessionMutationIdentity, operation: () => Result): Result;
}

export interface TrustedSessionBinding {
  readonly actor: AuditPrincipal;
  readonly tenantId: string;
  readonly tenantBindingOrigin: string;
}

export interface TrustedSessionBindingRequest {
  readonly session: DurableSessionRecord;
  readonly tenantId: string;
  readonly resourceType: string;
  readonly purpose: string;
  readonly teamId?: string;
}

export interface TrustedSessionBindingResolver {
  resolve(request: TrustedSessionBindingRequest): TrustedSessionBinding | null;
}

export type SessionPersistenceErrorCode =
  | "SESSION_ALREADY_EXISTS"
  | "SESSION_IMMUTABLE_FIELD"
  | "SESSION_MUTATION_IDENTITY_MISMATCH"
  | "SESSION_NOT_FOUND"
  | "SESSION_RECORD_INVALID"
  | "SESSION_PERSISTENCE_UNAVAILABLE"
  | "SESSION_REVOCATION_IRREVERSIBLE"
  | "SESSION_TRANSACTION_ACTIVE"
  | "SESSION_TRANSACTION_REQUIRED"
  | "SESSION_VERSION_CONFLICT";

export class SessionPersistenceError extends Error {
  public constructor(
    public readonly code: SessionPersistenceErrorCode,
    public readonly publicMessage: string = code,
  ) {
    super(publicMessage);
    this.name = "SessionPersistenceError";
  }
}

const requiredFields = [
  "id",
  "principalId",
  "principalType",
  "roles",
  "state",
  "assurance",
  "isMfaVerified",
  "familyId",
  "refreshReference",
  "sessionVersion",
  "tenantBindingOrigin",
  "issuedAt",
  "auditEvidenceRef",
  "lastAccessedAt",
] as const;

const allowedFields = new Set<string>([
  ...requiredFields,
  "teamId",
  "revokedAt",
  "revocationEvidenceRef",
  "lastMfaVerifiedAt",
]);

const immutableFields = [
  "id",
  "principalId",
  "principalType",
  "roles",
  "teamId",
  "assurance",
  "isMfaVerified",
  "familyId",
  "refreshReference",
  "tenantBindingOrigin",
  "issuedAt",
  "lastMfaVerifiedAt",
  "auditEvidenceRef",
] as const;

export function sessionEvidenceReference(value: string): string {
  return `session-sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function persistenceError(code: SessionPersistenceErrorCode): SessionPersistenceError {
  return new SessionPersistenceError(code);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 512;
}

function isIsoInstant(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

export function assertValidDurableSessionRecord(
  value: unknown,
): asserts value is DurableSessionRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw persistenceError("SESSION_RECORD_INVALID");
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some((field) => !allowedFields.has(field))
    || requiredFields.some((field) => record[field] === undefined)
    || !isNonEmptyString(record["id"])
    || !isNonEmptyString(record["principalId"])
    || !["HUMAN", "SERVICE"].includes(String(record["principalType"]))
    || !Array.isArray(record["roles"])
    || record["roles"].some((role) => !isNonEmptyString(role))
    || !["ACTIVE", "REVOKED", "EXPIRED"].includes(String(record["state"]))
    || !["SINGLE_FACTOR", "MFA", "WORKLOAD"].includes(String(record["assurance"]))
    || typeof record["isMfaVerified"] !== "boolean"
    || (record["isMfaVerified"] === true && record["assurance"] !== "MFA")
    || !isNonEmptyString(record["familyId"])
    || !isNonEmptyString(record["refreshReference"])
    || !Number.isInteger(record["sessionVersion"])
    || Number(record["sessionVersion"]) < 1
    || !isNonEmptyString(record["tenantBindingOrigin"])
    || !isIsoInstant(record["issuedAt"])
    || !isNonEmptyString(record["auditEvidenceRef"])
    || !isIsoInstant(record["lastAccessedAt"])
    || (record["teamId"] !== undefined && !isNonEmptyString(record["teamId"]))
    || (record["lastMfaVerifiedAt"] !== undefined && !isIsoInstant(record["lastMfaVerifiedAt"]))
    || (record["revokedAt"] !== undefined && !isIsoInstant(record["revokedAt"]))
    || (record["revocationEvidenceRef"] !== undefined && !isNonEmptyString(record["revocationEvidenceRef"]))
    || (record["state"] === "REVOKED" && (
      record["revokedAt"] === undefined || record["revocationEvidenceRef"] === undefined
    ))
    || (record["state"] !== "REVOKED" && (
      record["revokedAt"] !== undefined || record["revocationEvidenceRef"] !== undefined
    ))
  ) {
    throw persistenceError("SESSION_RECORD_INVALID");
  }
}

export function cloneDurableSessionRecord(
  record: DurableSessionRecord,
): DurableSessionRecord {
  const snapshot = structuredClone(record);
  Object.freeze(snapshot.roles);
  return Object.freeze(snapshot);
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }
  return left === right;
}

export function assertDurableSessionImmutableFields(
  current: DurableSessionRecord,
  replacement: DurableSessionRecord,
): void {
  for (const field of immutableFields) {
    if (!sameValue(current[field], replacement[field])) {
      throw persistenceError("SESSION_IMMUTABLE_FIELD");
    }
  }
}

function cloneStore(
  source: ReadonlyMap<string, DurableSessionRecord>,
): Map<string, DurableSessionRecord> {
  return new Map(
    [...source.entries()].map(([sessionId, record]) => [sessionId, cloneDurableSessionRecord(record)]),
  );
}

export class InMemorySessionUnitOfWork implements SessionUnitOfWork {
  #committed = new Map<string, DurableSessionRecord>();
  #transactionStore: Map<string, DurableSessionRecord> | undefined;
  #transactionIdentity: SessionMutationIdentity | undefined;
  #mutationPerformed = false;

  public readonly sessions: SessionRepository = {
    find: (sessionId) => {
      const record = (this.#transactionStore ?? this.#committed).get(sessionId);
      return record === undefined ? undefined : cloneDurableSessionRecord(record);
    },
    listByFamily: (familyId) => [...(this.#transactionStore ?? this.#committed).values()]
      .filter((record) => record.familyId === familyId)
      .map((record) => cloneDurableSessionRecord(record)),
    create: (record) => {
      const store = this.#requireTransaction(record.id, 0);
      assertValidDurableSessionRecord(record);
      if (record.sessionVersion !== 1) throw persistenceError("SESSION_RECORD_INVALID");
      if (store.has(record.id)) throw persistenceError("SESSION_ALREADY_EXISTS");
      store.set(record.id, cloneDurableSessionRecord(record));
    },
    update: (expectedVersion, record) => {
      const store = this.#requireTransaction(record.id, expectedVersion);
      assertValidDurableSessionRecord(record);
      const current = store.get(record.id);
      if (current === undefined) throw persistenceError("SESSION_NOT_FOUND");
      if (current.sessionVersion !== expectedVersion) {
        throw persistenceError("SESSION_VERSION_CONFLICT");
      }
      if (record.sessionVersion !== expectedVersion + 1) {
        throw persistenceError("SESSION_VERSION_CONFLICT");
      }
      if (current.state === "REVOKED"
        || record.state === "REVOKED"
        || record.revokedAt !== current.revokedAt
        || record.revocationEvidenceRef !== current.revocationEvidenceRef) {
        throw persistenceError("SESSION_REVOCATION_IRREVERSIBLE");
      }
      assertDurableSessionImmutableFields(current, record);
      store.set(record.id, cloneDurableSessionRecord(record));
    },
    appendRevocation: (expectedVersion, input) => {
      const store = this.#requireTransaction(input.sessionId, expectedVersion);
      if (!isIsoInstant(input.revokedAt)
        || !isNonEmptyString(input.revocationEvidenceRef)
        || !isNonEmptyString(input.auditEvidenceRef)) {
        throw persistenceError("SESSION_RECORD_INVALID");
      }
      const current = store.get(input.sessionId);
      if (current === undefined) throw persistenceError("SESSION_NOT_FOUND");
      if (current.sessionVersion !== expectedVersion) {
        throw persistenceError("SESSION_VERSION_CONFLICT");
      }
      if (current.state === "REVOKED") {
        throw persistenceError("SESSION_REVOCATION_IRREVERSIBLE");
      }
      const revoked: DurableSessionRecord = {
        ...current,
        state: "REVOKED",
        sessionVersion: expectedVersion + 1,
        revokedAt: input.revokedAt,
        revocationEvidenceRef: input.revocationEvidenceRef,
        auditEvidenceRef: input.auditEvidenceRef,
      };
      assertValidDurableSessionRecord(revoked);
      store.set(input.sessionId, cloneDurableSessionRecord(revoked));
    },
  };

  public transaction<Result>(
    identity: SessionMutationIdentity,
    operation: () => Result,
  ): Result {
    if (this.#transactionStore !== undefined) {
      throw persistenceError("SESSION_TRANSACTION_ACTIVE");
    }
    if (!isNonEmptyString(identity.sessionId) || !Number.isInteger(identity.expectedVersion)) {
      throw persistenceError("SESSION_RECORD_INVALID");
    }
    const current = this.#committed.get(identity.sessionId);
    const actualVersion = current?.sessionVersion ?? 0;
    if (actualVersion !== identity.expectedVersion) {
      throw persistenceError("SESSION_VERSION_CONFLICT");
    }

    this.#transactionStore = cloneStore(this.#committed);
    this.#transactionIdentity = identity;
    this.#mutationPerformed = false;
    try {
      const result = operation();
      this.#committed = this.#transactionStore;
      return result;
    } finally {
      this.#transactionStore = undefined;
      this.#transactionIdentity = undefined;
      this.#mutationPerformed = false;
    }
  }

  #requireTransaction(
    sessionId: string,
    expectedVersion: number,
  ): Map<string, DurableSessionRecord> {
    if (this.#transactionStore === undefined || this.#transactionIdentity === undefined) {
      throw persistenceError("SESSION_TRANSACTION_REQUIRED");
    }
    if (this.#transactionIdentity.sessionId !== sessionId) {
      throw persistenceError("SESSION_MUTATION_IDENTITY_MISMATCH");
    }
    if (this.#transactionIdentity.expectedVersion !== expectedVersion
      || this.#mutationPerformed) {
      throw persistenceError("SESSION_VERSION_CONFLICT");
    }
    this.#mutationPerformed = true;
    return this.#transactionStore;
  }
}
