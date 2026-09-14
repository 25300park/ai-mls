import { createHash } from "node:crypto";

import type { AuditPrincipal } from "../../../packages/security-contracts/src/index.js";
import { DurableAuditEventStoreError, type DurableAuditEventStore, type DurableMaterializedAuditEvent } from "./durable-audit-event-store.js";
import {
  EnrichedAuditIntentValidationError,
  isMaterializationReadySourceDomain,
  validateEnrichedAuditIntentV2,
  type EnrichedAuditIntentV2,
  type MaterializationReadySourceDomain,
} from "./enriched-audit-intent-contract.js";

export type { EnrichedAuditIntentV2, MaterializationReadySourceDomain } from "./enriched-audit-intent-contract.js";

export interface AuditIntentSourcePort {
  readonly sourceDomain: MaterializationReadySourceDomain;
  readByIntentId(intentId: string): EnrichedAuditIntentV2 | undefined;
  listEligible(input: Readonly<{ continuation?: string; limit?: number }>): Readonly<{ intents: readonly EnrichedAuditIntentV2[]; continuation?: string }>;
}

export function createAuditIntentSourcePort(input: Readonly<{ sourceDomain: MaterializationReadySourceDomain; read(): readonly unknown[] }>): AuditIntentSourcePort {
  if (!isMaterializationReadySourceDomain(input.sourceDomain) || typeof input.read !== "function") throw new Error("INTENT_SOURCE_INPUT_INVALID");
  const eligible = (): readonly EnrichedAuditIntentV2[] => Object.freeze(input.read()
    .filter((value) => plain(value) && value["auditIntentContractVersion"] === "v2" && value["sourceDomain"] === input.sourceDomain)
    .map((value) => {
      try { return validateEnrichedAuditIntentV2(value, input.sourceDomain); }
      catch { throw new Error("INTENT_SOURCE_INPUT_INVALID"); }
    }));
  return Object.freeze({
    sourceDomain: input.sourceDomain,
    readByIntentId: (intentId: string) => safeIdentifier(intentId) ? eligible().find((value) => value.intentId === intentId) : undefined,
    listEligible: (request: Readonly<{ continuation?: string; limit?: number }>) => {
      if ((request.continuation !== undefined && !safeIdentifier(request.continuation)) || (request.limit !== undefined && (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > 100))) throw new Error("INTENT_SOURCE_INPUT_INVALID");
      const ordered = eligible().slice().sort((left, right) => left.intentId.localeCompare(right.intentId));
      const after = request.continuation === undefined ? ordered : ordered.filter((value) => value.intentId > request.continuation!);
      const limit = request.limit ?? 100;
      const intents = after.slice(0, limit);
      const continuation = after.length > limit ? intents.at(-1)?.intentId : undefined;
      return Object.freeze({ intents: Object.freeze(intents), ...(continuation === undefined ? {} : { continuation }) });
    },
  });
}

export type AuditIntentMaterializationErrorCode = "INTENT_INVALID" | "INTENT_NOT_MATERIALIZATION_READY" | "MATERIALIZATION_FAILED" | "MATERIALIZATION_IDENTITY_CONFLICT" | "SOURCE_NOT_MATERIALIZATION_READY";

export class AuditIntentMaterializationError extends Error {
  public constructor(public readonly code: AuditIntentMaterializationErrorCode) { super(code); this.name = "AuditIntentMaterializationError"; }
}

interface Dependencies {
  readonly store: DurableAuditEventStore;
  readonly clock: () => Date;
  readonly principalEvidenceResolver?: Readonly<{ resolve(evidenceRef: string): AuditPrincipal | undefined }>;
}

export class AuditIntentMaterializer {
  public constructor(private readonly dependencies: Dependencies) {}

  public materialize(value: unknown): Readonly<{ status: "MATERIALIZED" | "REPLAYED"; event: DurableMaterializedAuditEvent }> {
    if (plain(value) && value["auditIntentContractVersion"] !== "v2") throw failure("INTENT_NOT_MATERIALIZATION_READY");
    if (plain(value) && value["sourceDomain"] === "CLIENT_REQUIREMENT") throw failure("SOURCE_NOT_MATERIALIZATION_READY");
    const intent = validatedIntentForMaterialization(value);
    const principal = resolvePrincipal(intent, this.dependencies.principalEvidenceResolver);
    const evidenceRefs = [...intent.evidenceRefs].sort();
    const event = snapshot({
      id: `audit:${intent.sourceDomain}:${intent.intentId}`,
      eventType: intent.eventType,
      principal,
      action: intent.action,
      target: intent.target,
      purpose: intent.purpose,
      policyVersion: intent.policyVersion,
      classification: intent.classification,
      decision: intent.decision,
      outcome: intent.outcome,
      ...(intent.reason === undefined ? {} : { reason: intent.reason }),
      ...(intent.requestId === undefined ? {} : { requestId: intent.requestId }),
      correlationId: intent.correlationId,
      details: { evidenceRefs },
      occurredAt: intent.committedAt,
      sourceDomain: intent.sourceDomain,
      auditIntentId: intent.intentId,
      aggregateId: intent.aggregateId,
      mutationIdentity: intent.mutationIdentity,
      visibility: intent.visibility,
      materializedAt: this.dependencies.clock().toISOString(),
      evidenceRefs,
    }) as DurableMaterializedAuditEvent;
    const fingerprint = fingerprintOf({ ...event, materializedAt: undefined });
    try { return this.dependencies.store.append({ fingerprint, event }); }
    catch (error) {
      if (error instanceof DurableAuditEventStoreError && error.code === "MATERIALIZATION_IDENTITY_CONFLICT") throw failure("MATERIALIZATION_IDENTITY_CONFLICT");
      throw failure("MATERIALIZATION_FAILED");
    }
  }

  public consume(source: AuditIntentSourcePort): readonly DurableMaterializedAuditEvent[] {
    if (!isMaterializationReadySourceDomain(source.sourceDomain)) throw failure("SOURCE_NOT_MATERIALIZATION_READY");
    const batch = source.listEligible({ limit: 100 });
    return Object.freeze(batch.intents.map((intent) => this.materialize(intent).event));
  }
}

function validatedIntentForMaterialization(value: unknown): EnrichedAuditIntentV2 {
  try {
    return validateEnrichedAuditIntentV2(value);
  } catch (error) {
    if (error instanceof EnrichedAuditIntentValidationError && error.code === "SOURCE_NOT_MATERIALIZATION_READY") throw failure("SOURCE_NOT_MATERIALIZATION_READY");
    throw failure("INTENT_INVALID");
  }
}

function resolvePrincipal(intent: EnrichedAuditIntentV2, resolver: Dependencies["principalEvidenceResolver"]): AuditPrincipal {
  if (intent.principalProvenance.kind === "TRUSTED_SNAPSHOT") return intent.principalProvenance.principal;
  const principal = resolver?.resolve(intent.principalProvenance.evidenceRef);
  if (principal?.id !== intent.principalProvenance.principalId) throw failure("INTENT_INVALID");
  const validated = validatedIntentForMaterialization({ ...intent, principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal } });
  return validated.principalProvenance.kind === "TRUSTED_SNAPSHOT" ? validated.principalProvenance.principal : principal;
}
function safeIdentifier(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 256 && value.trim() === value && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value); }
function plain(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function fingerprintOf(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }
function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (plain(value)) return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`; return JSON.stringify(value); }
function snapshot<T>(value: T): T { const copy = structuredClone(value); deepFreeze(copy); return copy; }
function deepFreeze(value: unknown): void { if (value === null || typeof value !== "object" || Object.isFrozen(value)) return; for (const nested of Object.values(value)) deepFreeze(nested); Object.freeze(value); }
function failure(code: AuditIntentMaterializationErrorCode): AuditIntentMaterializationError { return new AuditIntentMaterializationError(code); }
