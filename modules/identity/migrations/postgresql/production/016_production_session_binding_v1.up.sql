-- R3-C3B3 AO-approved binding fields only; no historical inference/backfill.
BEGIN;
DO $$ BEGIN
  IF current_user<>'ai_mls_production_migration_operator' THEN RAISE EXCEPTION 'B3_MIGRATION_OPERATOR_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app_identity' AND c.relname='identity_sessions' AND pg_get_userbyid(c.relowner)=current_user) THEN RAISE EXCEPTION 'B3_SESSION_OWNER_REQUIRED'; END IF;
END $$;
ALTER TABLE app_identity.identity_sessions ADD COLUMN tenant_id text, ADD COLUMN team_id text, ADD COLUMN team_binding_origin text;
ALTER TABLE app_identity.identity_sessions ADD CONSTRAINT identity_sessions_production_binding_check CHECK (
  (tenant_id IS NULL AND team_id IS NULL AND team_binding_origin IS NULL AND NOT payload_json ? 'tenantId' AND NOT payload_json ? 'teamBindingOrigin')
  OR coalesce(tenant_id IS NOT NULL AND team_id IS NOT NULL AND team_binding_origin='EXPLICIT_TEAM_SELECTION_VALIDATED'
    AND length(tenant_id) BETWEEN 1 AND 512 AND tenant_id=btrim(tenant_id) AND tenant_id !~ '[[:cntrl:]]'
    AND length(team_id) BETWEEN 1 AND 512 AND team_id=btrim(team_id) AND team_id !~ '[[:cntrl:]]'
    AND payload_json->>'principalType'='HUMAN' AND payload_json->>'tenantId'=tenant_id AND payload_json->>'teamId'=team_id
    AND payload_json->>'tenantBindingOrigin'='AUTHENTICATED_PRINCIPAL_TENANT'
    AND payload_json->>'teamBindingOrigin'=team_binding_origin,false)
);
CREATE FUNCTION app_identity.identity_sessions_production_binding_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.team_id IS DISTINCT FROM OLD.team_id
    OR NEW.team_binding_origin IS DISTINCT FROM OLD.team_binding_origin
    OR NEW.payload_json->'tenantId' IS DISTINCT FROM OLD.payload_json->'tenantId'
    OR NEW.payload_json->'teamId' IS DISTINCT FROM OLD.payload_json->'teamId'
    OR NEW.payload_json->'tenantBindingOrigin' IS DISTINCT FROM OLD.payload_json->'tenantBindingOrigin'
    OR NEW.payload_json->'teamBindingOrigin' IS DISTINCT FROM OLD.payload_json->'teamBindingOrigin' THEN
    RAISE EXCEPTION 'B3_SESSION_BINDING_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER identity_sessions_production_binding_guard BEFORE UPDATE ON app_identity.identity_sessions FOR EACH ROW EXECUTE FUNCTION app_identity.identity_sessions_production_binding_guard();
REVOKE ALL ON FUNCTION app_identity.identity_sessions_production_binding_guard() FROM PUBLIC,ai_mls_production_runtime;
COMMIT;
