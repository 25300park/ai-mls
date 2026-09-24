# REL-002 Historical Migration Attestation Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-365 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Development / Security Owner |
| Decision | DEC-193 |

| Requirement | Implementation / evidence | State |
|---|---|---|
| Native ledger unchanged | `001_identity_persistence_v1.up.sql`, `005_record_existing_identity_migration_v1.sql` unchanged | PASS |
| Separate append-only relation | `006_historical_migration_attestation_schema_v1.sql` | PASS |
| Exact one historical exception | exact migration/checksum/contract/version/engine/fingerprint/environment constraints | PASS |
| Unknown time represented truthfully | `historical_applied_at NULL`, `historical_applied_at_known FALSE` | PASS |
| Database attestation time | `evidence_recorded_at DEFAULT transaction_timestamp()` | PASS |
| Required evidence refs | `007` session-local inputs, bounded shape checks | PASS |
| Exact schema required | existing schema/contracts/constraint inventory preconditions | PASS |
| Duplicate/conflict fail closed | empty relation and absent native-ledger preconditions; no upsert | PASS |
| Mutation denial | UPDATE/DELETE/TRUNCATE statement triggers | PASS |
| Native precedence | insertion and verifier reject simultaneous native/historical evidence | PASS |
| Provenance separation | schema inspector + `ProductionBootstrap.identitySchemaReadinessProvenance` | PASS |
| Future migration unchanged | native ledger still requires true `applied_at NOT NULL` | PASS |
| Disposable PostgreSQL | `historical-migration-attestation.integration.test.ts` | PASS |
| Production safety | SQL execution, schema amendment, insertion, roles, deployment | 0 |
