import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";

import { isUnsafeSecurityDetailValue, type AuditPrincipal, type DataClassification, type RoleCode } from "../../../packages/security-contracts/src/index.js";
import type { AuditPrincipalProvenance, EnrichedAuditIntentV2 } from "../../audit/src/enriched-audit-intent-contract.js";
import type { BackgroundJob, JobInputReference, JobStatus, SystemErrorReference } from "./job-service.js";

export type DurableJobType = "AI_LISTING_PARSE" | "AI_REQUIREMENT_PARSE" | "AI_MATCHING";
export type JobFailureCode = "DEPENDENCY_UNAVAILABLE" | "JOB_RESULT_INVALID";
export type JobAuditIntent = Omit<EnrichedAuditIntentV2, "sourceDomain"> & Readonly<{ sourceDomain: "API-017" }>;

export interface DurableJobRecord extends BackgroundJob {
  readonly jobType: DurableJobType;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly originatingDomainCommandId: string;
  readonly policyVersion: string;
  readonly principalProvenance: AuditPrincipalProvenance;
  readonly authorityEvidenceRefs: readonly string[];
  readonly failureEvidenceRef?: string;
}

export interface SubmitDurableJobInput {
  readonly commandId: string;
  readonly jobType: DurableJobType;
  readonly inputReferences: readonly JobInputReference[];
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly purpose: string;
  readonly privacyClassification: DataClassification;
  readonly deadline: string;
  readonly principalProvenance: AuditPrincipalProvenance;
  readonly authorityEvidenceRefs: readonly string[];
  readonly policyVersion: string;
  readonly correlationId: string;
  readonly causationId: string;
}

export interface NormalizedJobFailure {
  readonly code: JobFailureCode;
  readonly evidenceRef: string;
}

export type DurableJobStoreErrorCode =
  | "PERSISTENCE_UNAVAILABLE"
  | "PERSISTENCE_INPUT_INVALID"
  | "JOB_IDENTITY_CONFLICT"
  | "JOB_NOT_FOUND"
  | "JOB_ALREADY_TERMINAL"
  | "STATE_TRANSITION_INVALID"
  | "VERSION_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "RETRY_NOT_SAFE"
  | "JOB_RESULT_INVALID";

export class DurableJobStoreError extends Error {
  public constructor(public readonly code: DurableJobStoreErrorCode) {
    super(code);
    this.name = "DurableJobStoreError";
  }
}

interface StoreOptions {
  readonly databasePath: string;
  readonly idFactory: () => string;
  readonly clock: () => Date;
  readonly busyTimeoutMilliseconds?: number;
  readonly beforeAuditIntentWrite?: () => void;
}

interface AccessInput {
  readonly jobId: string;
  readonly tenantId: string;
  readonly scopeRef: string;
}

interface InternalTransitionInput {
  readonly jobId: string;
  readonly expectedVersion: number;
  readonly correlationId: string;
  readonly evidenceRefs: readonly string[];
}

interface PrincipalCommandInput {
  readonly commandId: string;
  readonly jobId: string;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly expectedVersion: number;
  readonly principalProvenance: AuditPrincipalProvenance;
  readonly authorityEvidenceRefs: readonly string[];
  readonly correlationId: string;
}

interface IdempotencyRecord {
  readonly fingerprint: string;
  readonly result: Readonly<{ jobId: string; successorJobId?: string }>;
}

const jobTypes = new Set<DurableJobType>(["AI_LISTING_PARSE", "AI_REQUIREMENT_PARSE", "AI_MATCHING"]);
const statuses = new Set<JobStatus>(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"]);
const terminalStatuses = new Set<JobStatus>(["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"]);
const auditMappings = Object.freeze({
  JOB_SUBMITTED: Object.freeze({ eventCategory: "COMMAND_ACCEPTED", action: "job.submit", outcome: "ACCEPTED" }),
  JOB_STARTED: Object.freeze({ eventCategory: "STATE_CHANGED", action: "job.start", outcome: "ACCEPTED" }),
  JOB_SUCCEEDED: Object.freeze({ eventCategory: "STATE_CHANGED", action: "job.succeed", outcome: "COMPLETED" }),
  JOB_FAILED: Object.freeze({ eventCategory: "STATE_CHANGED", action: "job.fail", outcome: "FAILED" }),
  JOB_CANCELLED: Object.freeze({ eventCategory: "STATE_CHANGED", action: "job.cancel", outcome: "COMPLETED" }),
  JOB_EXPIRED: Object.freeze({ eventCategory: "STATE_CHANGED", action: "job.expire", outcome: "COMPLETED" }),
  JOB_RETRY_SUBMITTED: Object.freeze({ eventCategory: "COMMAND_ACCEPTED", action: "job.retry", outcome: "ACCEPTED" }),
});
const classifications = new Set<DataClassification>(["PUBLIC_APPROVED", "INTERNAL", "CONFIDENTIAL_BUSINESS", "RESTRICTED_PERSONAL", "RESTRICTED_SECURITY"]);
const roles = new Set<RoleCode>(["COL", "AGT", "SAG", "REV", "AIR", "DUR", "VER", "PMR", "PUA", "MGR", "DST", "OPS", "SEC", "ADM", "RELEASE_OWNER", "SVC", "EXT"]);
const issuedFailures = new WeakSet<object>();

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs_job_records (
  job_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scope_ref TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED','EXPIRED')),
  immutable_fingerprint TEXT NOT NULL,
  payload_json TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS jobs_job_history (
  job_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  payload_json TEXT NOT NULL,
  PRIMARY KEY (job_id, version)
) STRICT;
CREATE TABLE IF NOT EXISTS jobs_command_idempotency (
  operation TEXT NOT NULL,
  command_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  result_json TEXT NOT NULL,
  PRIMARY KEY (operation, command_id)
) STRICT;
CREATE TABLE IF NOT EXISTS jobs_successor_lineage (
  predecessor_job_id TEXT PRIMARY KEY,
  successor_job_id TEXT NOT NULL UNIQUE,
  command_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS jobs_audit_intents (
  intent_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  scope_ref TEXT NOT NULL,
  payload_json TEXT NOT NULL
) STRICT;
CREATE TRIGGER IF NOT EXISTS jobs_history_no_update BEFORE UPDATE ON jobs_job_history BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS jobs_history_no_delete BEFORE DELETE ON jobs_job_history BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS jobs_idempotency_no_update BEFORE UPDATE ON jobs_command_idempotency BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS jobs_idempotency_no_delete BEFORE DELETE ON jobs_command_idempotency BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS jobs_lineage_no_update BEFORE UPDATE ON jobs_successor_lineage BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS jobs_lineage_no_delete BEFORE DELETE ON jobs_successor_lineage BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS jobs_audit_intents_no_update BEFORE UPDATE ON jobs_audit_intents BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS jobs_audit_intents_no_delete BEFORE DELETE ON jobs_audit_intents BEGIN SELECT RAISE(ABORT, 'append-only'); END;
`;

export class DurableJobStore {
  readonly #database: DatabaseSync;
  readonly #idFactory: () => string;
  readonly #clock: () => Date;
  readonly #beforeAuditIntentWrite: (() => void) | undefined;
  #closed = false;

  public constructor(options: StoreOptions) {
    const timeout = options.busyTimeoutMilliseconds ?? 5_000;
    if (!validDatabasePath(options.databasePath) || typeof options.idFactory !== "function" || typeof options.clock !== "function" || !Number.isInteger(timeout) || timeout < 1 || timeout > 60_000) throw failure("PERSISTENCE_INPUT_INVALID");
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(options.databasePath);
      database.exec("PRAGMA foreign_keys = ON");
      database.exec("PRAGMA journal_mode = WAL");
      database.exec("PRAGMA synchronous = FULL");
      database.exec(`PRAGMA busy_timeout = ${String(timeout)}`);
      database.exec(SCHEMA);
      validateDatabase(database);
      this.#database = database;
      this.#idFactory = options.idFactory;
      this.#clock = options.clock;
      this.#beforeAuditIntentWrite = options.beforeAuditIntentWrite;
    } catch (error) {
      try { database?.close(); } catch { /* safe close */ }
      if (error instanceof DurableJobStoreError) throw error;
      throw failure("PERSISTENCE_UNAVAILABLE");
    }
  }

  public submitJob(input: SubmitDurableJobInput): Readonly<{ status: "STORED" | "REPLAYED"; job: DurableJobRecord }> {
    this.#assertOpen();
    validateSubmission(input);
    const fingerprint = fingerprintOf({ ...input, commandId: undefined });
    const identityKey = fingerprintOf({ tenantId: input.tenantId, scopeRef: input.scopeRef, jobType: input.jobType, commandId: input.commandId });
    const replay = this.#readIdempotency("SubmitJob", identityKey, fingerprint);
    if (replay !== undefined) return snapshot({ status: "REPLAYED" as const, job: this.#requiredBoundJob(replay.result.jobId, input) });
    const jobId = this.#idFactory();
    if (!safeIdentifier(jobId)) throw failure("PERSISTENCE_INPUT_INVALID");
    const committedAt = this.#now();
    const principalValue = principal(input.principalProvenance);
    const job = jobSnapshot({
      id: jobId,
      jobType: input.jobType,
      status: "QUEUED",
      version: 1,
      attempt: 0,
      inputReferences: input.inputReferences,
      purpose: input.purpose,
      privacyClassification: input.privacyClassification,
      deadline: input.deadline,
      idempotencyKey: input.commandId,
      requestedBy: principalValue.id,
      requestedByType: principalValue.type,
      ...(principalValue.teamId === undefined ? {} : { teamId: principalValue.teamId }),
      causationId: input.causationId,
      createdAt: committedAt,
      tenantId: input.tenantId,
      scopeRef: input.scopeRef,
      originatingDomainCommandId: input.commandId,
      policyVersion: input.policyVersion,
      principalProvenance: input.principalProvenance,
      authorityEvidenceRefs: input.authorityEvidenceRefs,
    });
    const intent = auditIntent(job, {
      eventType: "JOB_SUBMITTED", eventCategory: "COMMAND_ACCEPTED", action: "job.submit", outcome: "ACCEPTED",
      mutationIdentity: input.commandId, principalProvenance: input.principalProvenance, correlationId: input.correlationId,
      evidenceRefs: input.authorityEvidenceRefs, committedAt,
    });
    return this.#transaction(() => {
      const lockedReplay = this.#readIdempotency("SubmitJob", identityKey, fingerprint);
      if (lockedReplay !== undefined) return snapshot({ status: "REPLAYED" as const, job: this.#requiredBoundJob(lockedReplay.result.jobId, input) });
      if (this.#readJob(jobId) !== undefined) throw failure("JOB_IDENTITY_CONFLICT");
      this.#insertJob(job);
      this.#insertHistory(job);
      this.#insertIntent(intent);
      this.#insertIdempotency("SubmitJob", identityKey, fingerprint, { jobId });
      return snapshot({ status: "STORED" as const, job });
    });
  }

  public readJob(input: AccessInput): DurableJobRecord {
    this.#assertOpen();
    validateAccess(input);
    const job = this.#requiredJob(input.jobId);
    if (job.tenantId !== input.tenantId || job.scopeRef !== input.scopeRef) throw failure("JOB_NOT_FOUND");
    return job;
  }

  public readJobResult(input: AccessInput): Readonly<{ status: JobStatus; resultReference?: string; resultChecksum?: string; failureCode?: JobFailureCode; failureEvidenceRef?: string }> {
    const job = this.readJob(input);
    if (!terminalStatuses.has(job.status)) throw failure("STATE_TRANSITION_INVALID");
    return snapshot({
      status: job.status,
      ...(job.resultReference === undefined ? {} : { resultReference: job.resultReference }),
      ...(job.resultChecksum === undefined ? {} : { resultChecksum: job.resultChecksum }),
      ...(job.failureCode === undefined ? {} : { failureCode: job.failureCode as JobFailureCode }),
      ...(job.failureEvidenceRef === undefined ? {} : { failureEvidenceRef: job.failureEvidenceRef }),
    });
  }

  public startJob(input: InternalTransitionInput): DurableJobRecord {
    this.#assertOpen();
    validateTransitionInput(input);
    const current = this.#requiredJob(input.jobId);
    assertVersion(current, input.expectedVersion);
    assertNotTerminal(current);
    if (current.status !== "QUEUED" || new Date(current.deadline).getTime() <= this.#clock().getTime()) throw failure("STATE_TRANSITION_INVALID");
    const committedAt = this.#now();
    const updated = jobSnapshot({ ...current, status: "RUNNING", version: current.version + 1, attempt: current.attempt + 1, startedAt: committedAt, workerId: "JOBS_API_017_WORKER" });
    const provenance = componentProvenance("JOBS_API_017_WORKER");
    const intent = auditIntent(updated, { eventType: "JOB_STARTED", eventCategory: "STATE_CHANGED", action: "job.start", outcome: "ACCEPTED", mutationIdentity: `${updated.id}:${String(updated.attempt)}:start`, principalProvenance: provenance, correlationId: input.correlationId, evidenceRefs: input.evidenceRefs, committedAt });
    this.#persistTransition(current, updated, intent);
    return updated;
  }

  public succeedJob(input: InternalTransitionInput & Readonly<{ attempt: number; resultReference: string; resultChecksum: string }>): DurableJobRecord {
    this.#assertOpen();
    validateTransitionInput(input);
    if (!positiveInteger(input.attempt) || !safeReference(input.resultReference) || !safeReference(input.resultChecksum)) throw failure("JOB_RESULT_INVALID");
    const current = this.#requiredJob(input.jobId);
    assertVersion(current, input.expectedVersion);
    assertNotTerminal(current);
    if (current.status !== "RUNNING" || current.attempt !== input.attempt || current.workerId !== "JOBS_API_017_WORKER") throw failure("STATE_TRANSITION_INVALID");
    const committedAt = this.#now();
    const updated = jobSnapshot({ ...current, status: "SUCCEEDED", version: current.version + 1, completedAt: committedAt, resultReference: input.resultReference, resultChecksum: input.resultChecksum });
    const intent = auditIntent(updated, { eventType: "JOB_SUCCEEDED", eventCategory: "STATE_CHANGED", action: "job.succeed", outcome: "COMPLETED", mutationIdentity: `${updated.id}:${String(input.attempt)}:succeed`, principalProvenance: componentProvenance("JOBS_API_017_WORKER"), correlationId: input.correlationId, evidenceRefs: input.evidenceRefs, committedAt });
    this.#persistTransition(current, updated, intent);
    return updated;
  }

  public failJob(input: InternalTransitionInput & Readonly<{ attempt: number; failure: NormalizedJobFailure }>): DurableJobRecord {
    this.#assertOpen();
    validateTransitionInput(input);
    if (!positiveInteger(input.attempt) || !plain(input.failure) || !issuedFailures.has(input.failure)) throw failure("JOB_RESULT_INVALID");
    const current = this.#requiredJob(input.jobId);
    assertVersion(current, input.expectedVersion);
    assertNotTerminal(current);
    if (current.status !== "RUNNING" || current.attempt !== input.attempt || current.workerId !== "JOBS_API_017_WORKER") throw failure("STATE_TRANSITION_INVALID");
    const committedAt = this.#now();
    const errorId = this.#idFactory();
    if (!safeIdentifier(errorId)) throw failure("PERSISTENCE_INPUT_INVALID");
    const errorReference: SystemErrorReference = snapshot({ id: errorId, category: input.failure.code === "DEPENDENCY_UNAVAILABLE" ? "DEPENDENCY" : "PROCESSING", code: input.failure.code, retryable: input.failure.code === "DEPENDENCY_UNAVAILABLE", occurredAt: committedAt });
    const updated = jobSnapshot({ ...current, status: "FAILED", version: current.version + 1, completedAt: committedAt, failureCode: input.failure.code, failureEvidenceRef: input.failure.evidenceRef, systemErrorReference: errorReference });
    const intent = auditIntent(updated, { eventType: "JOB_FAILED", eventCategory: "STATE_CHANGED", action: "job.fail", outcome: "FAILED", mutationIdentity: `${updated.id}:${String(input.attempt)}:fail`, principalProvenance: componentProvenance("JOBS_API_017_WORKER"), correlationId: input.correlationId, evidenceRefs: [...input.evidenceRefs, input.failure.evidenceRef], committedAt });
    this.#persistTransition(current, updated, intent);
    return updated;
  }

  public cancelJob(input: PrincipalCommandInput & Readonly<{ reasonRef: string }>): Readonly<{ status: "STORED" | "REPLAYED"; job: DurableJobRecord }> {
    this.#assertOpen();
    validatePrincipalCommand(input);
    if (!safeReference(input.reasonRef)) throw failure("PERSISTENCE_INPUT_INVALID");
    const fingerprint = fingerprintOf({ ...input, commandId: undefined });
    const preflightCurrent = this.#requiredJob(input.jobId);
    assertBinding(preflightCurrent, input);
    const replay = this.#readIdempotency("CancelJob", input.commandId, fingerprint);
    if (replay !== undefined) return snapshot({ status: "REPLAYED" as const, job: this.#requiredBoundJob(replay.result.jobId, input) });
    return this.#transaction(() => {
      const lockedReplay = this.#readIdempotency("CancelJob", input.commandId, fingerprint);
      if (lockedReplay !== undefined) return snapshot({ status: "REPLAYED" as const, job: this.#requiredBoundJob(lockedReplay.result.jobId, input) });
      const current = this.#requiredJob(input.jobId);
      assertBinding(current, input);
      assertVersion(current, input.expectedVersion);
      assertNotTerminal(current);
      if (current.status !== "QUEUED" && current.status !== "RUNNING") throw failure("STATE_TRANSITION_INVALID");
      const committedAt = this.#now();
      const updated = jobSnapshot({ ...current, status: "CANCELLED", version: current.version + 1, completedAt: committedAt });
      const intent = auditIntent(updated, { eventType: "JOB_CANCELLED", eventCategory: "STATE_CHANGED", action: "job.cancel", outcome: "COMPLETED", mutationIdentity: input.commandId, principalProvenance: input.principalProvenance, correlationId: input.correlationId, evidenceRefs: [...input.authorityEvidenceRefs, input.reasonRef], committedAt });
      this.#updateJob(current, updated);
      this.#insertHistory(updated);
      this.#insertIntent(intent);
      this.#insertIdempotency("CancelJob", input.commandId, fingerprint, { jobId: updated.id });
      return snapshot({ status: "STORED" as const, job: updated });
    });
  }

  public expireJob(input: InternalTransitionInput): DurableJobRecord {
    this.#assertOpen();
    validateTransitionInput(input);
    const current = this.#requiredJob(input.jobId);
    assertVersion(current, input.expectedVersion);
    assertNotTerminal(current);
    if ((current.status !== "QUEUED" && current.status !== "RUNNING") || new Date(current.deadline).getTime() > this.#clock().getTime()) throw failure("STATE_TRANSITION_INVALID");
    const committedAt = this.#now();
    const updated = jobSnapshot({ ...current, status: "EXPIRED", version: current.version + 1, completedAt: committedAt });
    const intent = auditIntent(updated, { eventType: "JOB_EXPIRED", eventCategory: "STATE_CHANGED", action: "job.expire", outcome: "COMPLETED", mutationIdentity: `${updated.id}:${String(updated.version)}:expire`, principalProvenance: componentProvenance("JOBS_API_017_CONTROL"), correlationId: input.correlationId, evidenceRefs: input.evidenceRefs, committedAt });
    this.#persistTransition(current, updated, intent);
    return updated;
  }

  public retryAsSuccessor(input: Omit<PrincipalCommandInput, "jobId"> & Readonly<{ predecessorJobId: string; reasonRef: string; eligibilityEvidenceRefs: readonly string[] }>): Readonly<{ status: "STORED" | "REPLAYED"; predecessor: DurableJobRecord; successor: DurableJobRecord }> {
    this.#assertOpen();
    const command = { ...input, jobId: input.predecessorJobId };
    validatePrincipalCommand(command);
    if (!safeReference(input.reasonRef) || !safeReferences(input.eligibilityEvidenceRefs)) throw failure("PERSISTENCE_INPUT_INVALID");
    const fingerprint = fingerprintOf({ ...input, commandId: undefined });
    const preflightPredecessor = this.#requiredJob(input.predecessorJobId);
    assertBinding(preflightPredecessor, input);
    const replay = this.#readIdempotency("RetryAsSuccessor", input.commandId, fingerprint);
    const replaySuccessorId = replay?.result.successorJobId;
    if (replay !== undefined && replaySuccessorId !== undefined) return snapshot({ status: "REPLAYED" as const, predecessor: this.#requiredBoundJob(replay.result.jobId, input), successor: this.#requiredBoundJob(replaySuccessorId, input) });
    const successorId = this.#idFactory();
    if (!safeIdentifier(successorId)) throw failure("PERSISTENCE_INPUT_INVALID");
    return this.#transaction(() => {
      const lockedReplay = this.#readIdempotency("RetryAsSuccessor", input.commandId, fingerprint);
      const lockedSuccessorId = lockedReplay?.result.successorJobId;
      if (lockedReplay !== undefined && lockedSuccessorId !== undefined) return snapshot({ status: "REPLAYED" as const, predecessor: this.#requiredBoundJob(lockedReplay.result.jobId, input), successor: this.#requiredBoundJob(lockedSuccessorId, input) });
      const predecessor = this.#requiredJob(input.predecessorJobId);
      assertBinding(predecessor, input);
      assertVersion(predecessor, input.expectedVersion);
      if (predecessor.status !== "FAILED" || predecessor.failureCode !== "DEPENDENCY_UNAVAILABLE" || new Date(predecessor.deadline).getTime() <= this.#clock().getTime() || this.#lineageSuccessor(predecessor.id) !== undefined) throw failure("RETRY_NOT_SAFE");
      if (this.#readJob(successorId) !== undefined) throw failure("JOB_IDENTITY_CONFLICT");
      const committedAt = this.#now();
      const actor = principal(input.principalProvenance);
      const successor = jobSnapshot({
        ...predecessor,
        id: successorId,
        status: "QUEUED",
        version: 1,
        attempt: predecessor.attempt,
        idempotencyKey: input.commandId,
        requestedBy: actor.id,
        requestedByType: actor.type,
        ...(actor.teamId === undefined ? { teamId: undefined } : { teamId: actor.teamId }),
        originatingDomainCommandId: input.commandId,
        principalProvenance: input.principalProvenance,
        authorityEvidenceRefs: input.authorityEvidenceRefs,
        causationId: predecessor.id,
        createdAt: committedAt,
        predecessorJobId: predecessor.id,
        startedAt: undefined,
        completedAt: undefined,
        workerId: undefined,
        resultReference: undefined,
        resultChecksum: undefined,
        failureCode: undefined,
        failureEvidenceRef: undefined,
        systemErrorReference: undefined,
        successorJobId: undefined,
      } as unknown as DurableJobRecord);
      const intent = auditIntent(successor, { eventType: "JOB_RETRY_SUBMITTED", eventCategory: "COMMAND_ACCEPTED", action: "job.retry", outcome: "ACCEPTED", mutationIdentity: input.commandId, principalProvenance: input.principalProvenance, correlationId: input.correlationId, reason: input.reasonRef, evidenceRefs: [...input.authorityEvidenceRefs, ...input.eligibilityEvidenceRefs, `job:${predecessor.id}`], committedAt });
      this.#insertJob(successor);
      this.#insertHistory(successor);
      this.#database.prepare("INSERT INTO jobs_successor_lineage (predecessor_job_id, successor_job_id, command_id, created_at) VALUES (?, ?, ?, ?)").run(predecessor.id, successor.id, input.commandId, committedAt);
      this.#insertIntent(intent);
      this.#insertIdempotency("RetryAsSuccessor", input.commandId, fingerprint, { jobId: predecessor.id, successorJobId: successor.id });
      return snapshot({ status: "STORED" as const, predecessor, successor });
    });
  }

  public listHistory(input: AccessInput): readonly DurableJobRecord[] {
    this.readJob(input);
    return Object.freeze(this.#database.prepare("SELECT payload_json FROM jobs_job_history WHERE job_id = ? ORDER BY version").all(input.jobId).map((row) => decodeJob(required(row["payload_json"]))));
  }

  public listAuditIntents(input: Readonly<{ tenantId: string; scopeRef: string }>): readonly JobAuditIntent[] {
    this.#assertOpen();
    if (!safeIdentifier(input.tenantId) || !safeReference(input.scopeRef)) throw failure("PERSISTENCE_INPUT_INVALID");
    return Object.freeze(this.#database.prepare("SELECT intent_id, job_id, tenant_id, scope_ref, payload_json FROM jobs_audit_intents WHERE tenant_id = ? AND scope_ref = ? ORDER BY intent_id").all(input.tenantId, input.scopeRef).map((row) => {
      const intent = decodeIntent(required(row["payload_json"]));
      if (row["intent_id"] !== intent.intentId || row["job_id"] !== intent.aggregateId || intent.visibility.kind !== "TENANT_BOUND" || row["tenant_id"] !== intent.visibility.tenantId || row["scope_ref"] !== intent.visibility.scopeRef) throw failure("PERSISTENCE_UNAVAILABLE");
      return intent;
    }));
  }

  public close(): void {
    if (!this.#closed) { this.#database.close(); this.#closed = true; }
  }

  #persistTransition(current: DurableJobRecord, updated: DurableJobRecord, intent: JobAuditIntent): void {
    this.#transaction(() => { this.#updateJob(current, updated); this.#insertHistory(updated); this.#insertIntent(intent); });
  }
  #insertJob(job: DurableJobRecord): void {
    this.#database.prepare("INSERT INTO jobs_job_records (job_id, tenant_id, scope_ref, version, status, immutable_fingerprint, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)").run(job.id, job.tenantId, job.scopeRef, job.version, job.status, immutableFingerprint(job), JSON.stringify(job));
  }
  #updateJob(current: DurableJobRecord, updated: DurableJobRecord): void {
    if (immutableFingerprint(current) !== immutableFingerprint(updated)) throw failure("PERSISTENCE_INPUT_INVALID");
    const result = this.#database.prepare("UPDATE jobs_job_records SET version = ?, status = ?, payload_json = ? WHERE job_id = ? AND version = ? AND immutable_fingerprint = ?").run(updated.version, updated.status, JSON.stringify(updated), current.id, current.version, immutableFingerprint(current));
    if (Number(result.changes) !== 1) throw failure("VERSION_CONFLICT");
  }
  #insertHistory(job: DurableJobRecord): void { this.#database.prepare("INSERT INTO jobs_job_history (job_id, version, payload_json) VALUES (?, ?, ?)").run(job.id, job.version, JSON.stringify(job)); }
  #insertIntent(intent: JobAuditIntent): void {
    this.#beforeAuditIntentWrite?.();
    this.#database.prepare("INSERT INTO jobs_audit_intents (intent_id, job_id, tenant_id, scope_ref, payload_json) VALUES (?, ?, ?, ?, ?)").run(intent.intentId, intent.aggregateId, intent.visibility.kind === "TENANT_BOUND" ? intent.visibility.tenantId : "", intent.visibility.scopeRef, JSON.stringify(intent));
  }
  #insertIdempotency(operation: string, commandId: string, fingerprint: string, result: IdempotencyRecord["result"]): void { this.#database.prepare("INSERT INTO jobs_command_idempotency (operation, command_id, fingerprint, result_json) VALUES (?, ?, ?, ?)").run(operation, commandId, fingerprint, JSON.stringify(result)); }
  #readIdempotency(operation: string, commandId: string, fingerprint: string): IdempotencyRecord | undefined {
    const row = this.#database.prepare("SELECT fingerprint, result_json FROM jobs_command_idempotency WHERE operation = ? AND command_id = ?").get(operation, commandId);
    if (row === undefined) return undefined;
    if (row["fingerprint"] !== fingerprint) throw failure("IDEMPOTENCY_CONFLICT");
    const parsed = parse(required(row["result_json"]));
    if (!plain(parsed) || !Object.keys(parsed).every((key) => key === "jobId" || key === "successorJobId") || !safeIdentifier(parsed["jobId"]) || (parsed["successorJobId"] !== undefined && !safeIdentifier(parsed["successorJobId"]))) throw failure("PERSISTENCE_UNAVAILABLE");
    return snapshot({ fingerprint, result: { jobId: parsed["jobId"], ...(parsed["successorJobId"] === undefined ? {} : { successorJobId: parsed["successorJobId"] }) } });
  }
  #readJob(jobId: string): DurableJobRecord | undefined {
    try {
      const job = this.#readJobRecord(jobId);
      if (job === undefined) return undefined;
      this.#assertHistoryIntegrity(job);
      this.#assertLineageIntegrity(job);
      return job;
    } catch (error) {
      if (error instanceof DurableJobStoreError) throw error;
      throw failure("PERSISTENCE_UNAVAILABLE");
    }
  }
  #readJobRecord(jobId: string): DurableJobRecord | undefined {
    const row = this.#database.prepare("SELECT job_id, tenant_id, scope_ref, version, status, immutable_fingerprint, payload_json FROM jobs_job_records WHERE job_id = ?").get(jobId);
    if (row === undefined) return undefined;
    const job = decodeJob(required(row["payload_json"]));
    if (row["job_id"] !== jobId || job.id !== jobId || row["tenant_id"] !== job.tenantId || row["scope_ref"] !== job.scopeRef || row["version"] !== job.version || row["status"] !== job.status || row["immutable_fingerprint"] !== immutableFingerprint(job)) throw failure("PERSISTENCE_UNAVAILABLE");
    return job;
  }
  #assertHistoryIntegrity(job: DurableJobRecord): void {
    const rows = this.#database.prepare("SELECT version, payload_json FROM jobs_job_history WHERE job_id = ? ORDER BY version").all(job.id);
    if (rows.length !== job.version) throw failure("PERSISTENCE_UNAVAILABLE");
    let latest: DurableJobRecord | undefined;
    for (let index = 0; index < rows.length; index += 1) {
      const historical = decodeJob(required(rows[index]?.["payload_json"]));
      if (rows[index]?.["version"] !== index + 1 || historical.id !== job.id || historical.version !== index + 1 || immutableFingerprint(historical) !== immutableFingerprint(job)) throw failure("PERSISTENCE_UNAVAILABLE");
      latest = historical;
    }
    if (latest === undefined || canonical(latest) !== canonical(job)) throw failure("PERSISTENCE_UNAVAILABLE");
  }
  #assertLineageIntegrity(job: DurableJobRecord): void {
    const predecessorRow = this.#database.prepare("SELECT predecessor_job_id, command_id FROM jobs_successor_lineage WHERE successor_job_id = ?").get(job.id);
    if (job.predecessorJobId === undefined) {
      if (predecessorRow !== undefined) throw failure("PERSISTENCE_UNAVAILABLE");
    } else {
      if (predecessorRow?.["predecessor_job_id"] !== job.predecessorJobId || predecessorRow["command_id"] !== job.idempotencyKey) throw failure("PERSISTENCE_UNAVAILABLE");
      const predecessor = this.#readJobRecord(job.predecessorJobId);
      if (predecessor?.tenantId !== job.tenantId || predecessor.scopeRef !== job.scopeRef) throw failure("PERSISTENCE_UNAVAILABLE");
      this.#assertSuccessorInheritance(predecessor, job);
    }
    const successorRow = this.#database.prepare("SELECT successor_job_id, command_id FROM jobs_successor_lineage WHERE predecessor_job_id = ?").get(job.id);
    if (successorRow === undefined) return;
    const successorId = stringValue(successorRow["successor_job_id"]);
    const successor = this.#readJobRecord(successorId);
    if (successor?.predecessorJobId !== job.id || successor.idempotencyKey !== successorRow["command_id"] || successor.tenantId !== job.tenantId || successor.scopeRef !== job.scopeRef) throw failure("PERSISTENCE_UNAVAILABLE");
    this.#assertSuccessorInheritance(job, successor);
  }
  #assertSuccessorInheritance(predecessor: DurableJobRecord, successor: DurableJobRecord): void {
    if (predecessor.status !== "FAILED" || predecessor.failureCode !== "DEPENDENCY_UNAVAILABLE" || successor.causationId !== predecessor.id || successor.jobType !== predecessor.jobType || canonical(successor.inputReferences) !== canonical(predecessor.inputReferences) || successor.purpose !== predecessor.purpose || successor.privacyClassification !== predecessor.privacyClassification || successor.deadline !== predecessor.deadline || successor.policyVersion !== predecessor.policyVersion || successor.attempt !== predecessor.attempt) throw failure("PERSISTENCE_UNAVAILABLE");
  }
  #requiredJob(jobId: string): DurableJobRecord { if (!safeIdentifier(jobId)) throw failure("PERSISTENCE_INPUT_INVALID"); const job = this.#readJob(jobId); if (job === undefined) throw failure("JOB_NOT_FOUND"); return job; }
  #requiredBoundJob(jobId: string, input: Readonly<{ tenantId: string; scopeRef: string }>): DurableJobRecord { const job = this.#requiredJob(jobId); assertBinding(job, input); return job; }
  #lineageSuccessor(predecessorId: string): string | undefined { const row = this.#database.prepare("SELECT successor_job_id FROM jobs_successor_lineage WHERE predecessor_job_id = ?").get(predecessorId); return row === undefined ? undefined : stringValue(row["successor_job_id"]); }
  #transaction<T>(run: () => T): T {
    let began = false;
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      began = true;
      const result = run();
      this.#database.exec("COMMIT");
      return result;
    } catch (error) {
      if (began) try { this.#database.exec("ROLLBACK"); } catch { /* preserve original */ }
      if (error instanceof DurableJobStoreError) throw error;
      throw failure("PERSISTENCE_UNAVAILABLE");
    }
  }
  #now(): string { const value = this.#clock(); if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw failure("PERSISTENCE_INPUT_INVALID"); return value.toISOString(); }
  #assertOpen(): void { if (this.#closed) throw failure("PERSISTENCE_UNAVAILABLE"); }
}

export function normalizeJobFailure(input: Readonly<{ kind: JobFailureCode; evidenceRef: string }>): NormalizedJobFailure {
  if ((input.kind !== "DEPENDENCY_UNAVAILABLE" && input.kind !== "JOB_RESULT_INVALID") || !safeReference(input.evidenceRef)) throw failure("JOB_RESULT_INVALID");
  const value = snapshot({ code: input.kind, evidenceRef: input.evidenceRef });
  issuedFailures.add(value);
  return value;
}

function validateSubmission(input: SubmitDurableJobInput): void {
  if (!safeIdentifier(input.commandId) || !jobTypes.has(input.jobType) || !Array.isArray(input.inputReferences) || input.inputReferences.length === 0 || !input.inputReferences.every(validInputReference)
    || !safeIdentifier(input.tenantId) || !safeReference(input.scopeRef) || !safeText(input.purpose) || !classifications.has(input.privacyClassification) || !instant(input.deadline)
    || !validProvenance(input.principalProvenance) || !safeReferences(input.authorityEvidenceRefs) || !safeText(input.policyVersion) || !safeIdentifier(input.correlationId) || !safeIdentifier(input.causationId)) throw failure("PERSISTENCE_INPUT_INVALID");
}
function validateAccess(input: AccessInput): void { if (!safeIdentifier(input.jobId) || !safeIdentifier(input.tenantId) || !safeReference(input.scopeRef)) throw failure("PERSISTENCE_INPUT_INVALID"); }
function validateTransitionInput(input: InternalTransitionInput): void { if (!safeIdentifier(input.jobId) || !positiveInteger(input.expectedVersion) || !safeIdentifier(input.correlationId) || !safeReferences(input.evidenceRefs)) throw failure("PERSISTENCE_INPUT_INVALID"); }
function validatePrincipalCommand(input: PrincipalCommandInput): void { if (!safeIdentifier(input.commandId) || !safeIdentifier(input.jobId) || !safeIdentifier(input.tenantId) || !safeReference(input.scopeRef) || !positiveInteger(input.expectedVersion) || !validProvenance(input.principalProvenance) || !safeReferences(input.authorityEvidenceRefs) || !safeIdentifier(input.correlationId)) throw failure("PERSISTENCE_INPUT_INVALID"); }
function validInputReference(value: JobInputReference): boolean { return plain(value) && Object.keys(value).every((key) => ["type", "id", "version", "checksum"].includes(key)) && safeText(value.type) && safeIdentifier(value.id) && positiveInteger(value.version) && safeReference(value.checksum); }
function validProvenance(value: unknown): value is AuditPrincipalProvenance {
  if (!plain(value)) return false;
  if (value["kind"] === "TRUSTED_SNAPSHOT") return Object.keys(value).every((key) => ["kind", "principal"].includes(key)) && validPrincipal(value["principal"]);
  return value["kind"] === "IMMUTABLE_REFERENCE" && Object.keys(value).every((key) => ["kind", "principalId", "evidenceRef"].includes(key)) && safeIdentifier(value["principalId"]) && safeReference(value["evidenceRef"]);
}
function validPrincipal(value: unknown): value is AuditPrincipal { if (!plain(value)) return false; return Object.keys(value).every((key) => ["id", "type", "roles", "teamId", "sessionId"].includes(key)) && safeIdentifier(value["id"]) && (value["type"] === "HUMAN" || value["type"] === "SERVICE") && Array.isArray(value["roles"]) && value["roles"].length <= 20 && value["roles"].every((role) => roles.has(role as RoleCode)) && (value["teamId"] === undefined || safeIdentifier(value["teamId"])) && (value["sessionId"] === undefined || safeIdentifier(value["sessionId"])); }
function principal(value: AuditPrincipalProvenance): AuditPrincipal { if (value.kind !== "TRUSTED_SNAPSHOT") throw failure("PERSISTENCE_INPUT_INVALID"); return value.principal; }
function componentProvenance(id: "JOBS_API_017_WORKER" | "JOBS_API_017_CONTROL"): AuditPrincipalProvenance { return snapshot({ kind: "TRUSTED_SNAPSHOT" as const, principal: { id, type: "SERVICE" as const, roles: ["SVC" as const] } }); }

function auditIntent(job: DurableJobRecord, input: Readonly<{ eventType: "JOB_SUBMITTED" | "JOB_STARTED" | "JOB_SUCCEEDED" | "JOB_FAILED" | "JOB_CANCELLED" | "JOB_EXPIRED" | "JOB_RETRY_SUBMITTED"; eventCategory: "COMMAND_ACCEPTED" | "STATE_CHANGED"; action: string; outcome: "ACCEPTED" | "COMPLETED" | "FAILED"; mutationIdentity: string; principalProvenance: AuditPrincipalProvenance; correlationId: string; reason?: string; evidenceRefs: readonly string[]; committedAt: string }>): JobAuditIntent {
  if (!safeIdentifier(input.mutationIdentity) || !safeIdentifier(input.correlationId) || (input.reason !== undefined && !safeReference(input.reason)) || !safeReferences(input.evidenceRefs) || !validProvenance(input.principalProvenance)) throw failure("PERSISTENCE_INPUT_INVALID");
  return snapshot({ auditIntentContractVersion: "v2", intentId: `job:${job.id}:v${String(job.version)}:${input.eventType}`, sourceDomain: "API-017", aggregateId: job.id, mutationIdentity: input.mutationIdentity, eventType: input.eventType, eventCategory: input.eventCategory, action: input.action, target: { type: "BackgroundJob", id: job.id, version: job.version }, principalProvenance: input.principalProvenance, visibility: { kind: "TENANT_BOUND", tenantId: job.tenantId, scopeRef: job.scopeRef }, purpose: job.purpose, policyVersion: job.policyVersion, classification: job.privacyClassification, decision: "ALLOW", outcome: input.outcome, committedAt: input.committedAt, correlationId: input.correlationId, ...(input.reason === undefined ? {} : { reason: input.reason }), evidenceRefs: Object.freeze([...new Set(input.evidenceRefs)].sort()) });
}

function decodeJob(value: SQLOutputValue): DurableJobRecord {
  const parsed = parse(value);
  const allowed = new Set(["id", "jobType", "status", "version", "attempt", "inputReferences", "purpose", "privacyClassification", "deadline", "idempotencyKey", "requestedBy", "requestedByType", "teamId", "causationId", "createdAt", "startedAt", "completedAt", "workerId", "resultReference", "resultChecksum", "failureCode", "failureEvidenceRef", "systemErrorReference", "predecessorJobId", "successorJobId", "tenantId", "scopeRef", "originatingDomainCommandId", "policyVersion", "principalProvenance", "authorityEvidenceRefs"]);
  if (!plain(parsed) || !Object.keys(parsed).every((key) => allowed.has(key)) || !safeIdentifier(parsed["id"]) || !jobTypes.has(parsed["jobType"] as DurableJobType) || !statuses.has(parsed["status"] as JobStatus) || !positiveInteger(parsed["version"]) || !Number.isInteger(parsed["attempt"]) || Number(parsed["attempt"]) < 0
    || !Array.isArray(parsed["inputReferences"]) || parsed["inputReferences"].length === 0 || !parsed["inputReferences"].every(validInputReference) || !safeText(parsed["purpose"]) || !classifications.has(parsed["privacyClassification"] as DataClassification)
    || !instant(parsed["deadline"]) || !safeIdentifier(parsed["idempotencyKey"]) || !safeIdentifier(parsed["requestedBy"]) || (parsed["requestedByType"] !== "HUMAN" && parsed["requestedByType"] !== "SERVICE") || !safeIdentifier(parsed["causationId"]) || !instant(parsed["createdAt"])
    || !safeIdentifier(parsed["tenantId"]) || !safeReference(parsed["scopeRef"]) || !safeIdentifier(parsed["originatingDomainCommandId"]) || !safeText(parsed["policyVersion"]) || !validProvenance(parsed["principalProvenance"]) || !safeReferences(parsed["authorityEvidenceRefs"])) throw failure("PERSISTENCE_UNAVAILABLE");
  for (const key of ["startedAt", "completedAt"] as const) if (parsed[key] !== undefined && !instant(parsed[key])) throw failure("PERSISTENCE_UNAVAILABLE");
  for (const key of ["teamId", "workerId", "predecessorJobId", "successorJobId"] as const) if (parsed[key] !== undefined && !safeIdentifier(parsed[key])) throw failure("PERSISTENCE_UNAVAILABLE");
  for (const key of ["resultReference", "resultChecksum"] as const) if (parsed[key] !== undefined && !safeReference(parsed[key])) throw failure("PERSISTENCE_UNAVAILABLE");
  if (parsed["failureEvidenceRef"] !== undefined && !safeReference(parsed["failureEvidenceRef"])) throw failure("PERSISTENCE_UNAVAILABLE");
  if (parsed["failureCode"] !== undefined && parsed["failureCode"] !== "DEPENDENCY_UNAVAILABLE" && parsed["failureCode"] !== "JOB_RESULT_INVALID") throw failure("PERSISTENCE_UNAVAILABLE");
  if (parsed["systemErrorReference"] !== undefined && !validSystemError(parsed["systemErrorReference"])) throw failure("PERSISTENCE_UNAVAILABLE");
  if (!validLifecycleShape(parsed)) throw failure("PERSISTENCE_UNAVAILABLE");
  return jobSnapshot(parsed as unknown as DurableJobRecord);
}
function validLifecycleShape(value: Record<string, unknown>): boolean {
  const status = value["status"] as JobStatus;
  const hasStarted = value["startedAt"] !== undefined;
  const hasCompleted = value["completedAt"] !== undefined;
  const hasWorker = value["workerId"] !== undefined;
  const hasResult = value["resultReference"] !== undefined || value["resultChecksum"] !== undefined;
  const hasFailure = value["failureCode"] !== undefined || value["failureEvidenceRef"] !== undefined || value["systemErrorReference"] !== undefined;
  if (hasStarted !== hasWorker || (hasStarted && !positiveInteger(value["attempt"]))) return false;
  if (hasStarted && Date.parse(value["startedAt"] as string) < Date.parse(value["createdAt"] as string)) return false;
  if (hasCompleted && Date.parse(value["completedAt"] as string) < Date.parse(value["createdAt"] as string)) return false;
  if (hasStarted && hasCompleted && Date.parse(value["completedAt"] as string) < Date.parse(value["startedAt"] as string)) return false;
  if (status === "QUEUED") return !hasStarted && !hasCompleted && !hasResult && !hasFailure;
  if (status === "RUNNING") return hasStarted && !hasCompleted && !hasResult && !hasFailure && value["workerId"] === "JOBS_API_017_WORKER";
  if (status === "SUCCEEDED") return hasStarted && hasCompleted && value["workerId"] === "JOBS_API_017_WORKER" && value["resultReference"] !== undefined && value["resultChecksum"] !== undefined && !hasFailure;
  if (status === "FAILED") return hasStarted && hasCompleted && value["workerId"] === "JOBS_API_017_WORKER" && !hasResult && value["failureCode"] !== undefined && value["failureEvidenceRef"] !== undefined && value["systemErrorReference"] !== undefined;
  return hasCompleted && !hasResult && !hasFailure;
}
function validSystemError(value: unknown): value is SystemErrorReference { return plain(value) && Object.keys(value).every((key) => ["id", "category", "code", "retryable", "occurredAt"].includes(key)) && safeIdentifier(value["id"]) && (value["category"] === "DEPENDENCY" || value["category"] === "PROCESSING") && (value["code"] === "DEPENDENCY_UNAVAILABLE" || value["code"] === "JOB_RESULT_INVALID") && typeof value["retryable"] === "boolean" && instant(value["occurredAt"]); }
function decodeIntent(value: SQLOutputValue): JobAuditIntent {
  const parsed = parse(value);
  const allowed = new Set(["auditIntentContractVersion", "intentId", "sourceDomain", "aggregateId", "mutationIdentity", "eventType", "eventCategory", "action", "target", "principalProvenance", "visibility", "purpose", "policyVersion", "classification", "decision", "outcome", "committedAt", "correlationId", "reason", "evidenceRefs"]);
  if (!plain(parsed) || !Object.keys(parsed).every((key) => allowed.has(key)) || parsed["auditIntentContractVersion"] !== "v2" || parsed["sourceDomain"] !== "API-017" || !safeIdentifier(parsed["intentId"]) || !safeIdentifier(parsed["aggregateId"]) || !safeIdentifier(parsed["mutationIdentity"]) || !safeText(parsed["eventType"])
    || !validAuditMapping(parsed) || !plain(parsed["target"]) || !Object.keys(parsed["target"]).every((key) => ["type", "id", "version"].includes(key)) || parsed["target"]["type"] !== "BackgroundJob" || parsed["target"]["id"] !== parsed["aggregateId"] || !positiveInteger(parsed["target"]["version"])
    || parsed["intentId"] !== `job:${parsed["aggregateId"]}:v${String(parsed["target"]["version"])}:${parsed["eventType"]}` || !validProvenance(parsed["principalProvenance"]) || !plain(parsed["visibility"]) || !Object.keys(parsed["visibility"]).every((key) => ["kind", "tenantId", "scopeRef"].includes(key)) || parsed["visibility"]["kind"] !== "TENANT_BOUND" || !safeIdentifier(parsed["visibility"]["tenantId"]) || !safeReference(parsed["visibility"]["scopeRef"])
    || !safeText(parsed["purpose"]) || !safeText(parsed["policyVersion"]) || !classifications.has(parsed["classification"] as DataClassification) || parsed["decision"] !== "ALLOW" || !instant(parsed["committedAt"]) || !safeIdentifier(parsed["correlationId"]) || (parsed["reason"] !== undefined && !safeReference(parsed["reason"])) || !safeReferences(parsed["evidenceRefs"])) throw failure("PERSISTENCE_UNAVAILABLE");
  return snapshot(parsed as unknown as JobAuditIntent);
}
function validAuditMapping(value: Record<string, unknown>): boolean {
  const mapping = auditMappings[value["eventType"] as keyof typeof auditMappings];
  return mapping !== undefined && value["eventCategory"] === mapping.eventCategory && value["action"] === mapping.action && value["outcome"] === mapping.outcome;
}

function immutableFingerprint(job: DurableJobRecord): string { return fingerprintOf({ id: job.id, jobType: job.jobType, inputReferences: job.inputReferences, purpose: job.purpose, privacyClassification: job.privacyClassification, deadline: job.deadline, idempotencyKey: job.idempotencyKey, requestedBy: job.requestedBy, requestedByType: job.requestedByType, teamId: job.teamId, causationId: job.causationId, createdAt: job.createdAt, tenantId: job.tenantId, scopeRef: job.scopeRef, originatingDomainCommandId: job.originatingDomainCommandId, policyVersion: job.policyVersion, principalProvenance: job.principalProvenance, authorityEvidenceRefs: job.authorityEvidenceRefs, predecessorJobId: job.predecessorJobId }); }
function assertVersion(job: DurableJobRecord, expected: number): void { if (!positiveInteger(expected) || job.version !== expected) throw failure("VERSION_CONFLICT"); }
function assertBinding(job: DurableJobRecord, input: Readonly<{ tenantId: string; scopeRef: string }>): void { if (job.tenantId !== input.tenantId || job.scopeRef !== input.scopeRef) throw failure("JOB_NOT_FOUND"); }
function assertNotTerminal(job: DurableJobRecord): void { if (terminalStatuses.has(job.status)) throw failure("JOB_ALREADY_TERMINAL"); }
function validateDatabase(database: DatabaseSync): void { if (database.prepare("PRAGMA integrity_check").get()?.["integrity_check"] !== "ok") throw failure("PERSISTENCE_UNAVAILABLE"); const golden = new DatabaseSync(":memory:"); try { golden.exec(SCHEMA); const sql = "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type IN ('table','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type, name"; if (JSON.stringify(database.prepare(sql).all()) !== JSON.stringify(golden.prepare(sql).all())) throw failure("PERSISTENCE_UNAVAILABLE"); } finally { golden.close(); } }
function validDatabasePath(value: string): boolean { return typeof value === "string" && value.length > 0 && isAbsolute(value) && value !== ":memory:" && !value.startsWith("file:"); }
function safeIdentifier(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 256 && value.trim() === value && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value) && !isUnsafeSecurityDetailValue(value); }
function safeText(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value) && !isUnsafeSecurityDetailValue(value); }
function safeReference(value: unknown): value is string { return safeText(value) && /^[A-Za-z][A-Za-z0-9._-]{0,63}:[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(value); }
function safeReferences(value: unknown): value is readonly string[] { return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every(safeReference); }
function positiveInteger(value: unknown): boolean { return Number.isInteger(value) && Number(value) > 0; }
function instant(value: unknown): value is string { return safeText(value) && !Number.isNaN(Date.parse(value)); }
function parse(value: SQLOutputValue): unknown { if (typeof value !== "string") throw failure("PERSISTENCE_UNAVAILABLE"); try { return JSON.parse(value); } catch { throw failure("PERSISTENCE_UNAVAILABLE"); } }
function required(value: SQLOutputValue | undefined): SQLOutputValue { if (value === undefined) throw failure("PERSISTENCE_UNAVAILABLE"); return value; }
function stringValue(value: SQLOutputValue | undefined): string { if (typeof value !== "string") throw failure("PERSISTENCE_UNAVAILABLE"); return value; }
function plain(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function fingerprintOf(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }
function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (plain(value)) return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`; return JSON.stringify(value); }
function snapshot<T>(value: T): T { const copy = structuredClone(value); deepFreeze(copy); return copy; }
function jobSnapshot(value: DurableJobRecord): DurableJobRecord { const copy = structuredClone(value) as unknown as Record<string, unknown>; for (const key of Object.keys(copy)) if (copy[key] === undefined) delete copy[key]; return snapshot(copy as unknown as DurableJobRecord); }
function deepFreeze(value: unknown): void { if (value === null || typeof value !== "object" || Object.isFrozen(value)) return; for (const nested of Object.values(value)) deepFreeze(nested); Object.freeze(value); }
function failure(code: DurableJobStoreErrorCode): DurableJobStoreError { return new DurableJobStoreError(code); }
