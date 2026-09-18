# REL-002 Phase 2C Controlled Migration Execution Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-311 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity Owner / Data Owner / Operations Owner / Security Owner |
| 기준일 | 2026-09-18 |
| 대상 migration | `REL002-P2A-IDENTITY-RSW-V1` |

## 1. 목적과 현재 판정

이 문서는 `identity_registered_service_workloads` v1 migration의 통제된 Production 실행 gate를 정의한다. Migration 실행, Production DB write, identity seed, runtime schema auto-create는 이 단계에서 모두 `0`이다.

| 항목 | 현재 상태 |
|---|---|
| 논리적 대상 DB | 기존 Identity-owned Production Identity/Session SQLite boundary |
| 대상 환경 | `PRODUCTION` |
| 물리 DB binding | `UNBOUND` — 승인된 Production configuration/evidence packet에 exact identity reference가 아직 없음 |
| Migration artifact | `modules/identity/migrations/production/001_registered_service_workload_v1.up.sql` |
| Verification artifact | `modules/identity/migrations/production/001_registered_service_workload_v1.verify.sql` |
| Artifact SHA-256 | `fd31b7376cf6d04102b1c5280b07b02985aefb0ebcf18111cdbdb5a5ead7bb90` |
| Schema contract | `identity.registered-service-workload` / version `1` |
| Schema fingerprint | `6758c44e385d416299020512d93b6485b42377daf2d9bfd5461f0413fde65e6b` |
| Execution authorization | `NOT_GRANTED` |

물리 DB path, credential value 또는 secret을 문서에 기록하지 않는다. 실행 packet은 target database identity fingerprint/reference와 approved configuration reference로 정확한 DB를 결합해야 한다. 이 binding이 없거나 ambiguous하면 실행을 중단한다.

## 2. Operator authorization

실행자는 named human identity, trusted current Session, current MFA, exact `PRODUCTION` environment와 target database/change/migration scope를 가져야 한다. Operations Owner, Data Owner, Security Owner의 독립 승인과 change/evidence reference가 필요하다. 기존 authorization authority를 사용하며 새 role/capability를 만들지 않는다.

현재 저장소에는 이 migration을 실행할 exact operator assignment와 승인 evidence가 없다. 따라서 operator authority는 execution packet에서 live revalidation되어야 하며, release acceptance만으로 migration authority를 추정하지 않는다.

## 3. 실행 순서

1. [Preflight Checklist](REL002_PHASE2C_PREFLIGHT_CHECKLIST.md)의 모든 blocking 항목을 검증한다.
2. [Backup/Restore Prerequisites](REL002_PHASE2C_BACKUP_RESTORE_PREREQUISITES.md)의 exact-target backup과 isolated restore evidence를 확인한다.
3. Application listener, writer, worker, provider-capable runtime을 정지하고 write quiescence를 증명한다.
4. Read-only inspection으로 현재 state를 재분류한다.
   - exact `READY`: same migration identity/checksum/contract/version/fingerprint와 committed ledger가 일치하면 no-op replay로 종료한다.
   - `NOT_READY_MISSING_SCHEMA`: 최초 forward application만 허용한다.
   - `NOT_READY_INCOMPATIBLE_SCHEMA`, `NOT_READY_UNSUPPORTED_VERSION`, `NOT_READY_PARTIAL_MIGRATION`: abort한다.
5. Single authorized executor가 `BEGIN IMMEDIATE`로 exclusive write intent를 확보한다.
6. Lock 안에서 state를 다시 분류한다. Preflight 결과와 달라졌으면 rollback/abort한다.
7. 승인된 artifact를 적용하고 동일 transaction 안에서 exact execution-ledger evidence를 append한다.
8. Verification artifact와 schema inspector로 columns, constraints, indexes, metadata, ledger identity, zero seed를 검증한다.
9. 모든 검증이 exact하면 commit한다. 그렇지 않으면 rollback한다.
10. Commit 후 read-only verification과 evidence capture를 수행한다.

## 4. Locking, atomicity, replay

- Executor는 정확히 하나이며 `BEGIN IMMEDIATE` lock 획득 실패/timeout은 retry하지 않고 abort evidence를 남긴다.
- Schema/metadata/ledger 변경은 동일 transaction이다.
- Migration artifact는 workload registration row를 생성하지 않는다.
- Same migration ID with different checksum/contract/version/fingerprint는 conflict이며 overwrite하지 않는다.
- Commit outcome이 ambiguous하면 blind rerun하지 않고 read-only schema/ledger reclassification으로만 판정한다.

## 5. Rollback과 forward-fix

Commit 전 실패는 transaction rollback으로 처리한다. Commit 후에는 table/metadata/ledger를 삭제하거나 downgrade하지 않는다. Runtime rollback은 v1 compatibility가 유지될 때만 가능하며, schema defect는 새 승인 migration ID를 가진 forward-fix로 처리한다. 자세한 규칙은 [Rollback/Failure Policy](REL002_PHASE2C_ROLLBACK_FAILURE_POLICY.md)를 따른다.

## 6. ProductionBootstrap transition

Post-migration exact verification이 성공하면 schema authority 결과만 `READY`로 전환할 수 있다. 이것은 aggregate Production readiness가 아니다.

`ProductionBootstrap`은 이후에도 다음을 fail-closed로 확인한다.

- 별도 증거 기반 workload registration 존재와 lifecycle
- live authorization assignment/policy
- mandatory configuration/secret references
- remaining startup gate와 five child-root readiness

Migration 중에는 `DurableSessionUnitOfWork`, child roots, listener, worker, provider execution을 시작하지 않는다.

## 7. 현재 gate disposition

| Gate | 상태 |
|---|---|
| Plan contract | `DEFINED` |
| Exact physical target binding | `BLOCKED` |
| Operator authorization evidence | `BLOCKED` |
| Current backup/restore evidence | `BLOCKED` |
| Controlled execution | `NOT_AUTHORIZED` |
| Production schema | `NOT_READY_UNTIL_CONTROLLED_EXECUTION` |

관련 문서: [Evidence Contract](REL002_PHASE2C_EXECUTION_EVIDENCE_CONTRACT.md), [Post-Migration Verification](REL002_PHASE2C_POST_MIGRATION_VERIFICATION_PLAN.md), [Completion Report](../reviews/REL002_PHASE2C_COMPLETION_REPORT.md).
