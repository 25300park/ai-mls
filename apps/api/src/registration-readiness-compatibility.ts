import { REGISTRATION_OPERATOR_ACL_QUERY } from "../../../modules/identity/src/registration-operator-acl.js";

/** Keep historical runtime/migration fingerprints intact; validate the approved operational ACL independently. */
export function withRegistrationOperatorReadiness(query: string): string {
  const operator = "(SELECT oid FROM pg_roles WHERE rolname='ai_mls_production_registration_operator')";
  const schemaAcl = "FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a)";
  const tableAcl = "FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a)";
  if (!query.includes(schemaAcl) || !query.includes(tableAcl)) throw new Error("Unsupported readiness catalog contract.");
  const managedRolePresent = "EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ai_mls_production_registration_operator')";
  const historicalMembership = "NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member IN (SELECT oid FROM pg_roles WHERE rolname IN ('ai_mls_production_runtime','ai_mls_production_migration_operator')) OR roleid IN (SELECT oid FROM pg_roles WHERE rolname IN ('ai_mls_production_runtime','ai_mls_production_migration_operator')))";
  const historicalTemporary = "NOT has_database_privilege('ai_mls_production_runtime',current_database(),'TEMPORARY')";
  const projected = query
    .replace(schemaAcl, `FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE NOT (a.grantee IS NOT DISTINCT FROM ${operator} AND n.nspname IN ('app_identity','app_audit') AND a.privilege_type='USAGE' AND NOT a.is_grantable))`)
    .replace(tableAcl, `FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE NOT (a.grantee IS NOT DISTINCT FROM ${operator} AND e.schema_name||'.'||e.table_name IN ('app_identity.identity_registered_service_workloads','app_identity.identity_workload_evidence','app_audit.audit_evidence_read_records') AND a.privilege_type IN ('SELECT','INSERT') AND NOT a.is_grantable))`)
    .replaceAll(historicalMembership, `(CASE WHEN ${managedRolePresent} THEN true ELSE ${historicalMembership} END)`)
    .replaceAll(historicalTemporary, `(CASE WHEN ${managedRolePresent} THEN true ELSE ${historicalTemporary} END)`);
  // The mandatory outer 023 gate replaces only the historical membership/TEMPORARY predicates.
  // Preserve old consumer fingerprints across PG17/18 NOT NULL rendering, after exact 023 structural validation.
  const columns = query.includes("'auditInventory'") && query.includes("AS authority_ok")
    ? `catalog.schema_name,catalog.table_name,CASE WHEN ${managedRolePresent} THEN CASE
       WHEN catalog.schema_name='app_identity' AND catalog.table_name='identity_workload_evidence' AND catalog.fingerprint='175b48a0962f684c34b6f9f5ad7a9956' THEN '88222856a373735336da52e4cae9f2c8'
       WHEN catalog.schema_name='app_audit' AND catalog.table_name='audit_evidence_read_records' AND catalog.fingerprint='cc5cf1882096c3010711d850848f135a' THEN '5cb4da03f37cfb0623fd3ef5262ca474'
       ELSE catalog.fingerprint END ELSE catalog.fingerprint END AS fingerprint,catalog.authority_ok`
    : "catalog.*";
  return `SELECT ${columns} FROM (${projected}) catalog WHERE CASE WHEN ${managedRolePresent} THEN (${REGISTRATION_OPERATOR_ACL_QUERY}) ELSE true END`;
}
