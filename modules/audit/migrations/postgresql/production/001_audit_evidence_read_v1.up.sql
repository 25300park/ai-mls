-- REL-002 R3-C2B: Audit-owned final projection; approved runtime SELECT+INSERT only.
BEGIN;
DO $$ BEGIN
  IF current_user <> 'ai_mls_production_migration_operator' THEN RAISE EXCEPTION 'C2B_MIGRATION_OPERATOR_REQUIRED'; END IF;
END $$;
CREATE SCHEMA app_audit;
REVOKE ALL ON SCHEMA app_audit FROM PUBLIC,ai_mls_production_runtime;
GRANT USAGE ON SCHEMA app_audit TO ai_mls_production_runtime;
CREATE TABLE app_audit.audit_evidence_read_records (
  audit_evidence_ref text PRIMARY KEY,
  source_domain text NOT NULL CHECK (source_domain='IDENTITY'),
  aggregate_type text NOT NULL CHECK (aggregate_type IN ('REGISTERED_SERVICE_WORKLOAD','WORKLOAD_STARTUP_BINDING')),
  aggregate_id text NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version BETWEEN 1 AND 9007199254740991),
  event_type text NOT NULL CHECK (event_type IN ('REGISTERED_SERVICE_WORKLOAD.REGISTERED','WORKLOAD_STARTUP_BINDING.ACTIVATED','WORKLOAD_STARTUP_BINDING.REVOKED')),
  payload_schema_version integer NOT NULL CHECK (payload_schema_version=1),
  final boolean NOT NULL CHECK (final),
  tenant_id text NOT NULL,
  scope_ref text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
  occurred_at timestamptz NOT NULL CHECK (isfinite(occurred_at)),
  materialized_at timestamptz NOT NULL CHECK (isfinite(materialized_at) AND materialized_at>=occurred_at)
);
CREATE FUNCTION app_audit.audit_evidence_read_records_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE item text; fields text[]; key text; p jsonb; id_field text; version_field text;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'C2B_AUDIT_IMMUTABLE' USING ERRCODE='55000'; END IF;
  FOREACH item IN ARRAY ARRAY[NEW.audit_evidence_ref,NEW.aggregate_id,NEW.tenant_id,NEW.scope_ref] LOOP
    IF length(item) NOT BETWEEN 1 AND 512 OR item<>btrim(item) OR item ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'C2B_AUDIT_INPUT_INVALID' USING ERRCODE='23514'; END IF;
  END LOOP;
  p:=NEW.payload;
  IF NEW.aggregate_type='REGISTERED_SERVICE_WORKLOAD' AND NEW.event_type='REGISTERED_SERVICE_WORKLOAD.REGISTERED' THEN
    fields:=ARRAY['registrationId','registrationVersion','tenantId','principalId','principalType','assurance','environment'];
    id_field:='registrationId'; version_field:='registrationVersion';
    IF p->>'principalType' IS DISTINCT FROM 'SERVICE' OR p->>'assurance' IS DISTINCT FROM 'WORKLOAD' OR p->>'environment' IS DISTINCT FROM 'PRODUCTION' THEN RAISE EXCEPTION 'C2B_REGISTRATION_PROFILE_INVALID' USING ERRCODE='23514'; END IF;
  ELSIF NEW.aggregate_type='WORKLOAD_STARTUP_BINDING' AND NEW.event_type IN ('WORKLOAD_STARTUP_BINDING.ACTIVATED','WORKLOAD_STARTUP_BINDING.REVOKED') THEN
    fields:=ARRAY['bindingId','bindingVersion','registrationId','registrationVersion','tenantId','principalId','status'];
    id_field:='bindingId'; version_field:='bindingVersion';
    IF NEW.event_type='WORKLOAD_STARTUP_BINDING.ACTIVATED' THEN
      fields:=fields || ARRAY['organizationId','projectId','scopeType','scopeId'];
      IF p->>'status' IS DISTINCT FROM 'ACTIVE' OR p->>'scopeType' IS NULL OR p->>'scopeType' NOT IN ('TEAM','POLICY','SOURCE','TARGET') THEN RAISE EXCEPTION 'C2B_ACTIVATION_PROFILE_INVALID' USING ERRCODE='23514'; END IF;
    ELSE
      IF p->>'status' IS DISTINCT FROM 'REVOKED' THEN RAISE EXCEPTION 'C2B_REVOCATION_PROFILE_INVALID' USING ERRCODE='23514'; END IF;
      IF p ? 'replacementBindingId' OR p ? 'replacementBindingVersion' THEN fields:=fields || ARRAY['replacementBindingId','replacementBindingVersion']; END IF;
    END IF;
  ELSE RAISE EXCEPTION 'C2B_EVENT_PROFILE_INVALID' USING ERRCODE='23514'; END IF;
  IF NOT (p ?& fields) OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) AS k WHERE NOT k=ANY(fields)) THEN RAISE EXCEPTION 'C2B_PAYLOAD_FIELDS_INVALID' USING ERRCODE='23514'; END IF;
  FOREACH key IN ARRAY fields LOOP
    IF key LIKE '%Version' THEN
      IF jsonb_typeof(p->key) IS DISTINCT FROM 'number' OR (p->>key)::numeric NOT BETWEEN 1 AND 9007199254740991 OR (p->>key)::numeric<>trunc((p->>key)::numeric) THEN RAISE EXCEPTION 'C2B_PAYLOAD_VERSION_INVALID' USING ERRCODE='23514'; END IF;
    ELSE
      item:=p->>key;
      IF jsonb_typeof(p->key) IS DISTINCT FROM 'string' OR length(item) NOT BETWEEN 1 AND 512 OR item<>btrim(item) OR item ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'C2B_PAYLOAD_TEXT_INVALID' USING ERRCODE='23514'; END IF;
    END IF;
  END LOOP;
  IF p->>id_field IS DISTINCT FROM NEW.aggregate_id OR (p->>version_field)::bigint IS DISTINCT FROM NEW.aggregate_version OR p->>'tenantId' IS DISTINCT FROM NEW.tenant_id THEN RAISE EXCEPTION 'C2B_ENVELOPE_MISMATCH' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER audit_evidence_read_records_guard BEFORE INSERT OR UPDATE OR DELETE ON app_audit.audit_evidence_read_records FOR EACH ROW EXECUTE FUNCTION app_audit.audit_evidence_read_records_guard();
REVOKE ALL ON app_audit.audit_evidence_read_records FROM PUBLIC,ai_mls_production_runtime;
REVOKE ALL ON FUNCTION app_audit.audit_evidence_read_records_guard() FROM PUBLIC,ai_mls_production_runtime;
GRANT SELECT,INSERT ON app_audit.audit_evidence_read_records TO ai_mls_production_runtime;
COMMIT;
