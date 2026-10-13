import type { PostgreSqlClientPort, PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
import { REGISTRATION_OPERATOR_ACL_QUERY } from "../../../modules/identity/src/registration-operator-acl.js";
import { GovernancePersistenceError } from "../../../modules/organization/src/governance-persistence-support.js";
import { assertR3C2AggregateSchemasReady, assertR3C2IdentityBaseReady, normalizeIdentityExtensionCatalogQuery } from "./r3c2-aggregate-readiness.js";
import { R3C1_COMPATIBILITY_QUERY } from "./r3c1-catalog-compatibility.js";
import { R3C2B_IDENTITY_COMPATIBILITY_QUERY } from "./r3c2b-identity-catalog-compatibility.js";
import { R3C2C_COMPATIBILITY_QUERY } from "./r3c2c-catalog-compatibility.js";
import { R3C2B_EVIDENCE_CATALOG_QUERY } from "./r3c2b-postgresql-readiness.js";
import { R3C2C_TEAM_CATALOG_QUERY } from "./r3c2c-postgresql-readiness.js";
import { FIRST_PARTY_CREDENTIAL_CATALOG_QUERY } from "./first-party-authentication-readiness.js";
import { PRODUCTION_SESSION_BINDING_CATALOG_QUERY } from "./production-trusted-binding-readiness.js";

export const FORWARD_REGISTRATION_CONTRACT_ID = "REL002-REGISTRATION-POST-IDENTITY014-AUDIT002-V1";
const unavailable = (): GovernancePersistenceError => new GovernancePersistenceError("UNAVAILABLE");
export function assertForwardRegistrationContract(id: unknown): void {
 if (id !== FORWARD_REGISTRATION_CONTRACT_ID) throw unavailable();
}

// Reuse only immutable authority predicates. Root structure is independently checked by
// the complete current R3C2 chain, never by the historical Audit001 fingerprint.
function authorityQuery(): string {
 const start = REGISTRATION_OPERATOR_ACL_QUERY.indexOf("role_names(role_name, can_create)");
 const end = REGISTRATION_OPERATOR_ACL_QUERY.indexOf("\nSELECT root.schema_name");
 if (start < 0 || end <= start) throw unavailable();
 return `WITH ${REGISTRATION_OPERATOR_ACL_QUERY.slice(start,end)}
 SELECT coalesce(role_acl_ok AND membership_ok AND ownership_ok AND registration_acl_ok,false) AS ready
 FROM role_check CROSS JOIN membership_check CROSS JOIN ownership_check CROSS JOIN registration_contract`;
}
export const FORWARD_REGISTRATION_AUTHORITY_QUERY = authorityQuery();

// Subsets of the approved direct object grants are structurally removable. This
// gate deliberately does not require a role, membership, attributes, or counts.
// Completeness and database/effective authority remain operational checks.
export const FORWARD_REGISTRATION_STRUCTURAL_ACL_QUERY = `WITH operator AS (
 SELECT oid FROM pg_roles WHERE rolname='ai_mls_production_registration_operator'
), targets(name) AS (VALUES ('app_identity.identity_registered_service_workloads'),
 ('app_identity.identity_workload_evidence'),('app_audit.audit_evidence_read_records'))
SELECT NOT EXISTS (
 SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a
 WHERE a.grantee=(SELECT oid FROM operator) AND
 (n.nspname NOT IN ('app_identity','app_audit') OR a.privilege_type<>'USAGE' OR a.is_grantable
 OR a.grantor IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='ai_mls_production_migration_operator'))
 UNION ALL
 SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
 WHERE a.grantee=(SELECT oid FROM operator) AND
 (c.oid NOT IN (SELECT to_regclass(name) FROM targets) OR a.privilege_type NOT IN ('SELECT','INSERT') OR a.is_grantable
 OR a.grantor IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='ai_mls_production_migration_operator'))
 UNION ALL
 SELECT 1 FROM pg_attribute at CROSS JOIN LATERAL aclexplode(at.attacl) a WHERE a.grantee=(SELECT oid FROM operator)
 UNION ALL
 SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE a.grantee=(SELECT oid FROM operator)
 UNION ALL
 SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE a.grantee=(SELECT oid FROM operator)
) AS ready`;

/** Exact known forward query identities only. No change to any legacy caller. */
export function projectForwardRegistrationQuery(query: string): string {
 const known = [R3C1_COMPATIBILITY_QUERY, R3C2B_IDENTITY_COMPATIBILITY_QUERY, R3C2C_COMPATIBILITY_QUERY,
  R3C2B_EVIDENCE_CATALOG_QUERY, R3C2C_TEAM_CATALOG_QUERY,
  FIRST_PARTY_CREDENTIAL_CATALOG_QUERY, PRODUCTION_SESSION_BINDING_CATALOG_QUERY];
 if (!known.some(sql => query === sql || query === normalizeIdentityExtensionCatalogQuery(sql))) return query;
 if (!query.includes(REGISTRATION_OPERATOR_ACL_QUERY)) throw unavailable();
 const present = "EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ai_mls_production_registration_operator')";
 const gate = `CASE WHEN ${present} THEN (${REGISTRATION_OPERATOR_ACL_QUERY}) ELSE true END`;
 const membership = "NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member IN (SELECT oid FROM pg_roles WHERE rolname IN ('ai_mls_production_runtime','ai_mls_production_migration_operator')) OR roleid IN (SELECT oid FROM pg_roles WHERE rolname IN ('ai_mls_production_runtime','ai_mls_production_migration_operator')))";
 const temporary = "NOT has_database_privilege('ai_mls_production_runtime',current_database(),'TEMPORARY')";
 if (!query.includes(gate)) throw unavailable();
 // Topology is operational; runtime effective privileges and immutable role/owner
 // checks remain in the structural material. DEC-192 has no role-presence switch.
 const publicTemporary = `(NOT EXISTS (SELECT 1 FROM pg_database d CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a
 WHERE d.datname=current_database() AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname='ai_mls_production_runtime') AND a.privilege_type='TEMPORARY')
 AND has_database_privilege('ai_mls_production_runtime',current_database(),'TEMPORARY')=EXISTS
 (SELECT 1 FROM pg_database d CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a
 WHERE d.datname=current_database() AND a.grantee=0 AND a.privilege_type='TEMPORARY'))`;
 return query.replaceAll(gate,`(${FORWARD_REGISTRATION_STRUCTURAL_ACL_QUERY})`)
  .replaceAll(`(CASE WHEN ${present} THEN true ELSE ${membership} END)`,"true")
  .replaceAll(`(CASE WHEN ${present} THEN true ELSE ${temporary} END)`,publicTemporary);
}

function projectedPool(pool: PostgreSqlPoolPort): PostgreSqlPoolPort {
 return { close: (): Promise<void> => Promise.reject(unavailable()), connect: async (): Promise<PostgreSqlClientPort> => {
  const client = await pool.connect();
  return { release: destroy => client.release(destroy), query: (sql, values) => client.query(projectForwardRegistrationQuery(sql),values) };
 }};
}

export const FORWARD_REGISTRATION_IDENTITY_QUERY = `SELECT current_user,session_user,current_database() AS database,
 current_setting('server_version_num') AS server_version_num`;
export function forwardRegistrationIdentityReady(rows: readonly Record<string,unknown>[], role: string): boolean {
 if (rows.length !== 1) return false;
 const row = rows[0]!;
 return row['current_user'] === role && row['session_user'] === role && row['database'] === 'postgres'
  && typeof row['server_version_num'] === 'string' && /^(17|18)\d{4}$/.test(row['server_version_num']);
}
async function identity(client: PostgreSqlClientPort, role: string): Promise<void> {
 if (!forwardRegistrationIdentityReady((await client.query(FORWARD_REGISTRATION_IDENTITY_QUERY)).rows,role)) throw unavailable();
}

/** Read-only catalog authority check; callers must separately validate structure on the runtime pool. */
export async function validateForwardRegistrationAuthority(client: PostgreSqlClientPort, contractId: unknown): Promise<void> {
 assertForwardRegistrationContract(contractId);
 await identity(client,'ai_mls_production_registration_operator');
 const rows = (await client.query(FORWARD_REGISTRATION_AUTHORITY_QUERY)).rows;
 if (rows.length !== 1 || rows[0]?.['ready'] !== true) throw unavailable();
}

/** Does not provision a role, close the caller's pool, or confer registration execution authority. */
export async function validateForwardRegistrationStructure(pool: PostgreSqlPoolPort, contractId: unknown): Promise<void> {
 assertForwardRegistrationContract(contractId);
 const client = await pool.connect();
 try { await identity(client,'ai_mls_production_runtime'); } finally { client.release(); }
 const forward = projectedPool(pool);
 // The full chain verifies all five artifact bindings and current roots. Structural
 // projection checks contamination, never operational provisioning completeness.
 await assertR3C2AggregateSchemasReady(forward);
 const provenance = await assertR3C2IdentityBaseReady(forward);
 if (provenance !== 'NATIVE_MIGRATION_LEDGER_VERIFIED' && provenance !== 'HISTORICAL_MIGRATION_ATTESTATION_VERIFIED') throw unavailable();
}

/** Operational readiness on the runtime pool; separate from registration command authority. */
export async function validateForwardRegistrationReadiness(pool: PostgreSqlPoolPort, contractId: unknown): Promise<void> {
 await validateForwardRegistrationStructure(pool,contractId);
 const client = await pool.connect();
 try {
  await identity(client,'ai_mls_production_runtime');
  const rows = (await client.query(FORWARD_REGISTRATION_AUTHORITY_QUERY)).rows;
  if (rows.length !== 1 || rows[0]?.['ready'] !== true) throw unavailable();
 } finally { client.release(); }
}
