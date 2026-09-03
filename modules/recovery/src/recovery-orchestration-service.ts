import { createHash } from "node:crypto";
import { hasVerifiedMfaAssurance, isAuthenticationAssuranceConsistent, type SessionContext } from "../../identity/src/session-service.js";
import type {
  CreateRecoveryCaseInput,
  RecoveryCaseRecord,
  RecoveryOrchestrationStore,
  RecoveryOriginDomain,
  RecoveryOriginIdentity,
  RecoveryDisposition,
  RecoveryExecutionIdentity,
  RecoveryActionType,
  ReconciliationFinding,
} from "./recovery-orchestration-contracts.js";
import { RecoveryStoreError } from "./recovery-orchestration-contracts.js";

export type {
  CreateRecoveryCaseInput,
  RecoveryCaseRecord,
  RecoveryOrchestrationStore,
} from "./recovery-orchestration-contracts.js";

export interface RecoveryTrustedContext {
  readonly session: SessionContext;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly purpose: string;
}

export interface RecoveryContextResolver {
  resolve(sessionId: string): RecoveryTrustedContext | undefined;
}

type RecoveryOperation = "CREATE_RECOVERY_CASE" | "RESOLVE_RECOVERY_CASE" | "AUTHORIZE_RECOVERY" | "READ_RECOVERY_CASE";

export interface RecoveryAuthorizer {
  authorize(input: Readonly<{
    context: RecoveryTrustedContext;
    operation: RecoveryOperation;
    resourceType: string;
    resourceId: string;
  }>): boolean;
}

export interface RecoveryExecutionIdentityValidator {
  validate(input: Readonly<{ recoveryCase: RecoveryCaseRecord; recoveryActionType: RecoveryActionType; recoveryExecutionIdentity: RecoveryExecutionIdentity }>): boolean;
}

export interface RecoveryClock {
  now(): string;
}

interface RecoveryOrchestrationDependencies {
  readonly store: RecoveryOrchestrationStore;
  readonly contextResolver: RecoveryContextResolver;
  readonly authorizer: RecoveryAuthorizer;
  readonly executionIdentityValidator: RecoveryExecutionIdentityValidator;
  readonly clock: RecoveryClock;
}

type ApplicationResult =
  | Readonly<{ ok: true; operation: "CREATE_RECOVERY_CASE"; data: CreateRecoveryCaseView }>
  | Readonly<{ ok: true; operation: "RESOLVE_RECOVERY_CASE"; data: ResolveRecoveryView; replay: boolean }>
  | Readonly<{ ok: true; operation: "AUTHORIZE_RECOVERY"; data: AuthorizeRecoveryView; replay: boolean }>
  | Readonly<{ ok: true; operation: "READ_RECOVERY_CASE"; data: ReadRecoveryCaseView }>
  | Readonly<{ ok: false; error: Readonly<{ code: string; message: string }> }>;

const validationFailure = (): ApplicationResult => Object.freeze({
  ok: false,
  error: Object.freeze({ code: "VALIDATION_FAILED", message: "Recovery operation could not be completed." }),
});

const authenticationFailure = (): ApplicationResult => Object.freeze({
  ok: false,
  error: Object.freeze({ code: "AUTHENTICATION_REQUIRED", message: "Recovery operation could not be completed." }),
});

const authorizationFailure = (): ApplicationResult => Object.freeze({
  ok: false,
  error: Object.freeze({ code: "NOT_AUTHORIZED", message: "Recovery operation could not be completed." }),
});

const notFoundFailure = (): ApplicationResult => Object.freeze({
  ok: false,
  error: Object.freeze({ code: "NOT_FOUND", message: "Recovery operation could not be completed." }),
});

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOnlyKeys(value: Readonly<Record<string, unknown>>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function parseOriginIdentity(domain: RecoveryOriginDomain, value: unknown): RecoveryOriginIdentity | undefined {
  if (!isRecord(value)) return undefined;
  if (domain === "PUBLICATION") {
    if (!hasOnlyKeys(value, ["reconciliationCaseId", "attemptId"]) || !isNonEmptyString(value["reconciliationCaseId"]) || !isNonEmptyString(value["attemptId"])) return undefined;
    return Object.freeze({ reconciliationCaseId: value["reconciliationCaseId"], attemptId: value["attemptId"] });
  }
  if (domain === "CONNECTOR") {
    if (!hasOnlyKeys(value, ["invocationId"]) || !isNonEmptyString(value["invocationId"])) return undefined;
    return Object.freeze({ invocationId: value["invocationId"] });
  }
  if (!hasOnlyKeys(value, ["integrationContractId", "mappingId", "observationId", "conflictEvidenceId"]) || !isNonEmptyString(value["integrationContractId"])) return undefined;
  const optionalIds = [value["mappingId"], value["observationId"], value["conflictEvidenceId"]];
  if (!optionalIds.some(isNonEmptyString) || optionalIds.some((item) => item !== undefined && !isNonEmptyString(item))) return undefined;
  return Object.freeze({
    integrationContractId: value["integrationContractId"],
    ...(isNonEmptyString(value["mappingId"]) ? { mappingId: value["mappingId"] } : {}),
    ...(isNonEmptyString(value["observationId"]) ? { observationId: value["observationId"] } : {}),
    ...(isNonEmptyString(value["conflictEvidenceId"]) ? { conflictEvidenceId: value["conflictEvidenceId"] } : {}),
  });
}

function parseCreate(payload: unknown): Omit<CreateRecoveryCaseInput, "tenantId" | "scopeRef" | "createdBy" | "createdAt"> | undefined {
  if (!isRecord(payload) || !hasOnlyKeys(payload, ["operation", "originDomain", "originIdentity", "resourceType", "resourceId", "parentRecoveryCaseId", "evidenceRefs"])) return undefined;
  if (payload["operation"] !== "CREATE_RECOVERY_CASE" || !["PUBLICATION", "CONNECTOR", "EXTERNAL_INTEGRATION"].includes(String(payload["originDomain"]))) return undefined;
  if (!isNonEmptyString(payload["resourceType"]) || !isNonEmptyString(payload["resourceId"])) return undefined;
  if (payload["parentRecoveryCaseId"] !== undefined && !isNonEmptyString(payload["parentRecoveryCaseId"])) return undefined;
  if (!Array.isArray(payload["evidenceRefs"]) || payload["evidenceRefs"].length === 0 || !payload["evidenceRefs"].every(isNonEmptyString)) return undefined;
  const originDomain = payload["originDomain"] as RecoveryOriginDomain;
  const originIdentity = parseOriginIdentity(originDomain, payload["originIdentity"]);
  if (!originIdentity) return undefined;
  return Object.freeze({
    resourceType: payload["resourceType"],
    resourceId: payload["resourceId"],
    originDomain,
    originIdentity,
    ...(isNonEmptyString(payload["parentRecoveryCaseId"]) ? { parentRecoveryCaseId: payload["parentRecoveryCaseId"] } : {}),
    evidenceRefs: Object.freeze([...payload["evidenceRefs"]]),
  });
}

export type ResolveRecoveryView = Readonly<{ recoveryCaseId: string; finding: ReconciliationFinding; caseStatus: RecoveryCaseRecord["status"]; version: number; findingRecordId: string; evidenceRefs: readonly string[]; resolvedAt: string | null }>;
export type AuthorizeRecoveryView = Readonly<{ recoveryId: string; recoveryCaseId: string; reconciliationFinding: ReconciliationFinding; recoveryDisposition: RecoveryDisposition; recoveryActionType: RecoveryActionType; recoveryExecutionIdentity?: RecoveryExecutionIdentity; version: number; dispositionRecordId: string; createdAt: string }>;
export type CreateRecoveryCaseView = Readonly<{ recoveryCaseId: string; status: RecoveryCaseRecord["status"]; version: number; evidenceRefs: readonly string[]; createdAt: string }>;
export type ReadRecoveryCaseView = Readonly<{ recoveryCaseId: string; originDomain: RecoveryCaseRecord["originDomain"]; originIdentity: RecoveryOriginIdentity; status: RecoveryCaseRecord["status"]; finding?: ReconciliationFinding; recoveryId?: string; evidenceRefs: readonly string[]; version: number; createdAt: string; resolvedAt: string | null }>;

type ResolveRequest = Readonly<{ operation: "RESOLVE_RECOVERY_CASE"; recoveryCaseId: string; expectedVersion: number; finding: ReconciliationFinding; reasonCode: string; evidenceRefs: readonly string[]; idempotencyKey: string }>;
type AuthorizeRequest = Readonly<{ operation: "AUTHORIZE_RECOVERY"; recoveryCaseId: string; expectedVersion: number; recoveryDisposition: RecoveryDisposition; recoveryActionType: RecoveryActionType; recoveryExecutionIdentity?: RecoveryExecutionIdentity; evidenceRefs: readonly string[]; idempotencyKey: string }>;
type ReadRequest = Readonly<{ operation: "READ_RECOVERY_CASE"; recoveryCaseId: string }>;

function parseEvidence(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString) ? Object.freeze([...value]) : undefined;
}

function parseResolve(payload: unknown): ResolveRequest | undefined {
  if (!isRecord(payload) || !hasOnlyKeys(payload, ["operation", "recoveryCaseId", "expectedVersion", "finding", "reasonCode", "evidenceRefs", "idempotencyKey"])) return undefined;
  if (payload["operation"] !== "RESOLVE_RECOVERY_CASE" || !isNonEmptyString(payload["recoveryCaseId"]) || !Number.isInteger(payload["expectedVersion"]) || Number(payload["expectedVersion"]) < 1 || !["CONFIRMED_EXECUTED", "CONFIRMED_NOT_EXECUTED", "UNRESOLVED"].includes(String(payload["finding"])) || !isNonEmptyString(payload["reasonCode"]) || !isNonEmptyString(payload["idempotencyKey"])) return undefined;
  const evidenceRefs = parseEvidence(payload["evidenceRefs"]);
  if (!evidenceRefs) return undefined;
  return Object.freeze({ operation: "RESOLVE_RECOVERY_CASE", recoveryCaseId: payload["recoveryCaseId"], expectedVersion: Number(payload["expectedVersion"]), finding: payload["finding"] as ReconciliationFinding, reasonCode: payload["reasonCode"], evidenceRefs, idempotencyKey: payload["idempotencyKey"] });
}

function parseExecutionIdentity(actionType: RecoveryActionType, value: unknown): RecoveryExecutionIdentity | undefined {
  if (!isRecord(value)) return undefined;
  if (actionType === "PUBLICATION_RECOVERY" && hasOnlyKeys(value, ["attemptId", "commandId"]) && isNonEmptyString(value["attemptId"]) && isNonEmptyString(value["commandId"])) return Object.freeze({ attemptId: value["attemptId"], commandId: value["commandId"] });
  if (actionType === "CONNECTOR_REEXECUTION" && hasOnlyKeys(value, ["invocationId"]) && isNonEmptyString(value["invocationId"])) return Object.freeze({ invocationId: value["invocationId"] });
  return undefined;
}

function parseAuthorize(payload: unknown): AuthorizeRequest | undefined {
  if (!isRecord(payload) || !hasOnlyKeys(payload, ["operation", "recoveryCaseId", "expectedVersion", "recoveryDisposition", "recoveryActionType", "recoveryExecutionIdentity", "evidenceRefs", "idempotencyKey"])) return undefined;
  if (payload["operation"] !== "AUTHORIZE_RECOVERY" || !isNonEmptyString(payload["recoveryCaseId"]) || !Number.isInteger(payload["expectedVersion"]) || Number(payload["expectedVersion"]) < 1 || !["RECOVERY_AUTHORIZED", "NO_RECOVERY_REQUIRED", "RECOVERY_REJECTED"].includes(String(payload["recoveryDisposition"])) || !["PUBLICATION_RECOVERY", "CONNECTOR_REEXECUTION"].includes(String(payload["recoveryActionType"])) || !isNonEmptyString(payload["idempotencyKey"])) return undefined;
  const evidenceRefs = parseEvidence(payload["evidenceRefs"]);
  if (!evidenceRefs) return undefined;
  const recoveryDisposition = payload["recoveryDisposition"] as RecoveryDisposition;
  const recoveryActionType = payload["recoveryActionType"] as RecoveryActionType;
  const identity = payload["recoveryExecutionIdentity"] === undefined ? undefined : parseExecutionIdentity(recoveryActionType, payload["recoveryExecutionIdentity"]);
  if ((recoveryDisposition === "RECOVERY_AUTHORIZED") !== (identity !== undefined)) return undefined;
  return Object.freeze({ operation: "AUTHORIZE_RECOVERY", recoveryCaseId: payload["recoveryCaseId"], expectedVersion: Number(payload["expectedVersion"]), recoveryDisposition, recoveryActionType, ...(identity ? { recoveryExecutionIdentity: identity } : {}), evidenceRefs, idempotencyKey: payload["idempotencyKey"] });
}

function parseRead(payload: unknown): ReadRequest | undefined {
  if (!isRecord(payload) || !hasOnlyKeys(payload, ["operation", "recoveryCaseId"]) || payload["operation"] !== "READ_RECOVERY_CASE" || !isNonEmptyString(payload["recoveryCaseId"])) return undefined;
  return Object.freeze({ operation: "READ_RECOVERY_CASE", recoveryCaseId: payload["recoveryCaseId"] });
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export class RecoveryOrchestrationApplication {
  readonly #dependencies: RecoveryOrchestrationDependencies;

  constructor(dependencies: RecoveryOrchestrationDependencies) {
    this.#dependencies = dependencies;
  }

  execute(kind: "COMMAND" | "QUERY", payload: unknown, sessionId: string): ApplicationResult {
    const context = this.#dependencies.contextResolver.resolve(sessionId);
    if (!context || !this.#isCurrentSession(context)) return authenticationFailure();
    if (kind === "COMMAND") {
      const create = parseCreate(payload);
      if (create) return this.#create(create, context);
      const resolve = parseResolve(payload);
      if (resolve) return this.#resolve(resolve, context);
      const authorize = parseAuthorize(payload);
      if (authorize) return this.#authorize(authorize, context);
      return validationFailure();
    }
    const read = parseRead(payload);
    if (!read) return validationFailure();
    const record = this.#dependencies.store.findCase(read.recoveryCaseId);
    if (record?.tenantId !== context.tenantId || record.scopeRef !== context.scopeRef) return notFoundFailure();
    if (!this.#authorizeContext(context, read.operation, record)) return authorizationFailure();
    const data: ReadRecoveryCaseView = Object.freeze({ recoveryCaseId: record.recoveryCaseId, originDomain: record.originDomain, originIdentity: record.originIdentity, status: record.status, ...(record.finding ? { finding: record.finding.finding } : {}), ...(record.disposition ? { recoveryId: record.disposition.recoveryId } : {}), evidenceRefs: record.evidenceRefs, version: record.version, createdAt: record.createdAt, resolvedAt: record.finding && record.finding.finding !== "UNRESOLVED" ? record.finding.decidedAt : null });
    return Object.freeze({ ok: true, operation: read.operation, data });
  }

  #create(request: NonNullable<ReturnType<typeof parseCreate>>, context: RecoveryTrustedContext): ApplicationResult {
    if (!this.#dependencies.authorizer.authorize({ context, operation: "CREATE_RECOVERY_CASE", resourceType: request.resourceType, resourceId: request.resourceId })) return authorizationFailure();
    try {
      const data = this.#dependencies.store.createCase(Object.freeze({ ...request, tenantId: context.tenantId, scopeRef: context.scopeRef, createdBy: context.session.principalId, createdAt: this.#dependencies.clock.now() }));
      const view: CreateRecoveryCaseView = Object.freeze({ recoveryCaseId: data.recoveryCaseId, status: data.status, version: data.version, evidenceRefs: data.evidenceRefs, createdAt: data.createdAt });
      return Object.freeze({ ok: true, operation: "CREATE_RECOVERY_CASE", data: view });
    } catch (error) { return this.#mapStoreError(error); }
  }

  #resolve(request: ResolveRequest, context: RecoveryTrustedContext): ApplicationResult {
    const record = this.#governedRecord(request.recoveryCaseId, context);
    if (!record) return notFoundFailure();
    if (!this.#isPrivilegedHuman(context) || record.createdBy === context.session.principalId || !this.#authorizeContext(context, request.operation, record)) return authorizationFailure();
    if (record.originDomain === "EXTERNAL_INTEGRATION" && request.finding !== "UNRESOLVED") return this.#mapStoreError(new RecoveryStoreError("INVALID_STATE"));
    try {
      const result = this.#dependencies.store.recordFinding({ ...request, decidedBy: context.session.principalId, decidedAt: this.#dependencies.clock.now(), fingerprint: fingerprint(request) });
      const finding = result.record.finding;
      if (!finding) return this.#mapStoreError(new RecoveryStoreError("INVALID_STATE"));
      const data: ResolveRecoveryView = Object.freeze({ recoveryCaseId: result.record.recoveryCaseId, finding: finding.finding, caseStatus: result.record.status, version: result.record.version, findingRecordId: finding.findingRecordId, evidenceRefs: finding.evidenceRefs, resolvedAt: finding.finding === "UNRESOLVED" ? null : finding.decidedAt });
      return Object.freeze({ ok: true, operation: request.operation, data, replay: result.replay });
    } catch (error) { return this.#mapStoreError(error); }
  }

  #authorize(request: AuthorizeRequest, context: RecoveryTrustedContext): ApplicationResult {
    const record = this.#governedRecord(request.recoveryCaseId, context);
    if (!record) return notFoundFailure();
    if (!this.#isPrivilegedHuman(context) || !this.#authorizeContext(context, request.operation, record)) return authorizationFailure();
    if (record.originDomain === "EXTERNAL_INTEGRATION") return this.#mapStoreError(new RecoveryStoreError("INVALID_STATE"));
    if (request.recoveryExecutionIdentity && !this.#dependencies.executionIdentityValidator.validate({ recoveryCase: record, recoveryActionType: request.recoveryActionType, recoveryExecutionIdentity: request.recoveryExecutionIdentity })) return validationFailure();
    try {
      const result = this.#dependencies.store.authorizeRecovery({ ...request, decidedBy: context.session.principalId, decidedAt: this.#dependencies.clock.now(), fingerprint: fingerprint(request) });
      const finding = result.record.finding;
      const disposition = result.record.disposition;
      if (!finding || !disposition) return this.#mapStoreError(new RecoveryStoreError("INVALID_STATE"));
      const data: AuthorizeRecoveryView = Object.freeze({ recoveryId: disposition.recoveryId, recoveryCaseId: result.record.recoveryCaseId, reconciliationFinding: finding.finding, recoveryDisposition: disposition.recoveryDisposition, recoveryActionType: disposition.recoveryActionType, ...(result.record.recovery ? { recoveryExecutionIdentity: result.record.recovery.recoveryExecutionIdentity } : {}), version: result.record.version, dispositionRecordId: disposition.dispositionRecordId, createdAt: disposition.decidedAt });
      return Object.freeze({ ok: true, operation: request.operation, data, replay: result.replay });
    } catch (error) { return this.#mapStoreError(error); }
  }

  #governedRecord(recoveryCaseId: string, context: RecoveryTrustedContext): RecoveryCaseRecord | undefined {
    const record = this.#dependencies.store.findCase(recoveryCaseId);
    return record?.tenantId === context.tenantId && record.scopeRef === context.scopeRef ? record : undefined;
  }

  #authorizeContext(context: RecoveryTrustedContext, operation: RecoveryOperation, record: Pick<RecoveryCaseRecord, "resourceType" | "resourceId">): boolean {
    return this.#dependencies.authorizer.authorize({ context, operation, resourceType: record.resourceType, resourceId: record.resourceId });
  }

  #isCurrentSession(context: RecoveryTrustedContext): boolean {
    const now = Date.parse(this.#dependencies.clock.now());
    return context.session.state === "ACTIVE" && isAuthenticationAssuranceConsistent(context.session) && Number.isFinite(now) && now < Date.parse(context.session.expiresAt) && now < Date.parse(context.session.absoluteExpiresAt);
  }

  #isPrivilegedHuman(context: RecoveryTrustedContext): boolean {
    return context.session.principalType === "HUMAN" && hasVerifiedMfaAssurance(context.session) && context.purpose === "RECONCILIATION_RECOVERY";
  }

  #mapStoreError(error: unknown): ApplicationResult {
    if (error instanceof RecoveryStoreError) return Object.freeze({ ok: false, error: Object.freeze({ code: error.code, message: "Recovery operation could not be completed." }) });
    return Object.freeze({ ok: false, error: Object.freeze({ code: "INTERNAL_ERROR", message: "Recovery operation could not be completed." }) });
  }
}
