import type { PostgreSqlPoolPort } from "../../../modules/identity/src/index.js";

export interface R3B1ChildRootSchemaContract {
  readonly schemaName: string;
  readonly artifactSha256: string;
  readonly tableCount: number;
  readonly schemaComment: string;
  readonly columnsHash: string;
  readonly constraintsHash: string;
  readonly indexesHash: string;
  readonly runtimeAclHash: string;
  readonly triggerHash: string;
  readonly functionHash: string;
  readonly effectiveAclHash: string;
}

export const R3B1_CHILD_ROOT_SCHEMA_CONTRACTS = Object.freeze([
  Object.freeze({ schemaName: "app_publication", artifactSha256: "613ecc0dfbe1a2ffd2d2edcdbda1d27b55713b8bcd09be6bc6e7bdbb7871d885", tableCount: 8, schemaComment: "REL002-R3B1-PUBLICATION-V1|schema_version=1|contract_fingerprint=pub-v1-8-tables", columnsHash: "7ec75fcc4191f132cac4a5ee7f2607ab", constraintsHash: "6ba8469f5859fb9e951e6f09872823d0", indexesHash: "d3837969e1fd6b51c2169629198fa10a", runtimeAclHash: "8f0a2ed43d7dd7ce7ea0e5a2a5803449", triggerHash: "773fbb636bd1120600e6b87020c93af4", functionHash: "c55bb1de5ccba2b1308a21316f1acaa0", effectiveAclHash: "df8a0c41f873818a01aedbf9c1bdd49a" }),
  Object.freeze({ schemaName: "app_administration", artifactSha256: "f3da51aa3f55a0e7e1ba483f6d903950d8742b94a0d0bce9aea5f82bb8bfce3b", tableCount: 9, schemaComment: "REL002-R3B1-ADMINISTRATION-V1|schema_version=1|contract_fingerprint=admin-v1-9-tables", columnsHash: "baea1c66a797cd4050b8dcc66b4ed141", constraintsHash: "3851818b41537b601a7f78c9fcb7d337", indexesHash: "baf1b3f04ca0634c88567abd6660f747", runtimeAclHash: "af77b1bfe7187fc9d1503ddf6a621672", triggerHash: "70bdbf867cca2b929cdfa82bda5238e5", functionHash: "c55bb1de5ccba2b1308a21316f1acaa0", effectiveAclHash: "20091c4aff8281f71c63abcb16fa0903" }),
  Object.freeze({ schemaName: "app_connector", artifactSha256: "a6a65bd9c779cf047a4261eb11822414fff131708af68b7ee3029cb3cfbe91fd", tableCount: 11, schemaComment: "REL002-R3B1-CONNECTOR-V1|schema_version=1|contract_fingerprint=connector-v1-11-tables", columnsHash: "e264390d79ed9b702abb6609d28b0a2f", constraintsHash: "256c3fc580fa577b32298aac39a2f67e", indexesHash: "ae9222210e39fb4f9014656cf73a6624", runtimeAclHash: "56591d3848d8a0f7378014e63b252cf9", triggerHash: "47231d0041ea74af8624722a9e5ea6f6", functionHash: "c55bb1de5ccba2b1308a21316f1acaa0", effectiveAclHash: "9d26d3b8596bc9ec86cf489d5d5804af" }),
  Object.freeze({ schemaName: "app_external_integration", artifactSha256: "fc629a5ccdd5fb4f5a8c97029178f0f523a1d37eb3d483c64c528f7c8bdb4e68", tableCount: 5, schemaComment: "REL002-R3B1-EXTERNAL-INTEGRATION-V1|schema_version=1|contract_fingerprint=external-v1-5-tables", columnsHash: "02123ed812e7be4d91778c953534f11f", constraintsHash: "33533b7e20fa31f87ef1d3b38f740f4e", indexesHash: "072616f3f1ba407fcf5d078dd36888da", runtimeAclHash: "139da4dae7af2d0e274941dee153a9e0", triggerHash: "d1f0ef5b78c26759199ee98e0675537b", functionHash: "c55bb1de5ccba2b1308a21316f1acaa0", effectiveAclHash: "31c0c7bf86e2741d2a0e9672a9d5f13f" }),
  Object.freeze({ schemaName: "app_advisory", artifactSha256: "ae70f9c9b3b18b08eff3e2b0b8bbdb24c14b9ca6a6a980cfc1f320b9223bc6ac", tableCount: 3, schemaComment: "REL002-R3B1-ADVISORY-V1|schema_version=1|contract_fingerprint=advisory-v1-3-tables", columnsHash: "7dfd0b9b9df28e5872e143012c428092", constraintsHash: "a2680ba17fd129ee99b229492ae7b1f0", indexesHash: "68b027127b2012e14df946552dd14121", runtimeAclHash: "fb9da767cf2d7c00b2da4b982a632f35", triggerHash: "9a8a4913e4d6cf49597204466c84c720", functionHash: "c55bb1de5ccba2b1308a21316f1acaa0", effectiveAclHash: "42150fb07658a71077af24c0b8c9ba3b" }),
] satisfies readonly R3B1ChildRootSchemaContract[]);

interface ReadinessRow extends Record<string, unknown> {
  readonly schema_name: string;
  readonly artifact_sha256: string | null;
  readonly table_count: number;
  readonly schema_comment: string | null;
  readonly runtime_usage: boolean;
  readonly runtime_create: boolean;
  readonly public_acl_count: number;
  readonly runtime_grant_option_count: number;
  readonly columns_hash: string | null;
  readonly constraints_hash: string | null;
  readonly indexes_hash: string | null;
  readonly runtime_acl_hash: string | null;
  readonly trigger_hash: string | null;
  readonly function_hash: string | null;
  readonly effective_acl_hash: string | null;
  readonly owner_name: string | null;
  readonly table_owner_violation_count: number;
  readonly function_owner_violation_count: number;
  readonly table_acl_violation_count: number;
  readonly public_schema_acl_count: number;
  readonly schema_grant_option_count: number;
  readonly function_acl_violation_count: number;
  readonly unexpected_runtime_membership_count: number;
  readonly sequence_count: number;
  readonly unexpected_role_membership: boolean;
}

const READINESS_QUERY = `
WITH expected(schema_name) AS (
  VALUES ('app_publication'), ('app_administration'), ('app_connector'),
         ('app_external_integration'), ('app_advisory')
)
SELECT expected.schema_name,
       CASE expected.schema_name
         WHEN 'app_publication' THEN current_setting('ai_mls.r3b1_publication_artifact_sha256',true)
         WHEN 'app_administration' THEN current_setting('ai_mls.r3b1_administration_artifact_sha256',true)
         WHEN 'app_connector' THEN current_setting('ai_mls.r3b1_connector_artifact_sha256',true)
         WHEN 'app_external_integration' THEN current_setting('ai_mls.r3b1_external_integration_artifact_sha256',true)
         WHEN 'app_advisory' THEN current_setting('ai_mls.r3b1_advisory_artifact_sha256',true)
       END AS artifact_sha256,
       count(DISTINCT t.tablename)::integer AS table_count,
       obj_description(n.oid, 'pg_namespace') AS schema_comment,
       COALESCE(has_schema_privilege('ai_mls_production_runtime', n.oid, 'USAGE'), false) AS runtime_usage,
       COALESCE(has_schema_privilege('ai_mls_production_runtime', n.oid, 'CREATE'), false) AS runtime_create,
       (SELECT count(*)::integer FROM pg_class r CROSS JOIN LATERAL aclexplode(coalesce(r.relacl,acldefault('r',r.relowner))) a WHERE r.relnamespace=n.oid AND r.relkind='r' AND a.grantee=0) AS public_acl_count,
       (SELECT count(*)::integer FROM pg_class r CROSS JOIN LATERAL aclexplode(coalesce(r.relacl,acldefault('r',r.relowner))) a WHERE r.relnamespace=n.oid AND r.relkind='r' AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname='ai_mls_production_runtime') AND a.is_grantable) AS runtime_grant_option_count,
       (SELECT md5(string_agg(concat_ws('|', table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, coalesce(column_default,'')), E'\n' ORDER BY table_name, ordinal_position)) FROM information_schema.columns WHERE table_schema=expected.schema_name) AS columns_hash,
       (SELECT md5(string_agg(concat_ws('|', r.relname, c.conname, c.contype, pg_get_constraintdef(c.oid,true)), E'\n' ORDER BY r.relname,c.conname)) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace cn ON cn.oid=r.relnamespace WHERE cn.nspname=expected.schema_name) AS constraints_hash,
       (SELECT md5(string_agg(concat_ws('|', it.relname, ii.relname, pg_get_indexdef(ix.indexrelid)), E'\n' ORDER BY it.relname,ii.relname)) FROM pg_index ix JOIN pg_class it ON it.oid=ix.indrelid JOIN pg_class ii ON ii.oid=ix.indexrelid JOIN pg_namespace ixn ON ixn.oid=it.relnamespace WHERE ixn.nspname=expected.schema_name) AS indexes_hash,
       (SELECT md5(string_agg(concat_ws('|',r.relname,a.privilege_type,CASE WHEN a.is_grantable THEN 'YES' ELSE 'NO' END),E'\n' ORDER BY r.relname,a.privilege_type)) FROM pg_class r CROSS JOIN LATERAL aclexplode(coalesce(r.relacl,acldefault('r',r.relowner))) a WHERE r.relnamespace=n.oid AND r.relkind='r' AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname='ai_mls_production_runtime')) AS runtime_acl_hash,
       (SELECT md5(string_agg(concat_ws('|',r.relname,tr.tgname,tr.tgenabled,tr.tgtype,pn.nspname,p.proname,pg_get_triggerdef(tr.oid,true)),E'\n' ORDER BY r.relname,tr.tgname)) FROM pg_trigger tr JOIN pg_class r ON r.oid=tr.tgrelid JOIN pg_namespace tn ON tn.oid=r.relnamespace JOIN pg_proc p ON p.oid=tr.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE tn.nspname=expected.schema_name AND NOT tr.tgisinternal) AS trigger_hash,
       (SELECT md5(string_agg(concat_ws('|',p.proname,l.lanname,pg_get_function_result(p.oid),trim(p.prosrc),pg_get_userbyid(p.proowner),p.prosecdef,coalesce(array_to_string(p.proconfig,','),'')),E'\n' ORDER BY p.proname)) FROM pg_proc p JOIN pg_namespace fn ON fn.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE fn.nspname=expected.schema_name) AS function_hash,
       (SELECT md5(string_agg(concat_ws('|',rt.tablename,has_table_privilege('ai_mls_production_runtime',format('%I.%I',rt.schemaname,rt.tablename),'SELECT'),has_table_privilege('ai_mls_production_runtime',format('%I.%I',rt.schemaname,rt.tablename),'INSERT'),has_table_privilege('ai_mls_production_runtime',format('%I.%I',rt.schemaname,rt.tablename),'UPDATE'),has_table_privilege('ai_mls_production_runtime',format('%I.%I',rt.schemaname,rt.tablename),'DELETE'),has_table_privilege('ai_mls_production_runtime',format('%I.%I',rt.schemaname,rt.tablename),'TRUNCATE'),has_table_privilege('ai_mls_production_runtime',format('%I.%I',rt.schemaname,rt.tablename),'REFERENCES'),has_table_privilege('ai_mls_production_runtime',format('%I.%I',rt.schemaname,rt.tablename),'TRIGGER')),E'\n' ORDER BY rt.tablename)) FROM pg_tables rt WHERE rt.schemaname=expected.schema_name) AS effective_acl_hash,
       pg_get_userbyid(n.nspowner) AS owner_name,
       (SELECT count(*)::integer FROM pg_tables owned WHERE owned.schemaname=expected.schema_name AND owned.tableowner<>'ai_mls_production_migration_operator') AS table_owner_violation_count,
       (SELECT count(*)::integer FROM pg_proc p JOIN pg_namespace fn ON fn.oid=p.pronamespace WHERE fn.nspname=expected.schema_name AND pg_get_userbyid(p.proowner)<>'ai_mls_production_migration_operator') AS function_owner_violation_count,
       (SELECT count(*)::integer FROM pg_class r CROSS JOIN LATERAL aclexplode(coalesce(r.relacl,acldefault('r',r.relowner))) a WHERE r.relnamespace=n.oid AND r.relkind='r' AND (a.grantee NOT IN (r.relowner,(SELECT oid FROM pg_roles WHERE rolname='ai_mls_production_runtime')) OR (a.grantee=(SELECT oid FROM pg_roles WHERE rolname='ai_mls_production_runtime') AND a.is_grantable))) AS table_acl_violation_count,
       (SELECT count(*)::integer FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE a.grantee=0) AS public_schema_acl_count,
       (SELECT count(*)::integer FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a JOIN pg_roles role ON role.oid=a.grantee WHERE role.rolname='ai_mls_production_runtime' AND a.is_grantable) AS schema_grant_option_count,
       (SELECT count(*)::integer FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace=n.oid AND a.grantee<>p.proowner) AS function_acl_violation_count,
       (SELECT count(*)::integer FROM pg_auth_members WHERE member IN (SELECT oid FROM pg_roles WHERE rolname IN ('ai_mls_production_runtime','ai_mls_production_migration_operator'))) AS unexpected_runtime_membership_count,
       (SELECT count(*)::integer FROM pg_class sequence_rel WHERE sequence_rel.relnamespace=n.oid AND sequence_rel.relkind='S') AS sequence_count,
       EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles granted ON granted.oid=m.roleid JOIN pg_roles member_role ON member_role.oid=m.member WHERE granted.rolname IN ('ai_mls_production_runtime','ai_mls_production_migration_operator') AND member_role.rolname<>'postgres') AS unexpected_role_membership
FROM expected
LEFT JOIN pg_namespace n ON n.nspname = expected.schema_name
LEFT JOIN pg_tables t ON t.schemaname = expected.schema_name
GROUP BY expected.schema_name, n.oid
ORDER BY expected.schema_name`;

export async function assertR3B1ChildRootSchemasReady(pool: PostgreSqlPoolPort): Promise<void> {
  await assertContractsReady(pool, R3B1_CHILD_ROOT_SCHEMA_CONTRACTS);
}

export async function assertR3B1PublicationSchemaReady(pool: PostgreSqlPoolPort): Promise<void> {
  await assertContractsReady(pool, R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.filter((contract) => contract.schemaName === "app_publication"));
}

export async function assertR3B1AdministrationSchemaReady(pool: PostgreSqlPoolPort): Promise<void> {
  await assertContractsReady(pool, R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.filter((contract) => contract.schemaName === "app_administration"));
}

export async function assertR3B1ConnectorSchemaReady(pool: PostgreSqlPoolPort): Promise<void> {
  await assertContractsReady(pool, R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.filter((contract) => contract.schemaName === "app_connector"));
}

export async function assertR3B1ExternalIntegrationSchemaReady(pool: PostgreSqlPoolPort): Promise<void> {
  await assertContractsReady(pool, R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.filter((contract) => contract.schemaName === "app_external_integration"));
}

async function assertContractsReady(pool: PostgreSqlPoolPort, contracts: readonly R3B1ChildRootSchemaContract[]): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query<ReadinessRow>(READINESS_QUERY);
    if (result.rowCount < contracts.length) throw notReady();
    const bySchema = new Map(result.rows.map((row) => [row.schema_name, row]));
    for (const contract of contracts) {
      const row = bySchema.get(contract.schemaName);
      if (row?.artifact_sha256 !== contract.artifactSha256 || row.table_count !== contract.tableCount || row.schema_comment !== contract.schemaComment
        || row.runtime_usage !== true || row.runtime_create !== false || row.public_acl_count !== 0
        || row.runtime_grant_option_count !== 0 || row.columns_hash !== contract.columnsHash
        || row.constraints_hash !== contract.constraintsHash || row.indexes_hash !== contract.indexesHash
        || row.runtime_acl_hash !== contract.runtimeAclHash || row.owner_name !== "ai_mls_production_migration_operator"
        || row.trigger_hash !== contract.triggerHash || row.function_hash !== contract.functionHash
        || row.effective_acl_hash !== contract.effectiveAclHash || row.table_owner_violation_count !== 0
        || row.function_owner_violation_count !== 0 || row.table_acl_violation_count !== 0
        || row.unexpected_runtime_membership_count !== 0
        || row.public_schema_acl_count !== 0 || row.schema_grant_option_count !== 0
        || row.function_acl_violation_count !== 0 || row.sequence_count !== 0
        || row.unexpected_role_membership !== false) throw notReady();
    }
  } catch {
    throw notReady();
  } finally {
    client.release();
  }
}

function notReady(): Error {
  return new Error("R3B1_CHILD_ROOT_SCHEMA_NOT_READY");
}
