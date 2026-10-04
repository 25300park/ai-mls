import { REGISTRATION_OPERATOR_ACL_QUERY } from "../../../modules/identity/src/registration-operator-acl.js";

/** Keep historical runtime/migration fingerprints intact; validate the approved operational ACL independently. */
export function withRegistrationOperatorReadiness(query: string): string {
  const operator = "(SELECT oid FROM pg_roles WHERE rolname='ai_mls_production_registration_operator')";
  const schemaAcl = "FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a)";
  const tableAcl = "FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a)";
  if (!query.includes(schemaAcl) || !query.includes(tableAcl)) throw new Error("Unsupported readiness catalog contract.");
  const projected = query
    .replace(schemaAcl, `FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE NOT (a.grantee IS NOT DISTINCT FROM ${operator} AND n.nspname IN ('app_identity','app_audit') AND a.privilege_type='USAGE' AND NOT a.is_grantable))`)
    .replace(tableAcl, `FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE NOT (a.grantee IS NOT DISTINCT FROM ${operator} AND e.schema_name||'.'||e.table_name IN ('app_identity.identity_registered_service_workloads','app_identity.identity_workload_evidence','app_audit.audit_evidence_read_records') AND a.privilege_type IN ('SELECT','INSERT') AND NOT a.is_grantable))`);
  // Legacy databases without the new role retain their original checks. If present, every approved privilege and absence check is mandatory.
  return `SELECT * FROM (${projected}) catalog WHERE CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ai_mls_production_registration_operator') THEN (${REGISTRATION_OPERATOR_ACL_QUERY}) ELSE true END`;
}
