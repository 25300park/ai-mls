-- REL-002 grantor-aware bounded recovery for the exact FAILED_PARTIAL execution of 002.
-- Execute once through the separately approved Production recovery gate.
-- 009 remains immutable and was not executed in Production because SET OPTION was false.
-- This artifact temporarily adds only a postgres-granted SET authority, removes it
-- by exact grantor provenance, and preserves the original supabase_admin membership.
-- 002 and 009 must not be rerun.

BEGIN;

DO $$
DECLARE
  table_name text;
  schema_oid oid;
  object_oid oid;
BEGIN
  SELECT oid INTO STRICT schema_oid
  FROM pg_catalog.pg_namespace
  WHERE nspname = 'app_identity';
  IF session_user <> 'postgres' OR current_user <> session_user THEN
    RAISE EXCEPTION 'REL002_010_SESSION_AUTHORITY_MISMATCH';
  END IF;
  IF current_database() <> 'postgres'
    OR (SELECT pg_catalog.pg_get_userbyid(datdba) FROM pg_catalog.pg_database WHERE datname = current_database()) <> session_user THEN
    RAISE EXCEPTION 'REL002_010_DATABASE_OWNER_MISMATCH';
  END IF;
  IF pg_catalog.pg_has_role(session_user, 'ai_mls_production_migration_operator', 'SET') THEN
    RAISE EXCEPTION 'REL002_010_UNEXPECTED_SET_ROLE_AUTHORITY';
  END IF;
  IF (
      SELECT count(*)
      FROM pg_catalog.pg_auth_members memberships
      JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = memberships.roleid
      JOIN pg_catalog.pg_roles member_role ON member_role.oid = memberships.member
      JOIN pg_catalog.pg_roles grantor_role ON grantor_role.oid = memberships.grantor
      WHERE granted_role.rolname IN (
          'ai_mls_production_migration_operator',
          'ai_mls_production_runtime'
        )
        AND member_role.rolname = 'postgres'
        AND grantor_role.rolname = 'supabase_admin'
        AND memberships.admin_option
        AND NOT memberships.inherit_option
        AND NOT memberships.set_option
    ) <> 2
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_auth_members memberships
      JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = memberships.roleid
      JOIN pg_catalog.pg_roles member_role ON member_role.oid = memberships.member
      JOIN pg_catalog.pg_roles grantor_role ON grantor_role.oid = memberships.grantor
      WHERE granted_role.rolname IN (
          'ai_mls_production_migration_operator',
          'ai_mls_production_runtime'
        )
        AND (
          member_role.rolname <> 'postgres'
          OR grantor_role.rolname <> 'supabase_admin'
          OR NOT memberships.admin_option
          OR memberships.inherit_option
          OR memberships.set_option
        )
    ) THEN
    RAISE EXCEPTION 'REL002_010_ORIGINAL_MEMBERSHIP_MISMATCH';
  END IF;
  IF NOT pg_catalog.has_database_privilege('ai_mls_production_runtime', 'postgres', 'CONNECT')
    OR pg_catalog.has_database_privilege('ai_mls_production_runtime', 'postgres', 'CREATE')
    OR NOT pg_catalog.has_database_privilege('ai_mls_production_runtime', 'postgres', 'TEMPORARY') THEN
    RAISE EXCEPTION 'REL002_010_DATABASE_BOUNDARY_MISMATCH';
  END IF;
  IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_database databases
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(databases.datacl, pg_catalog.acldefault('d', databases.datdba))
      ) privileges
      JOIN pg_catalog.pg_roles roles ON roles.oid = privileges.grantee
      WHERE databases.datname = 'postgres'
        AND roles.rolname = 'ai_mls_production_runtime'
        AND privileges.privilege_type = 'CONNECT'
        AND NOT privileges.is_grantable
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_database databases
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(databases.datacl, pg_catalog.acldefault('d', databases.datdba))
      ) privileges
      JOIN pg_catalog.pg_roles roles ON roles.oid = privileges.grantee
      WHERE databases.datname = 'postgres'
        AND roles.rolname = 'ai_mls_production_runtime'
        AND (privileges.privilege_type <> 'CONNECT' OR privileges.is_grantable)
    ) THEN
    RAISE EXCEPTION 'REL002_010_DIRECT_DATABASE_ACL_MISMATCH';
  END IF;
  IF pg_catalog.has_schema_privilege('ai_mls_production_runtime', schema_oid, 'USAGE')
    OR pg_catalog.has_schema_privilege('ai_mls_production_runtime', schema_oid, 'CREATE') THEN
    RAISE EXCEPTION 'REL002_010_EXPECTED_MISSING_SCHEMA_USAGE';
  END IF;
  IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_namespace namespaces
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(namespaces.nspacl, pg_catalog.acldefault('n', namespaces.nspowner))
      ) privileges
      JOIN pg_catalog.pg_roles roles ON roles.oid = privileges.grantee
      WHERE namespaces.nspname = 'app_identity'
        AND roles.rolname = 'ai_mls_production_runtime'
    ) THEN
    RAISE EXCEPTION 'REL002_010_DIRECT_SCHEMA_PARTIAL_STATE_MISMATCH';
  END IF;
  FOREACH table_name IN ARRAY ARRAY[
    'identity_schema_contracts',
    'identity_schema_migrations',
    'identity_registered_service_workloads',
    'identity_sessions',
    'identity_session_revocations'
  ] LOOP
    SELECT objects.oid INTO STRICT object_oid
    FROM pg_catalog.pg_class objects
    WHERE objects.relnamespace = schema_oid
      AND objects.relname = table_name;
    IF pg_catalog.has_table_privilege('ai_mls_production_runtime', object_oid, 'SELECT')
      OR pg_catalog.has_table_privilege('ai_mls_production_runtime', object_oid, 'INSERT')
      OR pg_catalog.has_table_privilege('ai_mls_production_runtime', object_oid, 'UPDATE')
      OR pg_catalog.has_table_privilege('ai_mls_production_runtime', object_oid, 'DELETE')
      OR pg_catalog.has_table_privilege('ai_mls_production_runtime', object_oid, 'TRUNCATE')
      OR pg_catalog.has_table_privilege('ai_mls_production_runtime', object_oid, 'REFERENCES')
      OR pg_catalog.has_table_privilege('ai_mls_production_runtime', object_oid, 'TRIGGER') THEN
      RAISE EXCEPTION 'REL002_010_EXPECTED_MISSING_ORIGINAL_TABLE_GRANTS';
    END IF;
  END LOOP;
  SELECT objects.oid INTO STRICT object_oid
  FROM pg_catalog.pg_class objects
  WHERE objects.relnamespace = schema_oid
    AND objects.relname = 'identity_historical_migration_attestations';
  IF NOT pg_catalog.has_table_privilege(
      'ai_mls_production_runtime', object_oid, 'SELECT'
    ) OR pg_catalog.has_table_privilege(
      'ai_mls_production_runtime', object_oid, 'INSERT'
    ) OR pg_catalog.has_table_privilege(
      'ai_mls_production_runtime', object_oid, 'UPDATE'
    ) OR pg_catalog.has_table_privilege(
      'ai_mls_production_runtime', object_oid, 'DELETE'
    ) OR pg_catalog.has_table_privilege(
      'ai_mls_production_runtime', object_oid, 'TRUNCATE'
    ) OR pg_catalog.has_table_privilege(
      'ai_mls_production_runtime', object_oid, 'REFERENCES'
    ) OR pg_catalog.has_table_privilege(
      'ai_mls_production_runtime', object_oid, 'TRIGGER'
    ) THEN
    RAISE EXCEPTION 'REL002_010_HISTORICAL_TABLE_PARTIAL_STATE_MISMATCH';
  END IF;
  IF NOT pg_catalog.has_function_privilege(
      'ai_mls_production_runtime', (
        SELECT procedures.oid
        FROM pg_catalog.pg_proc procedures
        WHERE procedures.pronamespace = schema_oid
          AND procedures.proname = 'identity_historical_attestation_schema_is_exact'
          AND procedures.pronargs = 0
      ), 'EXECUTE'
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc procedures
      JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = procedures.pronamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(procedures.proacl, pg_catalog.acldefault('f', procedures.proowner))
      ) privileges
      WHERE namespaces.nspname = 'app_identity'
        AND procedures.proname = 'identity_historical_attestation_schema_is_exact'
        AND procedures.pronargs = 0
        AND privileges.grantee = 0
        AND privileges.privilege_type = 'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'REL002_010_HISTORICAL_VERIFIER_PARTIAL_STATE_MISMATCH';
  END IF;
  IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc procedures
      JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = procedures.pronamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(procedures.proacl, pg_catalog.acldefault('f', procedures.proowner))
      ) privileges
      WHERE namespaces.nspname = 'app_identity'
        AND procedures.proname = 'reject_historical_migration_attestation_mutation'
        AND procedures.pronargs = 0
        AND privileges.grantee = 0
        AND privileges.privilege_type = 'EXECUTE'
    ) OR NOT pg_catalog.has_function_privilege(
      'ai_mls_production_runtime', (
        SELECT procedures.oid
        FROM pg_catalog.pg_proc procedures
        WHERE procedures.pronamespace = schema_oid
          AND procedures.proname = 'reject_historical_migration_attestation_mutation'
          AND procedures.pronargs = 0
      ), 'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'REL002_010_MUTATION_FUNCTION_PARTIAL_STATE_MISMATCH';
  END IF;
  IF EXISTS (
      WITH actual AS (
        SELECT objects.relname::text AS object_name,
          COALESCE(roles.rolname::text, 'PUBLIC') AS role_name,
          privileges.privilege_type,
          privileges.is_grantable
        FROM pg_catalog.pg_class objects
        JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = objects.relnamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(objects.relacl, pg_catalog.acldefault('r', objects.relowner))
        ) privileges
        LEFT JOIN pg_catalog.pg_roles roles ON roles.oid = privileges.grantee
        WHERE namespaces.nspname = 'app_identity'
          AND objects.relkind IN ('r', 'p')
          AND (roles.rolname = 'ai_mls_production_runtime' OR privileges.grantee = 0)
      ), expected(object_name, role_name, privilege_type, is_grantable) AS (VALUES
        ('identity_historical_migration_attestations', 'ai_mls_production_runtime', 'SELECT', false)
      )
      (SELECT * FROM actual EXCEPT SELECT * FROM expected)
      UNION ALL
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    ) THEN
    RAISE EXCEPTION 'REL002_010_DIRECT_TABLE_PARTIAL_STATE_MISMATCH';
  END IF;
  IF EXISTS (
      WITH actual AS (
        SELECT procedures.proname::text AS function_name,
          COALESCE(roles.rolname::text, 'PUBLIC') AS role_name,
          privileges.privilege_type,
          privileges.is_grantable
        FROM pg_catalog.pg_proc procedures
        JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = procedures.pronamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(procedures.proacl, pg_catalog.acldefault('f', procedures.proowner))
        ) privileges
        LEFT JOIN pg_catalog.pg_roles roles ON roles.oid = privileges.grantee
        WHERE namespaces.nspname = 'app_identity'
          AND procedures.proname IN (
            'identity_historical_attestation_schema_is_exact',
            'reject_historical_migration_attestation_mutation'
          )
          AND procedures.pronargs = 0
          AND (roles.rolname = 'ai_mls_production_runtime' OR privileges.grantee = 0)
      ), expected(function_name, role_name, privilege_type, is_grantable) AS (VALUES
        ('identity_historical_attestation_schema_is_exact', 'ai_mls_production_runtime', 'EXECUTE', false),
        ('reject_historical_migration_attestation_mutation', 'PUBLIC', 'EXECUTE', false)
      )
      (SELECT * FROM actual EXCEPT SELECT * FROM expected)
      UNION ALL
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    ) THEN
    RAISE EXCEPTION 'REL002_010_DIRECT_FUNCTION_PARTIAL_STATE_MISMATCH';
  END IF;
  IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_auth_members memberships
      JOIN pg_catalog.pg_roles member_role ON member_role.oid = memberships.member
      WHERE member_role.rolname IN (
        'ai_mls_production_runtime',
        'ai_mls_production_migration_operator'
      )
    ) THEN
    RAISE EXCEPTION 'REL002_010_UNEXPECTED_APPLICATION_ROLE_MEMBERSHIP';
  END IF;
  IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_auth_members memberships
      JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = memberships.roleid
      JOIN pg_catalog.pg_roles member_role ON member_role.oid = memberships.member
      JOIN pg_catalog.pg_roles grantor_role ON grantor_role.oid = memberships.grantor
      WHERE granted_role.rolname = 'ai_mls_production_migration_operator'
        AND member_role.rolname = 'postgres'
        AND grantor_role.rolname = 'postgres'
    ) THEN
    RAISE EXCEPTION 'REL002_010_PREEXISTING_TEMPORARY_MEMBERSHIP';
  END IF;
END;
$$;

-- FAILURE_INJECTION_BEFORE_TEMPORARY_GRANT

GRANT ai_mls_production_migration_operator TO postgres WITH SET TRUE;

-- FAILURE_INJECTION_AFTER_TEMPORARY_GRANT

DO $$
BEGIN
  IF NOT pg_catalog.pg_has_role(
      'postgres',
      'ai_mls_production_migration_operator',
      'SET'
    ) OR (
      SELECT count(*)
      FROM pg_catalog.pg_auth_members memberships
      JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = memberships.roleid
      JOIN pg_catalog.pg_roles member_role ON member_role.oid = memberships.member
      JOIN pg_catalog.pg_roles grantor_role ON grantor_role.oid = memberships.grantor
      WHERE granted_role.rolname = 'ai_mls_production_migration_operator'
        AND member_role.rolname = 'postgres'
        AND (
          (
            grantor_role.rolname = 'supabase_admin'
            AND memberships.admin_option
            AND NOT memberships.inherit_option
            AND NOT memberships.set_option
          )
          OR (
            grantor_role.rolname = 'postgres'
            AND NOT memberships.admin_option
            AND NOT memberships.inherit_option
            AND memberships.set_option
          )
        )
    ) <> 2 THEN
    RAISE EXCEPTION 'REL002_010_TEMPORARY_SET_AUTHORITY_MISMATCH';
  END IF;
END;
$$;

SET LOCAL ROLE ai_mls_production_migration_operator;

-- FAILURE_INJECTION_AFTER_SET_ROLE

DO $$
BEGIN
  IF current_user <> 'ai_mls_production_migration_operator'
    OR session_user <> 'postgres'
    OR (SELECT pg_catalog.pg_get_userbyid(nspowner) FROM pg_catalog.pg_namespace WHERE nspname = 'app_identity') <> current_user THEN
    RAISE EXCEPTION 'REL002_010_OBJECT_OWNER_AUTHORITY_MISMATCH';
  END IF;
  IF app_identity.identity_historical_attestation_schema_is_exact() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'REL002_010_SCHEMA_CONTRACT_MISMATCH';
  END IF;
END;
$$;

REVOKE ALL ON SCHEMA app_identity FROM ai_mls_production_runtime;
GRANT USAGE ON SCHEMA app_identity TO ai_mls_production_runtime;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA app_identity
FROM ai_mls_production_runtime;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app_identity
FROM ai_mls_production_runtime;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app_identity
FROM ai_mls_production_runtime;

-- FAILURE_INJECTION_DURING_ACL_MUTATION

GRANT SELECT ON TABLE
  app_identity.identity_schema_contracts,
  app_identity.identity_schema_migrations,
  app_identity.identity_registered_service_workloads
TO ai_mls_production_runtime;

GRANT SELECT, INSERT, UPDATE ON TABLE app_identity.identity_sessions
TO ai_mls_production_runtime;

GRANT INSERT ON TABLE app_identity.identity_session_revocations
TO ai_mls_production_runtime;

GRANT SELECT ON TABLE app_identity.identity_historical_migration_attestations
TO ai_mls_production_runtime;

REVOKE EXECUTE ON FUNCTION app_identity.identity_historical_attestation_schema_is_exact()
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_identity.identity_historical_attestation_schema_is_exact()
TO ai_mls_production_runtime;

REVOKE EXECUTE ON FUNCTION app_identity.reject_historical_migration_attestation_mutation()
FROM PUBLIC;

RESET ROLE;

-- FAILURE_INJECTION_AFTER_RESET_ROLE
-- FAILURE_INJECTION_BEFORE_TEMPORARY_GRANT_CLEANUP

REVOKE ai_mls_production_migration_operator
FROM postgres
GRANTED BY postgres;

-- FAILURE_INJECTION_AFTER_TEMPORARY_GRANT_CLEANUP

DO $$
DECLARE
  expected record;
  schema_oid oid;
  object_oid oid;
BEGIN
  SELECT oid INTO STRICT schema_oid
  FROM pg_catalog.pg_namespace
  WHERE nspname = 'app_identity';
  IF session_user <> 'postgres' OR current_user <> session_user THEN
    RAISE EXCEPTION 'REL002_010_RESET_ROLE_FAILED';
  END IF;
  IF NOT pg_catalog.has_database_privilege('ai_mls_production_runtime', 'postgres', 'CONNECT')
    OR pg_catalog.has_database_privilege('ai_mls_production_runtime', 'postgres', 'CREATE')
    OR NOT pg_catalog.has_database_privilege('ai_mls_production_runtime', 'postgres', 'TEMPORARY')
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_database databases
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(databases.datacl, pg_catalog.acldefault('d', databases.datdba))
      ) privileges
      JOIN pg_catalog.pg_roles roles ON roles.oid = privileges.grantee
      WHERE databases.datname = 'postgres'
        AND roles.rolname = 'ai_mls_production_runtime'
        AND privileges.privilege_type = 'CONNECT'
        AND NOT privileges.is_grantable
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_database databases
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(databases.datacl, pg_catalog.acldefault('d', databases.datdba))
      ) privileges
      JOIN pg_catalog.pg_roles roles ON roles.oid = privileges.grantee
      WHERE databases.datname = 'postgres'
        AND roles.rolname = 'ai_mls_production_runtime'
        AND (privileges.privilege_type <> 'CONNECT' OR privileges.is_grantable)
    ) THEN
    RAISE EXCEPTION 'REL002_010_FINAL_DATABASE_BOUNDARY_MISMATCH';
  END IF;
  IF NOT pg_catalog.has_schema_privilege('ai_mls_production_runtime', schema_oid, 'USAGE')
    OR pg_catalog.has_schema_privilege('ai_mls_production_runtime', schema_oid, 'CREATE') THEN
    RAISE EXCEPTION 'REL002_010_FINAL_SCHEMA_BOUNDARY_MISMATCH';
  END IF;
  IF EXISTS (
      WITH actual AS (
        SELECT privileges.privilege_type, privileges.is_grantable
        FROM pg_catalog.pg_namespace namespaces
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(namespaces.nspacl, pg_catalog.acldefault('n', namespaces.nspowner))
        ) privileges
        JOIN pg_catalog.pg_roles roles ON roles.oid = privileges.grantee
        WHERE namespaces.nspname = 'app_identity'
          AND roles.rolname = 'ai_mls_production_runtime'
      ), expected(privilege_type, is_grantable) AS (VALUES ('USAGE', false))
      (SELECT * FROM actual EXCEPT SELECT * FROM expected)
      UNION ALL
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    ) THEN
    RAISE EXCEPTION 'REL002_010_FINAL_DIRECT_SCHEMA_ACL_MISMATCH';
  END IF;
  FOR expected IN
    SELECT * FROM (VALUES
      ('identity_schema_contracts', true, false, false),
      ('identity_schema_migrations', true, false, false),
      ('identity_registered_service_workloads', true, false, false),
      ('identity_sessions', true, true, true),
      ('identity_session_revocations', false, true, false),
      ('identity_historical_migration_attestations', true, false, false)
    ) AS values_table(table_name, can_select, can_insert, can_update)
  LOOP
    SELECT objects.oid INTO STRICT object_oid
    FROM pg_catalog.pg_class objects
    WHERE objects.relnamespace = schema_oid
      AND objects.relname = expected.table_name;
    IF pg_catalog.has_table_privilege(
        'ai_mls_production_runtime', object_oid, 'SELECT'
      ) <> expected.can_select
      OR pg_catalog.has_table_privilege(
        'ai_mls_production_runtime', object_oid, 'INSERT'
      ) <> expected.can_insert
      OR pg_catalog.has_table_privilege(
        'ai_mls_production_runtime', object_oid, 'UPDATE'
      ) <> expected.can_update
      OR pg_catalog.has_table_privilege(
        'ai_mls_production_runtime', object_oid, 'DELETE'
      )
      OR pg_catalog.has_table_privilege(
        'ai_mls_production_runtime', object_oid, 'TRUNCATE'
      )
      OR pg_catalog.has_table_privilege(
        'ai_mls_production_runtime', object_oid, 'REFERENCES'
      )
      OR pg_catalog.has_table_privilege(
        'ai_mls_production_runtime', object_oid, 'TRIGGER'
      ) THEN
      RAISE EXCEPTION 'REL002_010_FINAL_TABLE_BOUNDARY_MISMATCH';
    END IF;
  END LOOP;
  IF EXISTS (
      WITH actual AS (
        SELECT objects.relname::text AS object_name,
          COALESCE(roles.rolname::text, 'PUBLIC') AS role_name,
          privileges.privilege_type,
          privileges.is_grantable
        FROM pg_catalog.pg_class objects
        JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = objects.relnamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(objects.relacl, pg_catalog.acldefault('r', objects.relowner))
        ) privileges
        LEFT JOIN pg_catalog.pg_roles roles ON roles.oid = privileges.grantee
        WHERE namespaces.nspname = 'app_identity'
          AND objects.relkind IN ('r', 'p')
          AND (roles.rolname = 'ai_mls_production_runtime' OR privileges.grantee = 0)
      ), expected(object_name, role_name, privilege_type, is_grantable) AS (VALUES
        ('identity_schema_contracts', 'ai_mls_production_runtime', 'SELECT', false),
        ('identity_schema_migrations', 'ai_mls_production_runtime', 'SELECT', false),
        ('identity_registered_service_workloads', 'ai_mls_production_runtime', 'SELECT', false),
        ('identity_sessions', 'ai_mls_production_runtime', 'SELECT', false),
        ('identity_sessions', 'ai_mls_production_runtime', 'INSERT', false),
        ('identity_sessions', 'ai_mls_production_runtime', 'UPDATE', false),
        ('identity_session_revocations', 'ai_mls_production_runtime', 'INSERT', false),
        ('identity_historical_migration_attestations', 'ai_mls_production_runtime', 'SELECT', false)
      )
      (SELECT * FROM actual EXCEPT SELECT * FROM expected)
      UNION ALL
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    ) THEN
    RAISE EXCEPTION 'REL002_010_FINAL_DIRECT_TABLE_ACL_MISMATCH';
  END IF;
  IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class objects
      JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = objects.relnamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(objects.relacl, pg_catalog.acldefault('r', objects.relowner))
      ) privileges
      JOIN pg_catalog.pg_roles roles ON roles.oid = privileges.grantee
      WHERE namespaces.nspname = 'app_identity'
        AND objects.relkind = 'S'
        AND roles.rolname = 'ai_mls_production_runtime'
    ) THEN
    RAISE EXCEPTION 'REL002_010_FINAL_SEQUENCE_ACL_MISMATCH';
  END IF;
  IF NOT pg_catalog.has_function_privilege(
      'ai_mls_production_runtime', (
        SELECT procedures.oid
        FROM pg_catalog.pg_proc procedures
        WHERE procedures.pronamespace = schema_oid
          AND procedures.proname = 'identity_historical_attestation_schema_is_exact'
          AND procedures.pronargs = 0
      ), 'EXECUTE'
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc procedures
      JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = procedures.pronamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(procedures.proacl, pg_catalog.acldefault('f', procedures.proowner))
      ) privileges
      WHERE namespaces.nspname = 'app_identity'
        AND procedures.proname = 'identity_historical_attestation_schema_is_exact'
        AND procedures.pronargs = 0
        AND privileges.grantee = 0
        AND privileges.privilege_type = 'EXECUTE'
    ) OR pg_catalog.has_function_privilege(
      'ai_mls_production_runtime', (
        SELECT procedures.oid
        FROM pg_catalog.pg_proc procedures
        WHERE procedures.pronamespace = schema_oid
          AND procedures.proname = 'reject_historical_migration_attestation_mutation'
          AND procedures.pronargs = 0
      ), 'EXECUTE'
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc procedures
      JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = procedures.pronamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(procedures.proacl, pg_catalog.acldefault('f', procedures.proowner))
      ) privileges
      WHERE namespaces.nspname = 'app_identity'
        AND procedures.proname = 'reject_historical_migration_attestation_mutation'
        AND procedures.pronargs = 0
        AND privileges.grantee = 0
        AND privileges.privilege_type = 'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'REL002_010_FINAL_FUNCTION_BOUNDARY_MISMATCH';
  END IF;
  IF EXISTS (
      WITH actual AS (
        SELECT procedures.proname::text AS function_name,
          COALESCE(roles.rolname::text, 'PUBLIC') AS role_name,
          privileges.privilege_type,
          privileges.is_grantable
        FROM pg_catalog.pg_proc procedures
        JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = procedures.pronamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(procedures.proacl, pg_catalog.acldefault('f', procedures.proowner))
        ) privileges
        LEFT JOIN pg_catalog.pg_roles roles ON roles.oid = privileges.grantee
        WHERE namespaces.nspname = 'app_identity'
          AND procedures.proname IN (
            'identity_historical_attestation_schema_is_exact',
            'reject_historical_migration_attestation_mutation'
          )
          AND procedures.pronargs = 0
          AND (roles.rolname = 'ai_mls_production_runtime' OR privileges.grantee = 0)
      ), expected(function_name, role_name, privilege_type, is_grantable) AS (VALUES
        ('identity_historical_attestation_schema_is_exact', 'ai_mls_production_runtime', 'EXECUTE', false)
      )
      (SELECT * FROM actual EXCEPT SELECT * FROM expected)
      UNION ALL
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    ) THEN
    RAISE EXCEPTION 'REL002_010_FINAL_DIRECT_FUNCTION_ACL_MISMATCH';
  END IF;
  IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_auth_members memberships
      JOIN pg_catalog.pg_roles member_role ON member_role.oid = memberships.member
      WHERE member_role.rolname IN (
        'ai_mls_production_runtime',
        'ai_mls_production_migration_operator'
      )
    ) THEN
    RAISE EXCEPTION 'REL002_010_FINAL_APPLICATION_ROLE_MEMBERSHIP_MISMATCH';
  END IF;
  IF (
      SELECT count(*)
      FROM pg_catalog.pg_auth_members memberships
      JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = memberships.roleid
      JOIN pg_catalog.pg_roles member_role ON member_role.oid = memberships.member
      JOIN pg_catalog.pg_roles grantor_role ON grantor_role.oid = memberships.grantor
      WHERE granted_role.rolname IN (
          'ai_mls_production_migration_operator',
          'ai_mls_production_runtime'
        )
        AND member_role.rolname = 'postgres'
        AND grantor_role.rolname = 'supabase_admin'
        AND memberships.admin_option
        AND NOT memberships.inherit_option
        AND NOT memberships.set_option
    ) <> 2
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_auth_members memberships
      JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = memberships.roleid
      JOIN pg_catalog.pg_roles member_role ON member_role.oid = memberships.member
      JOIN pg_catalog.pg_roles grantor_role ON grantor_role.oid = memberships.grantor
      WHERE granted_role.rolname IN (
          'ai_mls_production_migration_operator',
          'ai_mls_production_runtime'
        )
        AND (
          member_role.rolname <> 'postgres'
          OR grantor_role.rolname <> 'supabase_admin'
          OR NOT memberships.admin_option
          OR memberships.inherit_option
          OR memberships.set_option
        )
    ) OR pg_catalog.pg_has_role(
      'postgres',
      'ai_mls_production_migration_operator',
      'SET'
    ) THEN
    RAISE EXCEPTION 'REL002_010_FINAL_MEMBERSHIP_MISMATCH';
  END IF;
END;
$$;

COMMIT;
