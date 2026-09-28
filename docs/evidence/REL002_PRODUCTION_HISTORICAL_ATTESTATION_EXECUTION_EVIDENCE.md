# REL-002 Production Historical Attestation Execution Evidence

| 항목 | 값 |
|---|---|
| Evidence ID | `REL002-EVIDENCE-HISTORICAL-ATTESTATION-EXECUTION-001` |
| Evidence class | `PRODUCTION_CONTROLLED_TRANSACTION_ATTESTATION` |
| 문서 버전 | v1.0 |
| 상태 | APPROVED |
| Evidence state | FINALIZED |
| 소유 역할 | Database Owner / Security Owner |
| 적용 결정 | DEC-193, DEC-194 |
| 대상 환경 | PRODUCTION |
| 실행일 | 2026-09-28 |
| 기록 근거 | AO-provided Production execution closeout statement |
| Repository baseline | `c19ee4ba62e1fc70c3834578c225048d91671c9a` |
| 변경 정책 | 승인 후 immutable; 정정은 새 evidence record로만 허용 |

## 1. 목적과 범위

이 record는 DEC-193 historical attestation path의 controlled Production execution과 post-commit verification 결과를 보존한다. 본 문서화 task에서는 Production SQL을 실행하지 않았다. Raw credential, password, connection string 또는 secret은 기록하지 않는다.

## 2. Preflight result

Execution role: `ai_mls_production_migration_operator`.

| Preflight check | Result |
|---|---|
| Database identity | PASS |
| Operator identity | PASS |
| Database `CONNECT` | PASS |
| Database `CREATE` | PASS |
| Schema `USAGE` | PASS |
| Schema `CREATE` | PASS |
| SQL language `USAGE` | PASS |
| PL/pgSQL language `USAGE` | PASS |
| `identity_schema_contracts` `REFERENCES` | PASS |
| Runtime role exists | PASS |
| `app_identity` schema ownership | PASS |
| `identity_schema_contracts` ownership | PASS |
| `identity_schema_migrations` ownership | PASS |
| Historical attestation objects absent before execution | PASS |
| Native migration evidence absent before execution | PASS |

## 3. Controlled transaction result

Exact executed sequence:

1. `BEGIN`
2. `006_historical_migration_attestation_schema_v1.sql` — PASS
3. Session-local evidence GUC binding
4. `007_record_historical_identity_migration_attestation_v1.sql` — `DO / PASS`
5. `008_historical_identity_migration_attestation_v1.verify.sql` — `DO / PASS`
6. `readiness_provenance = HISTORICAL_MIGRATION_ATTESTATION_VERIFIED`
7. `COMMIT` — PASS

Bound evidence references:

| GUC | Value |
|---|---|
| `ai_mls.operator_evidence_ref` | `REL002-EVIDENCE-OPERATOR-001` |
| `ai_mls.backup_evidence_ref` | `REL002-EVIDENCE-BACKUP-RESTORE-001` |
| `ai_mls.schema_verification_evidence_ref` | `REL002-EVIDENCE-SCHEMA-VERIFY-001` |

## 4. Exact post-commit row

| Field | Verified value |
|---|---|
| `migration_id` | `REL002-P2D0B-IDENTITY-PG-V1` |
| artifact checksum | `b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e` |
| contract | `identity.registered-service-workload` |
| `schema_version` | `1` |
| `database_engine` | `POSTGRESQL` |
| `contract_fingerprint` | `33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82` |
| `target_environment` | `PRODUCTION` |
| `historical_applied_at` | `NULL` |
| `historical_applied_at_known` | `FALSE` |
| `operator_evidence_ref` | `REL002-EVIDENCE-OPERATOR-001` |
| `backup_evidence_ref` | `REL002-EVIDENCE-BACKUP-RESTORE-001` |
| `schema_verification_evidence_ref` | `REL002-EVIDENCE-SCHEMA-VERIFY-001` |
| `reason` | `HISTORICAL_APPLIED_AT_UNRECOVERABLE` |
| `result` | `VERIFIED_EXISTING_SCHEMA` |
| `evidence_recorded_at` | `2026-09-28 03:13:38.525583+00` |

## 5. Post-commit verification

- Exact historical attestation row: PASS.
- Native migration ledger remains absent: PASS / TRUE / BY DESIGN.
- Post-commit `008`: `DO / PASS`.
- Readiness provenance: `HISTORICAL_MIGRATION_ATTESTATION_VERIFIED`.
- Read-only verification transaction: `COMMIT / PASS`.

Post-commit verification 중 `BEGIN READ ONLY`가 두 번 입력되어 PostgreSQL이 `WARNING: there is already a transaction in progress`를 반환했다. 제공된 execution evidence에 따르면 transaction state와 verification result는 변하지 않았고 remediation은 필요하지 않다.

## 6. Canonical closeout state

| 항목 | 상태 |
|---|---|
| Historical attestation schema | COMMITTED |
| Historical attestation row | COMMITTED |
| Native ledger | ABSENT_BY_DESIGN |
| Historical `applied_at` | UNKNOWN |
| Readiness provenance | `HISTORICAL_MIGRATION_ATTESTATION_VERIFIED` |
| `006` rerun | PROHIBITED |
| `007` rerun | PROHIBITED |
| `005` | NOT_USED_FOR_THIS_HISTORICAL_CASE |

## 7. Evidence boundaries

Observed facts는 현재 closeout에 제공된 authoritative execution result에 기반한다. Historical migration 실행 시각은 계속 `UNKNOWN`이며 `evidence_recorded_at`과 같은 값으로 대체하지 않는다. Native ledger insertion이나 `005` execution을 주장하지 않는다.

## 8. Documentation-task safety

Production SQL execution `0`; schema amendment execution `0`; attestation insertion `0`; `005`/`002`/`004` execution `0`; role changes `0`; deployment `0`.

## 9. Independent review

2026-09-28 independent review는 baseline, exact persisted row, user-authoritative preflight/warning facts, DEC-193 date-bounded status, historical BLOCK preservation, links/IDs, secret exposure 및 documentation-task mutation `0`을 검토했다. Critical/Important/Minor finding은 `0/0/0`이며 final status는 `READY`이다.
