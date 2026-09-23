-- REL-002 read-only pre-migration role/database privilege verification.
-- Execute after 000 and 003, before 001 migration and 002 runtime grants.
-- Every returned `matches_expected` value must be true before migration may begin.

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

WITH expected(role_name, direct_connect_expected, direct_create_expected) AS (VALUES
  ('ai_mls_production_runtime', false, false),
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
  (
    EXISTS (
      SELECT 1 FROM database_acl
      WHERE database_acl.role_name = expected.role_name
        AND database_acl.privilege_type = 'CONNECT'
    )
  ) = expected.direct_connect_expected
    AND (
      EXISTS (
        SELECT 1 FROM database_acl
        WHERE database_acl.role_name = expected.role_name
          AND database_acl.privilege_type = 'CREATE'
      )
    ) = expected.direct_create_expected
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

SELECT count(*) = 0 AS matches_expected
FROM pg_catalog.pg_auth_members memberships
JOIN pg_catalog.pg_roles member_role ON member_role.oid = memberships.member
WHERE member_role.rolname IN ('ai_mls_production_runtime', 'ai_mls_production_migration_operator');
