import { createHash } from "node:crypto";

import { canonicalAiSchemaId, validateAdvisoryResult, type AdvisoryResultEnvelope, type EntityReference } from "./advisory-ai-service.js";
import { AdvisoryRuntimeError, isSafeAdvisoryEvidenceRef, isSafeAdvisoryPrincipalProvenance, isSafeAdvisoryText, type AcceptedAdvisoryRecord, type AdvisoryAdapter, type AdvisoryAdapterIntent, type AdvisoryExecutionRequest, type AdvisoryPersistence, type AdvisorySnapshotResolver, type TrustedAdvisorySnapshot } from "./advisory-runtime-contracts.js";

interface AdvisoryRuntimeDependencies {
  readonly persistence: AdvisoryPersistence;
  readonly snapshotResolver: AdvisorySnapshotResolver;
  readonly adapter: AdvisoryAdapter;
  readonly clock: () => Date;
}

export class AdvisoryRuntime {
  readonly #persistence: AdvisoryPersistence;
  readonly #snapshotResolver: AdvisorySnapshotResolver;
  readonly #adapter: AdvisoryAdapter;
  readonly #clock: () => Date;

  public constructor(dependencies: AdvisoryRuntimeDependencies) {
    this.#persistence = dependencies.persistence;
    this.#snapshotResolver = dependencies.snapshotResolver;
    this.#adapter = dependencies.adapter;
    this.#clock = dependencies.clock;
  }

  public execute(request: AdvisoryExecutionRequest): AcceptedAdvisoryRecord {
    validateRequest(request);
    if (request.schemaId !== canonicalAiSchemaId(request.capabilityId)) throw runtimeFailure("SCHEMA_CAPABILITY_MISMATCH", "Capability and schema do not match.");
    const snapshot = this.#snapshotResolver.resolve({ tenantId: request.tenantId, scopeRef: request.scopeRef, capabilityId: request.capabilityId, inputReference: request.inputReference });
    if (snapshot === undefined || !matchesSnapshot(request, snapshot)) throw runtimeFailure("ADVISORY_INPUT_UNAVAILABLE", "Trusted Advisory input is unavailable.");
    const prompt = this.#persistence.findPrompt(request.promptId, request.promptVersion);
    if (prompt?.status !== "ACTIVE") throw runtimeFailure("PROMPT_NOT_ACTIVE", "An active prompt identity is required.");
    if (prompt.capabilityId !== request.capabilityId || prompt.schemaId !== request.schemaId) throw runtimeFailure("SCHEMA_CAPABILITY_MISMATCH", "Prompt capability and schema do not match.");
    const executionFingerprint = digest({ adapterVersion: this.#adapter.adapterVersion, capabilityId: request.capabilityId, evidenceFingerprint: snapshot.evidenceFingerprint, inputFingerprint: snapshot.inputFingerprint, promptId: prompt.promptId, promptVersion: prompt.promptVersion, promptFingerprint: prompt.contentFingerprint, schemaId: request.schemaId, ...(request.capabilityVersion === undefined ? {} : { capabilityVersion: request.capabilityVersion }), ...(request.initiatingPrincipalEvidenceRef === undefined ? {} : { initiatingPrincipalEvidenceRef: request.initiatingPrincipalEvidenceRef }), ...(request.initiatingPrincipalProvenance === undefined ? {} : { initiatingPrincipalProvenance: request.initiatingPrincipalProvenance }) });
    const replay = this.#persistence.findReplay(request.tenantId, request.scopeRef, request.idempotencyKey, executionFingerprint);
    if (replay !== undefined) return replay;
    const intent = immutable<AdvisoryAdapterIntent>({ capabilityId: request.capabilityId, ...(request.capabilityVersion === undefined ? {} : { capabilityVersion: request.capabilityVersion }), ...(request.correlationId === undefined ? {} : { correlationId: request.correlationId }), schemaId: request.schemaId, subjectRef: snapshot.subjectRef, provenance: snapshot.provenance, classification: mostRestrictive(snapshot), inputFingerprint: snapshot.inputFingerprint, evidenceFingerprint: snapshot.evidenceFingerprint, promptId: prompt.promptId, promptVersion: prompt.promptVersion, promptFingerprint: prompt.contentFingerprint, executionFingerprint });
    let candidate: unknown;
    try {
      candidate = this.#adapter.generate(intent);
    } catch {
      throw runtimeFailure("ADVISORY_UNAVAILABLE", "Advisory generation is unavailable.");
    }
    const validation = validateAdvisoryResult({ expectedCapabilityId: request.capabilityId, expectedSubject: snapshot.subjectRef, inputClassifications: snapshot.inputClassifications, result: candidate });
    if (validation.status !== "VALID") {
      notifyValidationOutcome(this.#adapter, intent, "ADVISORY_OUTPUT_REJECTED");
      throw runtimeFailure("ADVISORY_OUTPUT_REJECTED", "Advisory output failed canonical validation.");
    }
    notifyValidationOutcome(this.#adapter, intent, "SUCCESS");
    const advisoryId = `advisory-${digest({ executionFingerprint, idempotencyKey: request.idempotencyKey, scopeRef: request.scopeRef, tenantId: request.tenantId }).slice(7, 31)}`;
    const record = immutable<AcceptedAdvisoryRecord>({ advisoryId, tenantId: request.tenantId, scopeRef: request.scopeRef, capabilityId: request.capabilityId, schemaId: request.schemaId, inputFingerprint: snapshot.inputFingerprint, evidenceFingerprint: snapshot.evidenceFingerprint, inputClassifications: snapshot.inputClassifications, promptId: prompt.promptId, promptVersion: prompt.promptVersion, adapterVersion: this.#adapter.adapterVersion, executionFingerprint, envelope: candidate as AdvisoryResultEnvelope, validationResult: validation, generatedAt: this.#clock().toISOString(), reviewRequired: true, reviewEvidenceRef: `advisory:${advisoryId}:review-required`, authority: "ADVISORY", ...(request.capabilityVersion === undefined ? {} : { capabilityVersion: request.capabilityVersion }), ...(request.correlationId === undefined ? {} : { correlationId: request.correlationId }), ...(request.initiatingPrincipalEvidenceRef === undefined ? {} : { initiatingPrincipalEvidenceRef: request.initiatingPrincipalEvidenceRef }), ...(request.initiatingPrincipalProvenance === undefined ? {} : { initiatingPrincipalProvenance: request.initiatingPrincipalProvenance }) });
    return this.#persistence.recordAccepted(record, request.idempotencyKey);
  }

  public read(tenantId: string, scopeRef: string, advisoryId: string): AcceptedAdvisoryRecord | undefined {
    if (![tenantId, scopeRef, advisoryId].every(nonempty)) return undefined;
    return this.#persistence.findAdvisory(tenantId, scopeRef, advisoryId);
  }

  public hasExecutableBinding(binding: Readonly<{ readonly adapter: AdvisoryAdapter; readonly capabilityId: AdvisoryExecutionRequest["capabilityId"]; readonly schemaId: AdvisoryExecutionRequest["schemaId"]; readonly promptId: string; readonly promptVersion: string }>): boolean {
    if (binding.adapter !== this.#adapter || typeof this.#snapshotResolver?.resolve !== "function") return false;
    try {
      const prompt = this.#persistence.findPrompt(binding.promptId, binding.promptVersion);
      return prompt?.status === "ACTIVE" && prompt.capabilityId === binding.capabilityId && prompt.schemaId === binding.schemaId;
    } catch { return false; }
  }
}

function validateRequest(request: AdvisoryExecutionRequest): void {
  if (![request.tenantId, request.scopeRef, request.promptId, request.promptVersion, request.idempotencyKey].every(isSafeAdvisoryText)
    || [request.capabilityVersion, request.correlationId].some((value) => value !== undefined && !isSafeAdvisoryText(value))
    || (request.initiatingPrincipalEvidenceRef !== undefined && !isSafeAdvisoryEvidenceRef(request.initiatingPrincipalEvidenceRef))
    || (request.initiatingPrincipalProvenance !== undefined && !isSafeAdvisoryPrincipalProvenance(request.initiatingPrincipalProvenance))
    || !validRef(request.inputReference)) throw runtimeFailure("ADVISORY_INPUT_UNAVAILABLE", "Advisory request is invalid.");
}
function matchesSnapshot(request: AdvisoryExecutionRequest, snapshot: TrustedAdvisorySnapshot): boolean { return snapshot.tenantId === request.tenantId && snapshot.scopeRef === request.scopeRef && sameRef(snapshot.subjectRef, request.inputReference) && snapshot.provenance.some((item) => sameRef(item, snapshot.subjectRef)) && snapshot.inputClassifications.length > 0 && nonempty(snapshot.inputFingerprint) && nonempty(snapshot.evidenceFingerprint); }
function validRef(value: EntityReference): boolean { return nonempty(value.entityType) && nonempty(value.entityId) && nonempty(value.version); }
function sameRef(left: EntityReference, right: EntityReference): boolean { return left.entityType === right.entityType && left.entityId === right.entityId && left.version === right.version; }
function nonempty(value: string): boolean { return typeof value === "string" && value.trim().length > 0; }
function digest(value: unknown): string { return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`; }
function canonicalJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value !== null && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`; return JSON.stringify(value); }
function immutable<T>(value: T): T { const copy = structuredClone(value); deepFreeze(copy); return copy; }
function deepFreeze(value: unknown): void { if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); } }
function runtimeFailure(code: ConstructorParameters<typeof AdvisoryRuntimeError>[0], message: string): AdvisoryRuntimeError { return new AdvisoryRuntimeError(code, message); }
function notifyValidationOutcome(adapter: AdvisoryAdapter, intent: AdvisoryAdapterIntent, outcome: "SUCCESS" | "ADVISORY_OUTPUT_REJECTED"): void { try { adapter.recordValidationOutcome?.(intent, outcome); } catch { /* telemetry has no advisory execution authority */ } }
function mostRestrictive(snapshot: TrustedAdvisorySnapshot): TrustedAdvisorySnapshot["inputClassifications"][number] { const rank = { PUBLIC_APPROVED: 0, INTERNAL: 1, CONFIDENTIAL_BUSINESS: 2, RESTRICTED_PERSONAL: 3, RESTRICTED_SECURITY: 4 } as const; return [...snapshot.inputClassifications].sort((left, right) => rank[right] - rank[left])[0]!; }
