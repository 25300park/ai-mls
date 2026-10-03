-- REL-002 R3-C3B2B. Forward-only, no credentials or inferred historical backfill.
BEGIN;
DO $$ BEGIN
  IF current_user <> 'ai_mls_production_migration_operator' THEN RAISE EXCEPTION 'B2B_MIGRATION_OPERATOR_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='app_identity' AND pg_get_userbyid(nspowner)=current_user) THEN RAISE EXCEPTION 'B2B_IDENTITY_OWNER_REQUIRED'; END IF;
END $$;
CREATE TABLE app_identity.identity_human_principals (
  principal_id text PRIMARY KEY,
  user_id text NOT NULL,
  tenant_id text NOT NULL,
  login_identifier text COLLATE "C" NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','DISABLED')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL CHECK (updated_at >= created_at),
  UNIQUE (tenant_id,login_identifier),
  CHECK (length(principal_id) BETWEEN 1 AND 512 AND principal_id=btrim(principal_id) AND principal_id !~ '[[:cntrl:]]'),
  CHECK (length(user_id) BETWEEN 1 AND 512 AND user_id=btrim(user_id) AND user_id !~ '[[:cntrl:]]'),
  CHECK (length(tenant_id) BETWEEN 1 AND 512 AND tenant_id=btrim(tenant_id) AND tenant_id !~ '[[:cntrl:]]'),
  CHECK (length(login_identifier) BETWEEN 1 AND 512 AND login_identifier !~ '^[[:space:]]|[[:space:]]$' AND login_identifier !~ '[[:cntrl:]]')
);
CREATE TABLE app_identity.identity_human_credentials (
  credential_id text NOT NULL CHECK (length(credential_id) BETWEEN 1 AND 512 AND credential_id=btrim(credential_id) AND credential_id !~ '[[:cntrl:]]'),
  principal_id text NOT NULL REFERENCES app_identity.identity_human_principals(principal_id) ON DELETE NO ACTION ON UPDATE NO ACTION NOT DEFERRABLE,
  credential_version bigint NOT NULL CHECK (credential_version BETWEEN 1 AND 9007199254740991),
  credential_type text NOT NULL CHECK (credential_type='PASSWORD'),
  algorithm text NOT NULL CHECK (algorithm='ARGON2ID'),
  algorithm_profile text NOT NULL CHECK (algorithm_profile='ARGON2ID_V1'),
  salt bytea NOT NULL CHECK (octet_length(salt)=16),
  derived_key bytea NOT NULL CHECK (octet_length(derived_key)=32),
  status text NOT NULL CHECK (status IN ('ACTIVE','REVOKED')),
  created_at timestamptz NOT NULL,
  rotated_at timestamptz CHECK (rotated_at >= created_at),
  revoked_at timestamptz CHECK (revoked_at >= created_at),
  PRIMARY KEY (credential_id,credential_version),
  CHECK ((status='ACTIVE' AND revoked_at IS NULL) OR (status='REVOKED' AND revoked_at IS NOT NULL))
);
CREATE UNIQUE INDEX identity_human_credentials_one_active ON app_identity.identity_human_credentials(principal_id) WHERE status='ACTIVE';
CREATE FUNCTION app_identity.identity_human_principals_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE principal text;
BEGIN
  -- Sorted Identity-local keys cover both identities if a future approved writer changes one.
  FOR principal IN SELECT DISTINCT id FROM unnest(CASE TG_OP WHEN 'INSERT' THEN ARRAY[NEW.principal_id] WHEN 'DELETE' THEN ARRAY[OLD.principal_id] ELSE ARRAY[OLD.principal_id,NEW.principal_id] END) id ORDER BY id LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('identity-human-credential:'||principal,0));
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER identity_human_principals_guard BEFORE INSERT OR UPDATE OR DELETE ON app_identity.identity_human_principals FOR EACH ROW EXECUTE FUNCTION app_identity.identity_human_principals_guard();
CREATE FUNCTION app_identity.identity_human_credentials_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'B2B_CREDENTIAL_IMMUTABLE' USING ERRCODE='55000'; END IF;
  IF TG_OP='UPDATE' AND (OLD.status<>'ACTIVE' OR NEW.status<>'REVOKED'
    OR (to_jsonb(NEW)-'status'-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'revoked_at')) THEN
    RAISE EXCEPTION 'B2B_CREDENTIAL_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('identity-human-credential:'||NEW.principal_id,0));
  RETURN NEW;
END $$;
CREATE TRIGGER identity_human_credentials_guard BEFORE INSERT OR UPDATE OR DELETE ON app_identity.identity_human_credentials FOR EACH ROW EXECUTE FUNCTION app_identity.identity_human_credentials_guard();
REVOKE ALL ON app_identity.identity_human_principals,app_identity.identity_human_credentials FROM PUBLIC,ai_mls_production_runtime;
REVOKE ALL ON FUNCTION app_identity.identity_human_credentials_guard() FROM PUBLIC,ai_mls_production_runtime;
REVOKE ALL ON FUNCTION app_identity.identity_human_principals_guard() FROM PUBLIC,ai_mls_production_runtime;
GRANT SELECT ON app_identity.identity_human_principals,app_identity.identity_human_credentials TO ai_mls_production_runtime;
COMMIT;
