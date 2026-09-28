# REL-002 Historical Migration Attestation Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-365 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Development / Security Owner |
| Decision | DEC-193, DEC-194 |

| Requirement | Implementation / evidence | State |
|---|---|---|
| Native ledger unchanged | `001_identity_persistence_v1.up.sql`, `005_record_existing_identity_migration_v1.sql` unchanged | PASS |
| Separate append-only relation | `006_historical_migration_attestation_schema_v1.sql` | PASS |
| Exact one historical exception | exact migration/checksum/contract/version/engine/fingerprint/environment constraints | PASS |
| Unknown time represented truthfully | `historical_applied_at NULL`, `historical_applied_at_known FALSE` | PASS |
| Database attestation time | `evidence_recorded_at DEFAULT transaction_timestamp()` | PASS |
| Required evidence refs | `007` session-local inputs, bounded shape checks | PASS |
| Exact platform-limited evidence class | [DEC-194 Evidence Contract](REL002_PLATFORM_LIMITED_BACKUP_RESTORE_EVIDENCE_CONTRACT.md) | PASS |
| R2 linkage truth | A/C/D/E `PROVEN`; B `PARTIAL_PLATFORM_LIMITATION` | PASS |
| Distinct backup/restore provenance | `BACKUP_RESTORE_PLATFORM_LIMITED_ATTESTATION_VERIFIED` | PASS |
| Dual approval gate | execution-operator `REL002-OPERATOR-HUMAN-001` APPROVED; independent reviewer APPROVED | PASS |
| Canonical R2 integrity | `SHA256SUMS.txt` 10/10 PASS; source bytes immutable | PASS |
| Exact schema required | existing schema/contracts/constraint inventory preconditions | PASS |
| Duplicate/conflict fail closed | empty relation and absent native-ledger preconditions; no upsert | PASS |
| Mutation denial | UPDATE/DELETE/TRUNCATE statement triggers | PASS |
| Native precedence | insertion and verifier reject simultaneous native/historical evidence | PASS |
| Provenance separation | schema inspector + `ProductionBootstrap.identitySchemaReadinessProvenance` | PASS |
| Future migration unchanged | native ledger still requires true `applied_at NOT NULL` | PASS |
| Disposable PostgreSQL | `historical-migration-attestation.integration.test.ts` | PASS |
| Repository implementation safety (historical) | implementation task 중 SQL execution, schema amendment, insertion, roles, deployment | 0 |
| Production preflight | database/operator identity, DB/schema/language privileges, required ownership, runtime role, absent historical/native evidence | PASS |
| Controlled transaction | `006` → exact three GUCs → `007` → `008` → `COMMIT` | PASS |
| Historical attestation persisted | exact canonical row; `evidence_recorded_at = 2026-09-28 03:13:38.525583+00` | PASS |
| Historical time truth | `historical_applied_at NULL`, `historical_applied_at_known FALSE` | PASS |
| Exact evidence binding | operator / backup / schema verification canonical references | PASS |
| Native ledger remains absent | native migration ledger absence verified post-commit | PASS / BY DESIGN |
| Readiness provenance | pre-commit and post-commit `008`; `HISTORICAL_MIGRATION_ATTESTATION_VERIFIED` | PASS |
| Rerun safety | `006` rerun PROHIBITED; `007` rerun PROHIBITED; historical `005` NOT USED | PASS |
| Closeout task safety | additional Production SQL, roles, runtime grants, deployment | 0 |

Finalized record: [REL-002 Production Backup / Restore Rehearsal Evidence](../evidence/REL002_PRODUCTION_BACKUP_RESTORE_REHEARSAL_EVIDENCE.md).

Production execution evidence: [REL-002 Production Historical Attestation Execution Evidence](../evidence/REL002_PRODUCTION_HISTORICAL_ATTESTATION_EXECUTION_EVIDENCE.md).
