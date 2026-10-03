import { FirstPartyAuthenticationError } from "./first-party-credential-argon2.js";
import { validLoginIdentifier, type IdentityHumanPrincipalRecord, type IdentityHumanCredentialRecord } from "./first-party-credential-contracts.js";
import type { PostgreSqlClientPort, PostgreSqlPoolPort } from "./postgresql-pool.js";

export interface HumanCredentialCapture {
  readonly principal: IdentityHumanPrincipalRecord;
  readonly credential: IdentityHumanCredentialRecord;
}
export class PostgreSqlHumanCredentialReader {
  public constructor(private readonly pool: PostgreSqlPoolPort) {}

  public async findPrincipal(principalId: string, existingClient?: PostgreSqlClientPort): Promise<IdentityHumanPrincipalRecord | null> {
    if (!safeIdentifier(principalId)) return null;
    let client = existingClient;
    let discard = false;
    try {
      client ??= await this.pool.connect();
      const result = await client.query("SELECT principal_id, user_id, tenant_id, login_identifier, status, created_at, updated_at FROM app_identity.identity_human_principals WHERE principal_id = $1", [principalId]);
      if (result.rows.length !== 1) return null;
      const principal = decodePrincipal(result.rows[0]!);
      return principal?.principalId === principalId ? principal : null;
    } catch { discard = true; throw new FirstPartyAuthenticationError(); }
    finally { if (existingClient === undefined) { try { client?.release(discard); } catch { throw new FirstPartyAuthenticationError(); } } }
  }

  public async capture(expectedTenantId: string, loginIdentifier: string, existingClient?: PostgreSqlClientPort): Promise<HumanCredentialCapture | null> {
    if (!safeIdentifier(expectedTenantId) || !validLoginIdentifier(loginIdentifier)) return null;
    let client = existingClient;
    let discard = false;
    try {
      client ??= await this.pool.connect();
      const principals = await client.query("SELECT principal_id, user_id, tenant_id, login_identifier, status, created_at, updated_at FROM app_identity.identity_human_principals WHERE tenant_id = $1 AND login_identifier = $2 COLLATE \"C\"", [expectedTenantId, loginIdentifier]);
      if (principals.rows.length !== 1) return null;
      const principal = decodePrincipal(principals.rows[0]!);
      if (principal?.status !== "ACTIVE" || principal.tenantId !== expectedTenantId || principal.loginIdentifier !== loginIdentifier) return null;
      const credentials = await client.query("SELECT credential_id, principal_id, credential_version, credential_type, algorithm, algorithm_profile, salt, derived_key, status, created_at, rotated_at, revoked_at FROM app_identity.identity_human_credentials WHERE principal_id = $1 AND status = 'ACTIVE'", [principal.principalId]);
      if (credentials.rows.length !== 1) return null;
      const credential = decodeCredential(credentials.rows[0]!);
      if (credential?.status !== "ACTIVE" || credential.principalId !== principal.principalId) return null;
      return Object.freeze({ principal: Object.freeze(principal), credential: Object.freeze(credential) });
    } catch { discard = true; throw new FirstPartyAuthenticationError(); }
    finally {
      if (existingClient === undefined) {
        try { client?.release(discard); } catch { throw new FirstPartyAuthenticationError(); }
      }
    }
  }
}
function decodePrincipal(row: Record<string, unknown>): IdentityHumanPrincipalRecord | null {
  const createdAt = timestamp(row['created_at']);
  const updatedAt = timestamp(row['updated_at']);
  if (!safeIdentifier(row['principal_id']) || !safeIdentifier(row['user_id']) || !safeIdentifier(row['tenant_id'])
    || !validLoginIdentifier(row['login_identifier']) || !["ACTIVE", "DISABLED"].includes(String(row['status']))
    || createdAt === null || updatedAt === null || updatedAt < createdAt) return null;
  return { principalId: row['principal_id'], userId: row['user_id'], tenantId: row['tenant_id'], loginIdentifier: row['login_identifier'], status: row['status'] as IdentityHumanPrincipalRecord['status'], createdAt, updatedAt };
}
function decodeCredential(row: Record<string, unknown>): IdentityHumanCredentialRecord | null {
  const version = Number(row['credential_version']);
  const createdAt = timestamp(row['created_at']);
  const rotatedAt = row['rotated_at'] === null ? null : timestamp(row['rotated_at']);
  const revokedAt = row['revoked_at'] === null ? null : timestamp(row['revoked_at']);
  if (!safeIdentifier(row['credential_id']) || !safeIdentifier(row['principal_id']) || !Number.isSafeInteger(version) || version < 1
    || row['credential_type'] !== "PASSWORD" || row['algorithm'] !== "ARGON2ID" || row['algorithm_profile'] !== "ARGON2ID_V1"
    || !(row['salt'] instanceof Uint8Array) || row['salt'].length !== 16 || !(row['derived_key'] instanceof Uint8Array) || row['derived_key'].length !== 32
    || !["ACTIVE", "REVOKED"].includes(String(row['status'])) || createdAt === null
    || (row['rotated_at'] !== null && rotatedAt === null) || (row['revoked_at'] !== null && revokedAt === null)
    || (rotatedAt !== null && rotatedAt < createdAt) || (revokedAt !== null && revokedAt < createdAt)
    || (row['status'] === "ACTIVE" && revokedAt !== null) || (row['status'] === "REVOKED" && revokedAt === null)) return null;
  return { credentialId: row['credential_id'], principalId: row['principal_id'], credentialVersion: version, credentialType: "PASSWORD", algorithm: "ARGON2ID", algorithmProfile: "ARGON2ID_V1", salt: Buffer.from(row['salt']), derivedKey: Buffer.from(row['derived_key']), status: row['status'] as IdentityHumanCredentialRecord['status'], createdAt, rotatedAt, revokedAt };
}
function safeIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value && !/[\u0000-\u001f\u007f\\]/u.test(value);
}
function timestamp(value: unknown): string | null {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  return date === null || !Number.isFinite(date.getTime()) ? null : date.toISOString();
}
