-- REL-002 R3-C2C: explicit Identity-owned authorization team; no historical backfill.
BEGIN;
DO $$ BEGIN
 IF current_user<>'ai_mls_production_migration_operator' THEN RAISE EXCEPTION 'C2C_MIGRATION_OPERATOR_REQUIRED'; END IF;
END $$;
ALTER TABLE app_identity.workload_startup_binding_versions ADD COLUMN authorization_team_id text
 CHECK (authorization_team_id IS NULL OR (length(authorization_team_id) BETWEEN 1 AND 512 AND authorization_team_id=btrim(authorization_team_id) AND authorization_team_id !~ '[[:cntrl:]]'));
CREATE FUNCTION app_identity.workload_startup_binding_versions_authorization_team_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF (TG_OP='INSERT' OR (NEW.status='ACTIVE' AND OLD.status IS DISTINCT FROM NEW.status)) AND NEW.authorization_team_id IS NULL THEN RAISE EXCEPTION 'C2C_EXPLICIT_TEAM_REQUIRED' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND NEW.authorization_team_id IS DISTINCT FROM OLD.authorization_team_id THEN RAISE EXCEPTION 'C2C_TEAM_IMMUTABLE' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER workload_startup_binding_versions_authorization_team_guard BEFORE INSERT OR UPDATE ON app_identity.workload_startup_binding_versions FOR EACH ROW EXECUTE FUNCTION app_identity.workload_startup_binding_versions_authorization_team_guard();
REVOKE ALL ON FUNCTION app_identity.workload_startup_binding_versions_authorization_team_guard() FROM PUBLIC,ai_mls_production_runtime;
COMMIT;