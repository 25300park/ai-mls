import { FirstPartyAuthenticationError } from "./first-party-credential-argon2.js";

export const FIRST_PARTY_ADAPTER_ID = "ai-mls.identity.first-party-credential.v1";
export const FIRST_PARTY_ADAPTER_KIND = "FIRST_PARTY_CREDENTIAL";

export interface FirstPartyCredentialEvidenceV1 {
  readonly schemaVersion: 1;
  readonly loginIdentifier: string;
  readonly password: string;
}
export interface FirstPartyCredentialConfigRefV1 {
  readonly schemaVersion: 1;
  readonly adapterId: typeof FIRST_PARTY_ADAPTER_ID;
  readonly algorithmProfile: "ARGON2ID_V1";
}
export interface IdentityHumanPrincipalRecord {
  readonly principalId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly loginIdentifier: string;
  readonly status: "ACTIVE" | "DISABLED";
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface IdentityHumanCredentialRecord {
  readonly credentialId: string;
  readonly principalId: string;
  readonly credentialVersion: number;
  readonly credentialType: "PASSWORD";
  readonly algorithm: "ARGON2ID";
  readonly algorithmProfile: "ARGON2ID_V1";
  readonly salt: Uint8Array;
  readonly derivedKey: Uint8Array;
  readonly status: "ACTIVE" | "REVOKED";
  readonly createdAt: string;
  readonly rotatedAt: string | null;
  readonly revokedAt: string | null;
}

// Do not transform the caller's identifier, including Unicode normalization.
export function validLoginIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512
    && !/^\s|\s$/u.test(value) && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}
export function assertFirstPartyCredentialEvidence(value: unknown): asserts value is FirstPartyCredentialEvidenceV1 {
  if (!exactKeys(value, ["schemaVersion", "loginIdentifier", "password"])
    || value['schemaVersion'] !== 1 || !validLoginIdentifier(value['loginIdentifier'])
    || typeof value['password'] !== "string" || value['password'].length === 0) {
    throw new FirstPartyAuthenticationError("INVALID_CREDENTIAL");
  }
}
export function assertFirstPartyCredentialConfigRef(value: unknown): asserts value is FirstPartyCredentialConfigRefV1 {
  if (!exactKeys(value, ["schemaVersion", "adapterId", "algorithmProfile"])
    || value['schemaVersion'] !== 1 || value['adapterId'] !== FIRST_PARTY_ADAPTER_ID
    || value['algorithmProfile'] !== "ARGON2ID_V1") throw new FirstPartyAuthenticationError();
}
function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}
