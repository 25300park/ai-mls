-- REL-002 R3-C2B: independent immutable Identity proof; forward-only, no seeding.
BEGIN;
DO $$ BEGIN
  IF current_user <> 'ai_mls_production_migration_operator' THEN RAISE EXCEPTION 'C2B_MIGRATION_OPERATOR_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='app_identity' AND pg_get_userbyid(nspowner)=current_user) THEN RAISE EXCEPTION 'C2B_IDENTITY_OWNER_REQUIRED'; END IF;
END $$;
CREATE TABLE app_identity.identity_workload_evidence (
  identity_evidence_ref text PRIMARY KEY,
  registration_id text NOT NULL,
  registration_version bigint NOT NULL CHECK (registration_version BETWEEN 1 AND 9007199254740991),
  tenant_id text NOT NULL,
  principal_id text NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version=1),
  immutable boolean NOT NULL CHECK (immutable)
);
CREATE FUNCTION app_identity.identity_workload_evidence_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE item text;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'C2B_IDENTITY_IMMUTABLE' USING ERRCODE='55000'; END IF;
  FOREACH item IN ARRAY ARRAY[NEW.identity_evidence_ref,NEW.registration_id,NEW.tenant_id,NEW.principal_id] LOOP
    IF length(item) NOT BETWEEN 1 AND 512 OR item<>btrim(item) OR item ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'C2B_IDENTITY_INPUT_INVALID' USING ERRCODE='23514'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER identity_workload_evidence_guard BEFORE INSERT OR UPDATE OR DELETE ON app_identity.identity_workload_evidence FOR EACH ROW EXECUTE FUNCTION app_identity.identity_workload_evidence_guard();
REVOKE ALL ON app_identity.identity_workload_evidence FROM PUBLIC,ai_mls_production_runtime;
REVOKE ALL ON FUNCTION app_identity.identity_workload_evidence_guard() FROM PUBLIC,ai_mls_production_runtime;
GRANT SELECT ON app_identity.identity_workload_evidence TO ai_mls_production_runtime;
COMMIT;
