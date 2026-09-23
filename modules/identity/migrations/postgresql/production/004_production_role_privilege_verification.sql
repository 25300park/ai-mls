-- REL-002 Phase 2D-0K read-only post-migration verification artifact.
-- Requires the 001 migration and 002 runtime grants to have completed successfully.
-- Every returned `matches_expected` value must be true before the execution gate can pass.

WITH expected(role_name) AS (VALUES
  ('ai_mls_production_runtime'::name),
  ('ai_mls_production_migration_operator'::name)
)
SELECT expected.role_name,
  roles.rolcanlogin
    AND NOT roles.rolsuper
    AND NOT roles.rolcreatedb
    AND NOT roles.rolcreaterole
    AND NOT roles.rolinherit
    AND NOT roles.rolreplication
    AND NOT roles.rolbypassrls AS matches_expected
FROM expected
LEFT JOIN pg_catalog.pg_roles roles ON roles.rolname = expected.role_name
ORDER BY expected.role_name;

WITH expected(role_name, connect_expected, create_expected) AS (VALUES
  ('ai_mls_production_runtime', true, false),
  ('ai_mls_production_migration_operator', true, true)
), database_acl AS (
  SELECT grantee_roles.rolname::text AS role_name,
    privileges.privilege_type,
    privileges.is_grantable
  FROM pg_catalog.pg_database databases
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(databases.datacl, pg_catalog.acldefault('d', databases.datdba))
  ) privileges
  JOIN pg_catalog.pg_roles grantee_roles ON grantee_roles.oid = privileges.grantee
  WHERE databases.datname = 'postgres'
)
SELECT expected.role_name,
  pg_catalog.has_database_privilege(expected.role_name, 'postgres', 'TEMPORARY') AS effective_temporary_observed,
  EXISTS (
    SELECT 1 FROM database_acl
    WHERE database_acl.role_name = expected.role_name
      AND database_acl.privilege_type = 'TEMPORARY'
  ) AS direct_temporary_observed,
  pg_catalog.has_database_privilege(expected.role_name, 'postgres', 'CONNECT') = expected.connect_expected
    AND pg_catalog.has_database_privilege(expected.role_name, 'postgres', 'CREATE') = expected.create_expected
    AND EXISTS (
      SELECT 1 FROM database_acl
      WHERE database_acl.role_name = expected.role_name
        AND database_acl.privilege_type = 'CONNECT'
    )
    AND (
      EXISTS (
        SELECT 1 FROM database_acl
        WHERE database_acl.role_name = expected.role_name
          AND database_acl.privilege_type = 'CREATE'
      )
    ) = expected.create_expected
    AND NOT EXISTS (
      SELECT 1 FROM database_acl
      WHERE database_acl.role_name = expected.role_name
        AND database_acl.privilege_type = 'TEMPORARY'
    )
    AND NOT EXISTS (
      SELECT 1 FROM database_acl
      WHERE database_acl.role_name = expected.role_name
        AND database_acl.is_grantable
    )
    AND NOT EXISTS (
      SELECT 1 FROM database_acl
      WHERE database_acl.role_name = expected.role_name
        AND database_acl.privilege_type NOT IN ('CONNECT', 'CREATE')
    ) AS matches_expected
FROM expected
ORDER BY expected.role_name;

SELECT 'ai_mls_production_runtime' AS role_name,
  pg_catalog.has_schema_privilege('ai_mls_production_runtime', 'app_identity', 'USAGE')
    AND NOT pg_catalog.has_schema_privilege('ai_mls_production_runtime', 'app_identity', 'CREATE') AS matches_expected;

WITH expected(table_name, can_select, can_insert, can_update) AS (VALUES
  ('identity_schema_contracts', true, false, false),
  ('identity_schema_migrations', true, false, false),
  ('identity_registered_service_workloads', true, false, false),
  ('identity_sessions', true, true, true),
  ('identity_session_revocations', false, true, false)
)
SELECT table_name,
  pg_catalog.has_table_privilege('ai_mls_production_runtime', 'app_identity.' || table_name, 'SELECT') = can_select
    AND pg_catalog.has_table_privilege('ai_mls_production_runtime', 'app_identity.' || table_name, 'INSERT') = can_insert
    AND pg_catalog.has_table_privilege('ai_mls_production_runtime', 'app_identity.' || table_name, 'UPDATE') = can_update
    AND NOT pg_catalog.has_table_privilege('ai_mls_production_runtime', 'app_identity.' || table_name, 'DELETE')
    AND NOT pg_catalog.has_table_privilege('ai_mls_production_runtime', 'app_identity.' || table_name, 'TRUNCATE')
    AND NOT pg_catalog.has_table_privilege('ai_mls_production_runtime', 'app_identity.' || table_name, 'REFERENCES')
    AND NOT pg_catalog.has_table_privilege('ai_mls_production_runtime', 'app_identity.' || table_name, 'TRIGGER') AS matches_expected
FROM expected
ORDER BY table_name;

SELECT count(*) = 0 AS matches_expected
FROM information_schema.table_privileges
WHERE grantee IN ('ai_mls_production_runtime', 'ai_mls_production_migration_operator')
  AND is_grantable = 'YES';

SELECT count(*) = 0 AS matches_expected
FROM pg_catalog.pg_namespace namespaces
CROSS JOIN LATERAL pg_catalog.aclexplode(
  COALESCE(namespaces.nspacl, pg_catalog.acldefault('n', namespaces.nspowner))
) privileges
JOIN pg_catalog.pg_roles grantee_roles ON grantee_roles.oid = privileges.grantee
WHERE namespaces.nspname = 'app_identity'
  AND grantee_roles.rolname IN ('ai_mls_production_runtime', 'ai_mls_production_migration_operator')
  AND privileges.is_grantable;

SELECT count(*) = 0 AS matches_expected
FROM pg_catalog.pg_auth_members memberships
JOIN pg_catalog.pg_roles member_role ON member_role.oid = memberships.member
WHERE member_role.rolname IN ('ai_mls_production_runtime', 'ai_mls_production_migration_operator');

SELECT count(*) = 0 AS matches_expected
FROM pg_catalog.pg_class objects
JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = objects.relnamespace
JOIN pg_catalog.pg_roles owners ON owners.oid = objects.relowner
WHERE namespaces.nspname = 'app_identity'
  AND owners.rolname = 'ai_mls_production_runtime';
