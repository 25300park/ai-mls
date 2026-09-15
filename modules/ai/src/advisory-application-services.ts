import { createHash } from "node:crypto";

import { canonicalAiSchemaId, type EntityReference } from "./advisory-ai-service.js";
import { AdvisoryRuntime } from "./advisory-runtime.js";
import { AdvisoryRuntimeError, isSafeAdvisoryEvidenceRef, isSafeAdvisoryPrincipalProvenance, isSafeAdvisoryText, type AdvisoryInitiatingPrincipalProvenance } from "./advisory-runtime-contracts.js";
import type { ConfiguredAdvisoryProviderAdapter, ExecutableAdvisoryCapabilityId } from "./advisory-provider-boundary.js";

export interface AdvisoryCapabilityExecutionBinding {
  readonly capabilityVersion: string;
  readonly promptId: string;
  readonly promptVersion: string;
}

export interface AdvisoryApplicationExecutionInput {
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly inputReference: EntityReference;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly initiatingPrincipalEvidenceRef: string;
  readonly initiatingPrincipalProvenance: AdvisoryInitiatingPrincipalProvenance;
}

export interface AdvisoryApplicationResult {
  readonly capabilityId: ExecutableAdvisoryCapabilityId;
  readonly resultReference: string;
  readonly resultChecksum: string;
  readonly evidenceRefs: readonly string[];
  readonly reviewRequired: true;
  readonly authority: "ADVISORY";
}

export interface Ai001ListingParseApplicationPort { execute(input: AdvisoryApplicationExecutionInput): AdvisoryApplicationResult; }
export interface Ai004RequirementParseApplicationPort { execute(input: AdvisoryApplicationExecutionInput): AdvisoryApplicationResult; }
export interface Ai005MatchingApplicationPort { execute(input: AdvisoryApplicationExecutionInput): AdvisoryApplicationResult; }

export class Ai001ListingParseApplicationService implements Ai001ListingParseApplicationPort {
  readonly #service: CapabilityApplicationService;
  public constructor(dependencies: ServiceDependencies) { this.#service = new CapabilityApplicationService("AI-001", dependencies); }
  public execute(input: AdvisoryApplicationExecutionInput): AdvisoryApplicationResult { return this.#service.execute(input); }
  public isProviderIndependentReady(adapter: ConfiguredAdvisoryProviderAdapter): boolean { return this.#service.isProviderIndependentReady(adapter); }
}

export class Ai004RequirementParseApplicationService implements Ai004RequirementParseApplicationPort {
  readonly #service: CapabilityApplicationService;
  public constructor(dependencies: ServiceDependencies) { this.#service = new CapabilityApplicationService("AI-004", dependencies); }
  public execute(input: AdvisoryApplicationExecutionInput): AdvisoryApplicationResult { return this.#service.execute(input); }
  public isProviderIndependentReady(adapter: ConfiguredAdvisoryProviderAdapter): boolean { return this.#service.isProviderIndependentReady(adapter); }
}

export class Ai005MatchingApplicationService implements Ai005MatchingApplicationPort {
  readonly #service: CapabilityApplicationService;
  public constructor(dependencies: ServiceDependencies) { this.#service = new CapabilityApplicationService("AI-005", dependencies); }
  public execute(input: AdvisoryApplicationExecutionInput): AdvisoryApplicationResult { return this.#service.execute(input); }
  public isProviderIndependentReady(adapter: ConfiguredAdvisoryProviderAdapter): boolean { return this.#service.isProviderIndependentReady(adapter); }
}

interface ServiceDependencies {
  readonly runtime: AdvisoryRuntime;
  readonly binding: AdvisoryCapabilityExecutionBinding;
}

class CapabilityApplicationService {
  readonly #capabilityId: ExecutableAdvisoryCapabilityId;
  readonly #runtime: AdvisoryRuntime;
  readonly #binding: AdvisoryCapabilityExecutionBinding;

  public constructor(capabilityId: ExecutableAdvisoryCapabilityId, dependencies: ServiceDependencies) {
    if (!(dependencies.runtime instanceof AdvisoryRuntime) || !validBinding(dependencies.binding)) throw invalidInput();
    this.#capabilityId = capabilityId;
    this.#runtime = dependencies.runtime;
    this.#binding = immutable(dependencies.binding);
  }

  public execute(input: AdvisoryApplicationExecutionInput): AdvisoryApplicationResult {
    if (!validInput(input)) throw invalidInput();
    const accepted = this.#runtime.execute({
      tenantId: input.tenantId,
      scopeRef: input.scopeRef,
      capabilityId: this.#capabilityId,
      capabilityVersion: this.#binding.capabilityVersion,
      schemaId: canonicalAiSchemaId(this.#capabilityId),
      inputReference: input.inputReference,
      promptId: this.#binding.promptId,
      promptVersion: this.#binding.promptVersion,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      initiatingPrincipalEvidenceRef: input.initiatingPrincipalEvidenceRef,
      initiatingPrincipalProvenance: input.initiatingPrincipalProvenance,
    });
    return immutable({
      capabilityId: this.#capabilityId,
      resultReference: `advisory:${accepted.advisoryId}`,
      resultChecksum: digest(accepted.envelope),
      evidenceRefs: [accepted.reviewEvidenceRef!, input.initiatingPrincipalEvidenceRef],
      reviewRequired: true as const,
      authority: "ADVISORY" as const,
    });
  }

  public isProviderIndependentReady(adapter: ConfiguredAdvisoryProviderAdapter): boolean {
    return adapter.matchesExecutionBinding({ capabilityId: this.#capabilityId, capabilityVersion: this.#binding.capabilityVersion, promptId: this.#binding.promptId, promptVersion: this.#binding.promptVersion })
      && this.#runtime.hasExecutableBinding({ adapter, capabilityId: this.#capabilityId, schemaId: canonicalAiSchemaId(this.#capabilityId), promptId: this.#binding.promptId, promptVersion: this.#binding.promptVersion });
  }
}

function validBinding(value: AdvisoryCapabilityExecutionBinding): boolean { return [value.capabilityVersion, value.promptId, value.promptVersion].every(isSafeAdvisoryText); }
function validInput(value: AdvisoryApplicationExecutionInput): boolean { return [value.tenantId, value.scopeRef, value.correlationId, value.idempotencyKey].every(isSafeAdvisoryText) && isSafeAdvisoryEvidenceRef(value.initiatingPrincipalEvidenceRef) && isSafeAdvisoryPrincipalProvenance(value.initiatingPrincipalProvenance) && validReference(value.inputReference); }
function validReference(value: EntityReference): boolean { return value !== null && [value.entityType, value.entityId, value.version].every(nonempty); }
function nonempty(value: string): boolean { return typeof value === "string" && value.trim().length > 0; }
function invalidInput(): AdvisoryRuntimeError { return new AdvisoryRuntimeError("ADVISORY_INPUT_UNAVAILABLE", "Advisory application input is unavailable."); }
function digest(value: unknown): string { return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`; }
function canonicalJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value !== null && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`; return JSON.stringify(value); }
function immutable<T>(value: T): T { const copy = structuredClone(value); deepFreeze(copy); return copy; }
function deepFreeze(value: unknown): void { if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); } }
