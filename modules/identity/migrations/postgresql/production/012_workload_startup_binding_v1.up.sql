-- REL-002 R3-C1; forward only, no backfill or runtime execution.
BEGIN;
DO $$ BEGIN
  IF current_user<>'ai_mls_production_migration_operator' THEN RAISE EXCEPTION 'R3C1_MIGRATION_OPERATOR_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='app_identity' AND pg_get_userbyid(nspowner)='ai_mls_production_migration_operator') THEN RAISE EXCEPTION 'R3C1_PARENT_SCHEMA_NOT_READY'; END IF;
END $$;

CREATE TABLE app_identity.workload_startup_binding_versions (
  binding_id text NOT NULL CHECK (length(binding_id) BETWEEN 1 AND 512 AND binding_id=btrim(binding_id) AND binding_id !~ '[[:cntrl:]]'),
  binding_version bigint NOT NULL CHECK (binding_version BETWEEN 1 AND 9007199254740991),
  registration_id text NOT NULL CHECK (length(registration_id) BETWEEN 1 AND 512 AND registration_id=btrim(registration_id) AND registration_id !~ '[[:cntrl:]]'),
  registration_version bigint NOT NULL CHECK (registration_version BETWEEN 1 AND 9007199254740991),
  tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 512 AND tenant_id=btrim(tenant_id) AND tenant_id !~ '[[:cntrl:]]'),
  principal_id text NOT NULL CHECK (length(principal_id) BETWEEN 1 AND 512 AND principal_id=btrim(principal_id) AND principal_id !~ '[[:cntrl:]]'),
  organization_id text NOT NULL CHECK (length(organization_id) BETWEEN 1 AND 512 AND organization_id=btrim(organization_id) AND organization_id !~ '[[:cntrl:]]'),
  project_id text NOT NULL CHECK (length(project_id) BETWEEN 1 AND 512 AND project_id=btrim(project_id) AND project_id !~ '[[:cntrl:]]'),
  scope_type text NOT NULL CHECK (scope_type IN ('TEAM','POLICY','SOURCE','TARGET')),
  scope_id text NOT NULL CHECK (length(scope_id) BETWEEN 1 AND 512 AND scope_id=btrim(scope_id) AND scope_id !~ '[[:cntrl:]]'),
  identity_evidence_ref text NOT NULL CHECK (length(identity_evidence_ref) BETWEEN 1 AND 512 AND identity_evidence_ref=btrim(identity_evidence_ref) AND identity_evidence_ref !~ '[[:cntrl:]]'),
  organization_evidence_ref text NOT NULL CHECK (length(organization_evidence_ref) BETWEEN 1 AND 512 AND organization_evidence_ref=btrim(organization_evidence_ref) AND organization_evidence_ref !~ '[[:cntrl:]]'),
  project_evidence_ref text NOT NULL CHECK (length(project_evidence_ref) BETWEEN 1 AND 512 AND project_evidence_ref=btrim(project_evidence_ref) AND project_evidence_ref !~ '[[:cntrl:]]'),
  scope_evidence_ref text NOT NULL CHECK (length(scope_evidence_ref) BETWEEN 1 AND 512 AND scope_evidence_ref=btrim(scope_evidence_ref) AND scope_evidence_ref !~ '[[:cntrl:]]'),
  status text NOT NULL CHECK (status IN ('PROPOSED','ACTIVE','REVOKED')),
  audit_evidence_ref text NOT NULL CHECK (length(audit_evidence_ref) BETWEEN 1 AND 512 AND audit_evidence_ref=btrim(audit_evidence_ref) AND audit_evidence_ref !~ '[[:cntrl:]]'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL CHECK (updated_at>=created_at),
  PRIMARY KEY (binding_id,binding_version),
  FOREIGN KEY (registration_id) REFERENCES app_identity.identity_registered_service_workloads(registration_id) ON UPDATE NO ACTION ON DELETE NO ACTION NOT DEFERRABLE
);
CREATE UNIQUE INDEX workload_startup_binding_versions_one_active ON app_identity.workload_startup_binding_versions (binding_id) WHERE status='ACTIVE';
CREATE UNIQUE INDEX workload_startup_binding_versions_registration_active ON app_identity.workload_startup_binding_versions (registration_id,registration_version) WHERE status='ACTIVE';
CREATE FUNCTION app_identity.workload_startup_binding_versions_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE item jsonb;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'R3C1_DELETE_FORBIDDEN' USING ERRCODE='55000'; END IF;
  IF TG_OP='INSERT' AND NEW.status<>'PROPOSED' THEN RAISE EXCEPTION 'R3C1_INITIAL_STATE_INVALID' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-ARRAY['status','audit_evidence_ref','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','audit_evidence_ref','updated_at']) THEN RAISE EXCEPTION 'R3C1_FROZEN_PAYLOAD' USING ERRCODE='55000'; END IF;
    IF NEW.updated_at<OLD.updated_at THEN RAISE EXCEPTION 'R3C1_TIME_REGRESSION' USING ERRCODE='23514'; END IF;
    IF NEW.status<>OLD.status AND NOT ((OLD.status='PROPOSED' AND NEW.status IN ('ACTIVE','REVOKED')) OR (OLD.status='ACTIVE' AND NEW.status='REVOKED')) THEN RAISE EXCEPTION 'R3C1_LIFECYCLE_INVALID' USING ERRCODE='23514'; END IF;
    IF OLD.status='REVOKED' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'R3C1_REVOKED_TERMINAL' USING ERRCODE='23514'; END IF;
  END IF;


  IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND NEW.status='ACTIVE') THEN
    IF NOT EXISTS (SELECT 1 FROM app_identity.identity_registered_service_workloads p WHERE p.registration_id=NEW.registration_id AND p.registration_version=NEW.registration_version AND p.tenant_id=NEW.tenant_id AND p.principal_id=NEW.principal_id AND p.principal_type='SERVICE' AND p.assurance='WORKLOAD' AND p.environment='PRODUCTION' AND p.identity_evidence_ref=NEW.identity_evidence_ref AND (NEW.status<>'ACTIVE' OR p.status='ACTIVE')) THEN RAISE EXCEPTION 'R3C1_REGISTRATION_MISMATCH' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workload_startup_binding_versions_guard BEFORE INSERT OR UPDATE OR DELETE ON app_identity.workload_startup_binding_versions FOR EACH ROW EXECUTE FUNCTION app_identity.workload_startup_binding_versions_guard();
REVOKE ALL ON FUNCTION app_identity.workload_startup_binding_versions_guard() FROM PUBLIC,ai_mls_production_runtime;
REVOKE ALL ON TABLE app_identity.workload_startup_binding_versions FROM PUBLIC,ai_mls_production_runtime;
GRANT USAGE ON SCHEMA app_identity TO ai_mls_production_runtime;
GRANT SELECT,INSERT ON TABLE app_identity.workload_startup_binding_versions TO ai_mls_production_runtime;
GRANT UPDATE (status,audit_evidence_ref,updated_at) ON TABLE app_identity.workload_startup_binding_versions TO ai_mls_production_runtime;
COMMENT ON TABLE app_identity.workload_startup_binding_versions IS 'REL002-R3C1-V1|identity|frozen-versioned-row';
COMMIT;
