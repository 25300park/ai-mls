import { FirstPartyCredentialAuthenticationAdapter } from "../../../modules/identity/src/first-party-credential-adapter.js";
import { Argon2idV1Verifier, FirstPartyAuthenticationError } from "../../../modules/identity/src/first-party-credential-argon2.js";
import { FIRST_PARTY_ADAPTER_ID, FIRST_PARTY_ADAPTER_KIND, assertFirstPartyCredentialConfigRef } from "../../../modules/identity/src/first-party-credential-contracts.js";
import { PostgreSqlHumanCredentialReader } from "../../../modules/identity/src/first-party-credential-postgresql.js";
import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
import { resolveProductionAuthenticationBinding, type ProductionAuthenticationBinding, type AuthenticationAdapterRegistration } from "./production-human-identity-contracts.js";
import { assertFirstPartyCredentialPersistenceReady } from "./first-party-authentication-readiness.js";

// Caller supplies the canonical PG_PRODUCTION_POOL and trusted Identity tenant context.
// This does not activate production-main or the Human Identity startup gate.
export function createFirstPartyAuthenticationRegistration(pool: PostgreSqlPoolPort, expectedTenantId: string, crypto = new Argon2idV1Verifier()): AuthenticationAdapterRegistration {
  return Object.freeze({ adapterId: FIRST_PARTY_ADAPTER_ID, adapterKind: FIRST_PARTY_ADAPTER_KIND, environment: "PRODUCTION" as const,
    adapter: new FirstPartyCredentialAuthenticationAdapter(expectedTenantId, new PostgreSqlHumanCredentialReader(pool), crypto),
    validateConfigurationReference: assertFirstPartyCredentialConfigRef,
  });
}
export async function assertFirstPartyAuthenticationReady(pool: PostgreSqlPoolPort, bindings: readonly ProductionAuthenticationBinding[], registrations: readonly AuthenticationAdapterRegistration[], crypto = new Argon2idV1Verifier()): Promise<void> {
  try {
    const registration = resolveProductionAuthenticationBinding(bindings, registrations);
    if (registration.adapterId !== FIRST_PARTY_ADAPTER_ID || registration.adapterKind !== FIRST_PARTY_ADAPTER_KIND
      || !(registration.adapter instanceof FirstPartyCredentialAuthenticationAdapter)) throw new FirstPartyAuthenticationError();
    crypto.assertAvailable();
    registration.adapter.assertPrimitiveAvailable();
    await assertFirstPartyCredentialPersistenceReady(pool);
  } catch { throw new FirstPartyAuthenticationError(); }
}
