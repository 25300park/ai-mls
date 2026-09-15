import type { AiCapabilityId } from "./advisory-ai-service.js";
import type { AdvisoryAdapter, AdvisoryAdapterIntent } from "./advisory-runtime-contracts.js";
import { isUnsafeSecurityDetailValue } from "../../../packages/security-contracts/src/index.js";

export type ExecutableAdvisoryCapabilityId = Extract<AiCapabilityId, "AI-001" | "AI-004" | "AI-005">;

export interface AdvisoryCapabilityConfiguration {
  readonly environment: "Staging";
  readonly capabilityId: ExecutableAdvisoryCapabilityId;
  readonly capabilityVersion: string;
  readonly providerRef: string;
  readonly modelRef: string;
  readonly timeoutMs: number;
  readonly credentialRef: string;
  readonly promptId: string;
  readonly promptVersion: string;
}

export interface AdvisoryCredentialResolver {
  isAvailable(credentialRef: string): boolean;
  resolve(credentialRef: string): string | undefined;
}

export interface AdvisoryProviderExecutionRequest {
  readonly providerRef: string;
  readonly modelRef: string;
  readonly timeoutMs: number;
  readonly credential: string;
  readonly intent: AdvisoryAdapterIntent;
}

export interface AdvisoryProviderExecutor {
  readonly testOnly: boolean;
  execute(request: AdvisoryProviderExecutionRequest): unknown;
}

export interface AdvisoryProviderTelemetry {
  readonly capabilityId: ExecutableAdvisoryCapabilityId;
  readonly capabilityVersion: string;
  readonly providerRef: string;
  readonly modelRef: string;
  readonly correlationId: string;
  readonly latencyMs: number;
  readonly normalizedOutcome: "SUCCESS" | "ADVISORY_OUTPUT_REJECTED" | "ADVISORY_UNAVAILABLE";
}

export interface AdvisoryTelemetrySink {
  append(event: AdvisoryProviderTelemetry): void;
}

export type AdvisoryProviderBoundaryErrorCode = "PROVIDER_CONFIGURATION_INVALID" | "ADVISORY_UNAVAILABLE";

export class AdvisoryProviderBoundaryError extends Error {
  public constructor(public readonly code: AdvisoryProviderBoundaryErrorCode, message: string) {
    super(message);
    this.name = "AdvisoryProviderBoundaryError";
  }
}

export class ConfiguredAdvisoryProviderAdapter implements AdvisoryAdapter {
  public readonly adapterVersion: string;
  public readonly capabilityId: ExecutableAdvisoryCapabilityId;
  readonly #configuration: AdvisoryCapabilityConfiguration;
  readonly #credentialResolver: AdvisoryCredentialResolver;
  readonly #executor: AdvisoryProviderExecutor;
  readonly #telemetrySink: AdvisoryTelemetrySink;
  readonly #clock: () => Date;
  readonly #networkAuthorized: boolean;
  readonly #pendingStartedAt = new Map<string, number>();

  public constructor(dependencies: Readonly<{
    readonly configuration: AdvisoryCapabilityConfiguration;
    readonly networkAuthorized: boolean;
    readonly credentialResolver: AdvisoryCredentialResolver;
    readonly executor: AdvisoryProviderExecutor;
    readonly telemetrySink: AdvisoryTelemetrySink;
    readonly clock: () => Date;
  }>) {
    if (!validConfiguration(dependencies.configuration)
      || !validMethod(dependencies.credentialResolver, "resolve")
      || !validMethod(dependencies.credentialResolver, "isAvailable")
      || !validMethod(dependencies.executor, "execute")
      || typeof dependencies.executor.testOnly !== "boolean"
      || !validMethod(dependencies.telemetrySink, "append")
      || typeof dependencies.clock !== "function"
      || typeof dependencies.networkAuthorized !== "boolean") {
      throw failure("PROVIDER_CONFIGURATION_INVALID", "Advisory provider configuration is invalid.");
    }
    this.#configuration = immutable(dependencies.configuration);
    this.#credentialResolver = dependencies.credentialResolver;
    this.#executor = dependencies.executor;
    this.#telemetrySink = dependencies.telemetrySink;
    this.#clock = dependencies.clock;
    this.#networkAuthorized = dependencies.networkAuthorized;
    this.capabilityId = dependencies.configuration.capabilityId;
    this.adapterVersion = `configured-advisory:${dependencies.configuration.capabilityId}:${dependencies.configuration.capabilityVersion}:${dependencies.configuration.providerRef}:${dependencies.configuration.modelRef}`;
  }

  public generate(intent: AdvisoryAdapterIntent): unknown {
    if (!matchesConfiguration(intent, this.#configuration)) {
      throw failure("PROVIDER_CONFIGURATION_INVALID", "Advisory provider configuration does not match execution intent.");
    }
    const startedAt = this.#clock().getTime();
    if (!this.#executor.testOnly && !this.#networkAuthorized) {
      this.emit(intent, startedAt, "ADVISORY_UNAVAILABLE");
      throw failure("ADVISORY_UNAVAILABLE", "Advisory provider is unavailable.");
    }
    let credential: string | undefined;
    try { credential = this.#credentialResolver.resolve(this.#configuration.credentialRef); }
    catch { this.emit(intent, startedAt, "ADVISORY_UNAVAILABLE"); throw failure("ADVISORY_UNAVAILABLE", "Advisory provider is unavailable."); }
    if (credential === undefined || !nonempty(credential)) {
      this.emit(intent, startedAt, "ADVISORY_UNAVAILABLE");
      throw failure("ADVISORY_UNAVAILABLE", "Advisory provider is unavailable.");
    }
    try {
      const result = this.#executor.execute(immutable({
        providerRef: this.#configuration.providerRef,
        modelRef: this.#configuration.modelRef,
        timeoutMs: this.#configuration.timeoutMs,
        credential,
        intent,
      }));
      this.#pendingStartedAt.set(intent.executionFingerprint, startedAt);
      return result;
    } catch {
      this.emit(intent, startedAt, "ADVISORY_UNAVAILABLE");
      throw failure("ADVISORY_UNAVAILABLE", "Advisory provider is unavailable.");
    }
  }

  public recordValidationOutcome(intent: AdvisoryAdapterIntent, outcome: "SUCCESS" | "ADVISORY_OUTPUT_REJECTED"): void {
    const startedAt = this.#pendingStartedAt.get(intent.executionFingerprint);
    if (startedAt === undefined || !matchesConfiguration(intent, this.#configuration)) return;
    this.#pendingStartedAt.delete(intent.executionFingerprint);
    this.emit(intent, startedAt, outcome);
  }

  public readiness(): ReturnType<typeof evaluateAdvisoryProviderReadiness> {
    let credentialAvailable = false;
    try { credentialAvailable = this.#credentialResolver.isAvailable(this.#configuration.credentialRef); } catch { credentialAvailable = false; }
    return evaluateAdvisoryProviderReadiness(this.#configuration, { credentialAvailable, networkAuthorized: this.#networkAuthorized, testOnly: this.#executor.testOnly });
  }

  public matchesExecutionBinding(binding: Readonly<{ readonly capabilityId: ExecutableAdvisoryCapabilityId; readonly capabilityVersion: string; readonly promptId: string; readonly promptVersion: string }>): boolean {
    return binding.capabilityId === this.#configuration.capabilityId
      && binding.capabilityVersion === this.#configuration.capabilityVersion
      && binding.promptId === this.#configuration.promptId
      && binding.promptVersion === this.#configuration.promptVersion;
  }

  private emit(intent: AdvisoryAdapterIntent, startedAt: number, normalizedOutcome: AdvisoryProviderTelemetry["normalizedOutcome"]): void {
    const event = immutable<AdvisoryProviderTelemetry>({
      capabilityId: this.#configuration.capabilityId,
      capabilityVersion: this.#configuration.capabilityVersion,
      providerRef: this.#configuration.providerRef,
      modelRef: this.#configuration.modelRef,
      correlationId: intent.correlationId!,
      latencyMs: Math.max(0, this.#clock().getTime() - startedAt),
      normalizedOutcome,
    });
    try { this.#telemetrySink.append(event); } catch { /* telemetry has no execution authority */ }
  }
}

export function evaluateAdvisoryProviderReadiness(
  configuration: AdvisoryCapabilityConfiguration | undefined,
  context: Readonly<{ readonly credentialAvailable: boolean; readonly networkAuthorized: boolean; readonly testOnly: boolean }>,
): Readonly<{ readonly providerIndependent: "READY" | "NOT_READY"; readonly stagingExecution: "READY" | "NOT_READY" }> {
  const structural = validConfiguration(configuration);
  return immutable({
    providerIndependent: structural ? "READY" as const : "NOT_READY" as const,
    stagingExecution: structural && context.credentialAvailable && context.networkAuthorized && !context.testOnly ? "READY" as const : "NOT_READY" as const,
  });
}

function validConfiguration(value: AdvisoryCapabilityConfiguration | undefined): value is AdvisoryCapabilityConfiguration {
  return value?.environment === "Staging"
    && (["AI-001", "AI-004", "AI-005"] as const).includes(value.capabilityId)
    && [value.capabilityVersion, value.providerRef, value.modelRef, value.credentialRef, value.promptId, value.promptVersion].every(safeText)
    && Number.isSafeInteger(value.timeoutMs)
    && value.timeoutMs > 0;
}

function matchesConfiguration(intent: AdvisoryAdapterIntent, configuration: AdvisoryCapabilityConfiguration): boolean {
  return intent.capabilityId === configuration.capabilityId
    && intent.capabilityVersion === configuration.capabilityVersion
    && intent.promptId === configuration.promptId
    && intent.promptVersion === configuration.promptVersion
    && safeText(intent.correlationId ?? "");
}

function nonempty(value: string): boolean { return typeof value === "string" && value.trim().length > 0; }
function safeText(value: string): boolean { return nonempty(value) && value.length <= 512 && !/[\u0000-\u001f\u007f]/u.test(value) && !isUnsafeSecurityDetailValue(value); }
function validMethod(value: unknown, method: string): boolean { return value !== null && (typeof value === "object" || typeof value === "function") && typeof (value as Record<string, unknown>)[method] === "function"; }
function failure(code: AdvisoryProviderBoundaryErrorCode, message: string): AdvisoryProviderBoundaryError { return new AdvisoryProviderBoundaryError(code, message); }
function immutable<T>(value: T): T { const copy = structuredClone(value); deepFreeze(copy); return copy; }
function deepFreeze(value: unknown): void { if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); } }
