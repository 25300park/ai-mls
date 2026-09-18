-- Read-only verification queries for REL002-P2A-IDENTITY-RSW-V1.
SELECT contract_id, schema_version, contract_fingerprint
FROM identity_schema_contracts
WHERE contract_id = 'identity.registered-service-workload';

SELECT migration_id, artifact_checksum, contract_id, schema_version,
       contract_fingerprint, target_environment, change_evidence_ref,
       operator_evidence_ref, applied_at, result
FROM identity_schema_migrations
WHERE migration_id = 'REL002-P2A-IDENTITY-RSW-V1';

SELECT COUNT(*) AS seeded_identity_count
FROM identity_registered_service_workloads;

PRAGMA table_xinfo(identity_registered_service_workloads);
PRAGMA index_list(identity_registered_service_workloads);
