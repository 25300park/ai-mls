-- REL-002 R3-C1; forward only, no backfill or runtime execution.
BEGIN;
DO $$ BEGIN
  IF current_user<>'ai_mls_production_migration_operator' THEN RAISE EXCEPTION 'R3C1_MIGRATION_OPERATOR_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='app_administration' AND pg_get_userbyid(nspowner)='ai_mls_production_migration_operator') THEN RAISE EXCEPTION 'R3C1_PARENT_SCHEMA_NOT_READY'; END IF;
END $$;

CREATE TABLE app_administration.project_governance_versions (
  project_id text NOT NULL CHECK (length(project_id) BETWEEN 1 AND 512 AND project_id=btrim(project_id) AND project_id !~ '[[:cntrl:]]'),
  project_version bigint NOT NULL CHECK (project_version BETWEEN 1 AND 9007199254740991),
  organization_id text NOT NULL CHECK (length(organization_id) BETWEEN 1 AND 512 AND organization_id=btrim(organization_id) AND organization_id !~ '[[:cntrl:]]'),
  tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 512 AND tenant_id=btrim(tenant_id) AND tenant_id !~ '[[:cntrl:]]'),
  status text NOT NULL CHECK (status IN ('PROPOSED','ACTIVE','SUSPENDED','RETIRED')),
  contained_scopes jsonb NOT NULL CHECK (jsonb_typeof(contained_scopes)='array' AND jsonb_array_length(contained_scopes) BETWEEN 1 AND 256),
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references)='array' AND jsonb_array_length(evidence_references) BETWEEN 1 AND 256),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL CHECK (updated_at>=created_at),
  PRIMARY KEY (project_id,project_version)
);
CREATE UNIQUE INDEX project_governance_versions_one_active ON app_administration.project_governance_versions (project_id) WHERE status='ACTIVE';

CREATE FUNCTION app_administration.project_governance_versions_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE item jsonb;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'R3C1_DELETE_FORBIDDEN' USING ERRCODE='55000'; END IF;
  IF TG_OP='INSERT' AND NEW.status<>'PROPOSED' THEN RAISE EXCEPTION 'R3C1_INITIAL_STATE_INVALID' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updated_at']) THEN RAISE EXCEPTION 'R3C1_FROZEN_PAYLOAD' USING ERRCODE='55000'; END IF;
    IF NEW.updated_at<OLD.updated_at THEN RAISE EXCEPTION 'R3C1_TIME_REGRESSION' USING ERRCODE='23514'; END IF;
    IF NEW.status<>OLD.status AND NOT ((OLD.status='PROPOSED' AND NEW.status IN ('ACTIVE','RETIRED')) OR (OLD.status='ACTIVE' AND NEW.status IN ('SUSPENDED','RETIRED')) OR (OLD.status='SUSPENDED' AND NEW.status IN ('ACTIVE','RETIRED'))) THEN RAISE EXCEPTION 'R3C1_LIFECYCLE_INVALID' USING ERRCODE='23514'; END IF;
    IF OLD.status='RETIRED' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'R3C1_RETIRED_TERMINAL' USING ERRCODE='23514'; END IF;
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.evidence_references) LOOP
    IF jsonb_typeof(item)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(item))<>3
       OR item->>'type' NOT IN ('DECISION','APPROVAL','AUDIT','CASE') OR jsonb_typeof(item->'type')<>'string'
       OR jsonb_typeof(item->'id')<>'string' OR length(item->>'id') NOT BETWEEN 1 AND 512 OR item->>'id'<>btrim(item->>'id') OR item->>'id' ~ '[[:cntrl:]]'
       OR jsonb_typeof(item->'version')<>'number' OR (item->>'version')::numeric NOT BETWEEN 1 AND 9007199254740991 OR trunc((item->>'version')::numeric)<>(item->>'version')::numeric
       OR NOT (item ?& ARRAY['type','id','version']) THEN RAISE EXCEPTION 'R3C1_EVIDENCE_INVALID' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_array_elements(NEW.evidence_references))<>(SELECT count(DISTINCT value) FROM jsonb_array_elements(NEW.evidence_references)) THEN RAISE EXCEPTION 'R3C1_EVIDENCE_DUPLICATE' USING ERRCODE='23514'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.contained_scopes) LOOP
    IF jsonb_typeof(item)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(item))<>2
       OR item->>'scopeType' NOT IN ('TEAM','POLICY','SOURCE','TARGET') OR jsonb_typeof(item->'scopeType')<>'string'
       OR jsonb_typeof(item->'scopeId')<>'string' OR length(item->>'scopeId') NOT BETWEEN 1 AND 512 OR item->>'scopeId'<>btrim(item->>'scopeId') OR item->>'scopeId' ~ '[[:cntrl:]]'
       OR NOT (item ?& ARRAY['scopeType','scopeId']) THEN RAISE EXCEPTION 'R3C1_SCOPE_INVALID' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_array_elements(NEW.contained_scopes))<>(SELECT count(DISTINCT value) FROM jsonb_array_elements(NEW.contained_scopes)) THEN RAISE EXCEPTION 'R3C1_SCOPE_DUPLICATE' USING ERRCODE='23514'; END IF;

  RETURN NEW;
END $$;
CREATE TRIGGER project_governance_versions_guard BEFORE INSERT OR UPDATE OR DELETE ON app_administration.project_governance_versions FOR EACH ROW EXECUTE FUNCTION app_administration.project_governance_versions_guard();
REVOKE ALL ON FUNCTION app_administration.project_governance_versions_guard() FROM PUBLIC,ai_mls_production_runtime;
REVOKE ALL ON TABLE app_administration.project_governance_versions FROM PUBLIC,ai_mls_production_runtime;
GRANT USAGE ON SCHEMA app_administration TO ai_mls_production_runtime;
GRANT SELECT,INSERT ON TABLE app_administration.project_governance_versions TO ai_mls_production_runtime;
GRANT UPDATE (status,updated_at) ON TABLE app_administration.project_governance_versions TO ai_mls_production_runtime;
COMMENT ON TABLE app_administration.project_governance_versions IS 'REL002-R3C1-V1|administration|frozen-versioned-row';
COMMIT;
