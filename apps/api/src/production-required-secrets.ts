import { ProductionBootstrapError } from "./production-bootstrap.js";

export type RequiredSecretActivation = "PRE_LISTENER_REQUIRED" | "PRE_WORKER_REQUIRED" | "LAZY_FEATURE_REQUIRED";

export interface RequiredSecretEntryV1 {
  readonly secretReference: string;
  readonly consumerId: string;
  readonly requiredAt: RequiredSecretActivation;
}

export interface RequiredSecretsManifestV1 {
  readonly schemaVersion: 1;
  readonly entries: readonly RequiredSecretEntryV1[];
}

/** Closed declaration of the R3-C4A-approved root, not runtime discovery. */
export interface ProductionRequiredSecretComposition {
  readonly scope: "REL002_R3C4A_CURRENT_PRODUCTION";
  readonly databaseSecretOwnership: "EARLIER_BOOTSTRAP";
  readonly rel001ProviderStatus: "DEFERRED";
  readonly requiredConsumers: readonly RequiredSecretEntryV1[];
}

export const CURRENT_PRODUCTION_REQUIRED_SECRET_COMPOSITION: ProductionRequiredSecretComposition = Object.freeze({
  scope: "REL002_R3C4A_CURRENT_PRODUCTION",
  databaseSecretOwnership: "EARLIER_BOOTSTRAP",
  rel001ProviderStatus: "DEFERRED",
  requiredConsumers: Object.freeze([]),
});

/** Explicit root input. Factory callers do not receive this as a default. */
export const CURRENT_PRODUCTION_REQUIRED_SECRETS_MANIFEST: RequiredSecretsManifestV1 = Object.freeze({
  schemaVersion: 1,
  entries: Object.freeze([]),
});

const EMPTY_READINESS = Object.freeze({
  status: "READY_EMPTY_MANIFEST" as const,
  resolvedSecretValueCount: 0 as const,
  secretResolverCallCount: 0 as const,
  externalSecretProviderCallCount: 0 as const,
  secretResolutionSideEffects: "NONE" as const,
});

/** No environment, provider, logger, audit sink or value resolver is accepted. */
export function validateRequiredSecretsManifest(
  manifest: unknown,
  composition: unknown,
): typeof EMPTY_READINESS {
  try {
    if (!exactObject(manifest, ["schemaVersion", "entries"]) || manifest["schemaVersion"] !== 1
      || !Array.isArray(manifest["entries"]) || !manifest["entries"].every(validEntry)) throw unavailable();
    if (!exactObject(composition, ["scope", "databaseSecretOwnership", "rel001ProviderStatus", "requiredConsumers"])
      || composition["scope"] !== "REL002_R3C4A_CURRENT_PRODUCTION"
      || composition["databaseSecretOwnership"] !== "EARLIER_BOOTSTRAP"
      || composition["rel001ProviderStatus"] !== "DEFERRED"
      || !Array.isArray(composition["requiredConsumers"])) throw unavailable();
    // Non-empty manifests/consumers require a future approved composition and resolver.
    if (manifest["entries"].length !== 0 || composition["requiredConsumers"].length !== 0) throw unavailable();
    return EMPTY_READINESS;
  } catch {
    throw unavailable();
  }
}

/** Validate and capture immutable canonical input without a missing-input default. */
export function captureRequiredSecretsManifest(manifest: unknown): RequiredSecretsManifestV1 | undefined {
  try {
    validateRequiredSecretsManifest(manifest, CURRENT_PRODUCTION_REQUIRED_SECRET_COMPOSITION);
    return Object.freeze({ schemaVersion: 1, entries: Object.freeze([]) });
  } catch {
    return undefined;
  }
}

function validEntry(entry: unknown): entry is RequiredSecretEntryV1 {
  return exactObject(entry, ["secretReference", "consumerId", "requiredAt"])
    && safeReference(entry["secretReference"]) && safeReference(entry["consumerId"])
    && ["PRE_LISTENER_REQUIRED", "PRE_WORKER_REQUIRED", "LAZY_FEATURE_REQUIRED"].includes(entry["requiredAt"] as string);
}

function exactObject(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === fields.length && fields.every((field) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    return descriptor !== undefined && "value" in descriptor && descriptor.enumerable;
  });
}

function safeReference(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value
    && !/[\u0000-\u001f\u007f\\]/u.test(value);
}

function unavailable(): ProductionBootstrapError {
  return new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE");
}
