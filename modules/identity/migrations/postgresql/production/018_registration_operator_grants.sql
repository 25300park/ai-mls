-- R3-G1B: migration owner grants only; role creation and command execution separate.
BEGIN;
DO $$ DECLARE item text; BEGIN
  IF current_user <> 'ai_mls_production_migration_operator'
    OR session_user <> current_user OR current_database() <> 'postgres' THEN RAISE EXCEPTION 'REGISTRATION_GRANTOR_REQUIRED'; END IF;
  FOREACH item IN ARRAY ARRAY['app_identity','app_audit'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname=item AND pg_get_userbyid(nspowner)=current_user) THEN RAISE EXCEPTION 'REGISTRATION_SCHEMA_OWNER_REQUIRED'; END IF;
  END LOOP;
  FOREACH item IN ARRAY ARRAY['app_identity.identity_registered_service_workloads','app_identity.identity_workload_evidence','app_audit.audit_evidence_read_records'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=to_regclass(item) AND pg_get_userbyid(relowner)=current_user) THEN RAISE EXCEPTION 'REGISTRATION_TABLE_OWNER_REQUIRED'; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ai_mls_production_registration_operator' AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls) THEN RAISE EXCEPTION 'REGISTRATION_ROLE_ATTRIBUTES_REQUIRED'; END IF;
  IF EXISTS (SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='ai_mls_production_registration_operator') OR roleid=(SELECT oid FROM pg_roles WHERE rolname='ai_mls_production_registration_operator')) THEN RAISE EXCEPTION 'REGISTRATION_ROLE_MEMBERSHIP_FORBIDDEN'; END IF;
END $$;
REVOKE ALL ON SCHEMA app_identity, app_audit FROM ai_mls_production_registration_operator;
REVOKE ALL ON ALL TABLES IN SCHEMA app_identity, app_audit FROM ai_mls_production_registration_operator;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app_identity, app_audit FROM ai_mls_production_registration_operator;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_identity, app_audit FROM ai_mls_production_registration_operator;
GRANT USAGE ON SCHEMA app_identity, app_audit TO ai_mls_production_registration_operator;
GRANT SELECT, INSERT ON app_identity.identity_registered_service_workloads,
 app_identity.identity_workload_evidence, app_audit.audit_evidence_read_records
 TO ai_mls_production_registration_operator;
COMMIT;
