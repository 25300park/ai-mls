import { timingSafeEqual } from "node:crypto";
import { Argon2idV1Verifier, FirstPartyAuthenticationError } from "./first-party-credential-argon2.js";
import { assertFirstPartyCredentialEvidence } from "./first-party-credential-contracts.js";
import type { HumanCredentialCapture } from "./first-party-credential-postgresql.js";
import type { PostgreSqlClientPort } from "./postgresql-pool.js";
import type { AuthenticationAdapter, AuthenticationEvidence, AuthenticationResult, AuthenticatedIdentity } from "./session-service.js";

export interface HumanCredentialReadPort {
  capture(expectedTenantId: string, loginIdentifier: string, client?: PostgreSqlClientPort): Promise<HumanCredentialCapture | null>;
}
export class FirstPartyCredentialAuthenticationAdapter implements AuthenticationAdapter {
  readonly #captures = new WeakMap<AuthenticatedIdentity, HumanCredentialCapture>();
  public constructor(private readonly expectedTenantId: string, private readonly reader: HumanCredentialReadPort, private readonly crypto = new Argon2idV1Verifier()) {
    if (typeof expectedTenantId !== "string" || expectedTenantId.length === 0 || expectedTenantId.length > 512 || expectedTenantId.trim() !== expectedTenantId || /[\u0000-\u001f\u007f\\]/u.test(expectedTenantId)) throw new FirstPartyAuthenticationError();
  }
  public async verify(evidence: AuthenticationEvidence): Promise<AuthenticationResult> {
    try { assertFirstPartyCredentialEvidence(evidence); } catch { return null; }
    this.crypto.assertAvailable();
    const read = await this.reader.capture(this.expectedTenantId, evidence.loginIdentifier);
    const captured = read === null ? null : cloneCapture(read);
    if (captured?.principal.status !== "ACTIVE" || captured.credential.status !== "ACTIVE"
      || captured.principal.tenantId !== this.expectedTenantId || captured.principal.loginIdentifier !== evidence.loginIdentifier
      || captured.credential.principalId !== captured.principal.principalId
      || captured.credential.algorithm !== "ARGON2ID" || captured.credential.algorithmProfile !== "ARGON2ID_V1") return null;
    if (!await this.crypto.verify(evidence.password, captured.credential.salt, captured.credential.derivedKey)) return null;
    const identity: AuthenticatedIdentity = Object.freeze({ principalId: captured.principal.principalId, principalType: "HUMAN", roles: Object.freeze([]), assurance: "SINGLE_FACTOR", isMfaVerified: false, status: "ACTIVE" });
    this.#captures.set(identity, captured);
    return identity;
  }
  public assertPrimitiveAvailable(): void { this.crypto.assertAvailable(); }
  public async revalidate(identity: AuthenticatedIdentity, client: PostgreSqlClientPort): Promise<void> {
    const captured = this.#captures.get(identity);
    this.#captures.delete(identity);
    if (captured === undefined) throw new FirstPartyAuthenticationError("INVALID_CREDENTIAL");
    // Shared transaction lock coordinates with the Identity-owned table write guards.
    // It grants neither row write authority nor credential mutation privileges.
    try { await client.query("SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))", [`identity-human-credential:${captured.principal.principalId}`]); }
    catch { throw new FirstPartyAuthenticationError(); }
    const current = await this.reader.capture(this.expectedTenantId, captured.principal.loginIdentifier, client);
    if (current === null || !sameCapture(captured, current)) throw new FirstPartyAuthenticationError("INVALID_CREDENTIAL");
  }
}
function cloneCapture(captured: HumanCredentialCapture): HumanCredentialCapture {
  return Object.freeze({ principal: Object.freeze({ ...captured.principal }), credential: Object.freeze({ ...captured.credential, salt: Buffer.from(captured.credential.salt), derivedKey: Buffer.from(captured.credential.derivedKey) }) });
}
function sameCapture(left: HumanCredentialCapture, right: HumanCredentialCapture): boolean {
  const { salt: leftSalt, derivedKey: leftKey, ...leftCredential } = left.credential;
  const { salt: rightSalt, derivedKey: rightKey, ...rightCredential } = right.credential;
  return Object.keys(left.principal).every(key => left.principal[key as keyof typeof left.principal] === right.principal[key as keyof typeof right.principal])
    && Object.keys(leftCredential).every(key => leftCredential[key as keyof typeof leftCredential] === rightCredential[key as keyof typeof rightCredential])
    && leftSalt.length === rightSalt.length && leftKey.length === rightKey.length
    && timingSafeEqual(leftSalt, rightSalt) && timingSafeEqual(leftKey, rightKey);
}
