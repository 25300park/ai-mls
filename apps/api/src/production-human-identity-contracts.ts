import type { AuthenticationAdapter } from "../../../modules/identity/src/session-service.js";

export interface ProductionAuthenticationBinding {
  readonly adapterId: string;
  readonly adapterKind: string;
  readonly configurationRef: unknown;
}

// Approved composition supplies registrations; B1 creates no Production entry.
export interface AuthenticationAdapterRegistration {
  readonly adapterId: string;
  readonly adapterKind: string;
  readonly environment: "PRODUCTION" | "STAGING";
  readonly adapter: AuthenticationAdapter;
  validateConfigurationReference(reference: unknown): void;
}

export function validateConfigurationReference(value: unknown): string {
  if (typeof value !== "string" || value.length > 512
    || !/^[A-Za-z][A-Za-z0-9_.-]*(?::[A-Za-z0-9_.\/-]+)+$/u.test(value)) {
    throw new Error("CONFIGURATION_REFERENCE_INVALID");
  }
  return value;
}

export function resolveProductionAuthenticationBinding(
  bindings: readonly ProductionAuthenticationBinding[],
  registrations: readonly AuthenticationAdapterRegistration[],
): AuthenticationAdapterRegistration {
  if (bindings.length === 0) throw new Error("BLOCKED_UNCONFIGURED");
  if (bindings.length !== 1) throw new Error("BINDING_INVALID");
  const binding = bindings[0]!;
  const matches = registrations.filter(entry => entry.adapterId === binding.adapterId);
  if (!identifier(binding.adapterId) || !identifier(binding.adapterKind) || matches.length !== 1) throw new Error("BINDING_INVALID");
  const registration = matches[0]!;
  if (registration.environment !== "PRODUCTION" || registration.adapterKind !== binding.adapterKind
    || typeof registration.adapter?.verify !== "function"
    || typeof registration.validateConfigurationReference !== "function") throw new Error("BINDING_INVALID");
  const reference = typeof binding.configurationRef === "string" ? validateConfigurationReference(binding.configurationRef) : binding.configurationRef;
  registration.validateConfigurationReference(reference);
  return registration;
}

export interface ProductionHumanFreshnessPolicy {
  readonly IDLE_TIMEOUT_MILLISECONDS: number;
  readonly ABSOLUTE_LIFETIME_MILLISECONDS: number;
  readonly MFA_FRESHNESS_MILLISECONDS: number;
}

export function parseProductionHumanFreshnessPolicy(
  environment: Readonly<Record<string, string | undefined>>,
): ProductionHumanFreshnessPolicy {
  const read = (key: string): number => {
    const raw = environment[`AI_MLS_HUMAN_${key}`];
    if (raw === undefined || !/^[1-9][0-9]*$/u.test(raw)) throw new Error("FRESHNESS_POLICY_INVALID");
    const value = Number(raw);
    if (!Number.isSafeInteger(value)) throw new Error("FRESHNESS_POLICY_INVALID");
    return value;
  };
  return Object.freeze({
    IDLE_TIMEOUT_MILLISECONDS: read("IDLE_TIMEOUT_MILLISECONDS"),
    ABSOLUTE_LIFETIME_MILLISECONDS: read("ABSOLUTE_LIFETIME_MILLISECONDS"),
    MFA_FRESHNESS_MILLISECONDS: read("MFA_FRESHNESS_MILLISECONDS"),
  });
}

function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/u.test(value);
}
