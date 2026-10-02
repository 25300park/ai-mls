# REL-002 R3-B6 FEAT-022 Advisory PostgreSQL Persistence Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-378 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner |
| 기준 Main | `69163dcc9e1907fc6454c7f18a09caff599b45f6` |
| 범위 | FEAT-022 Advisory persistence 및 직접 async caller |

## 요구사항 추적

| 요구사항 | 구현·검증 근거 | 결과 |
|---|---|---|
| app_advisory, 3 tables, JSONB | 기존 R3-B1 migration/grants/verifier 변경 0; disposable PostgreSQL exact verifier, pg_typeof 및 logical key-order equality | PASS |
| canonical async persistence | AsyncAdvisoryPersistence → AdvisoryRuntime → application services → advisory job handlers → JobExecutionRuntime; readiness도 await | PASS |
| SQLite Local/Test parity | 기존 durable 구현의 async adapter; accepted rollback, 8개 concurrent replay, restart, tenant concealment | PASS |
| atomicity/idempotency/concurrency | client 하나의 transaction에 record와 idempotency; INSERT ON CONFLICT DO NOTHING; loser rollback 이후 동일 client winner 조회; 자동 write/provider retry 없음 | PASS |
| 실제 PostgreSQL 경합 | 12개 다른 advisory identity의 같은 key는 record 1개로 수렴; 같은 ID와 다른 timestamp replay; 다른 fingerprint 경쟁은 성공 1개 | PASS |
| audit/evidence/human review | 기존 validated envelope, ADVISORY authority, reviewRequired, principal provenance 보존; await 전 immutable snapshot | PASS |
| resource/failure boundary | ambiguous COMMIT/rollback 실패 시 safe error, client discard, quarantine; close는 admitted winner 조회까지 drain | PASS |
| schema readiness fail-closed | 기존 app_advisory catalog/hash/ACL contract 재사용; UPDATE grant 및 JSONB→TEXT drift에서 readiness 거부 | PASS |
| PG_PRODUCTION_POOL | FEAT-022 registry는 bootstrap pool만 주입; adapter는 pool 생성·종료 없음; physical Production pool count 1 | PASS |
| ai_mls_production_runtime | disposable runtime 로그인; UPDATE/DELETE/CREATE/SET ROLE migration 권한 거부; ACL 변경 0 | PASS |
| Production SQLite/raw URL/migration secret | Production은 pool만 허용; databasePath 및 INITIALIZE 거부; sealed secrets 직접 소비 없음 | PASS |
| immutable historical fingerprint | historical test 및 expected fingerprint 변경 0; 기존 authorized mismatch만 full regression 실패 | PASS |
| 독립 review | mutable persistence/runtime/application 입력 및 close/replay lifetime 3건 수정 후 재리뷰 승인 | PASS |

## 검증 결과 및 제한

Focused 신규 async tests 12 PASS, 기존 focused 32 PASS 및 composition 3 PASS. Affected 59 PASS(초기 async assertion 3건을 수정하여 failed module 16 PASS 재검증; 최종 full suite에도 포함). Disposable PostgreSQL 1 PASS. Full regression 1667 PASS / 1 authorized historical-candidate mismatch / 11 SKIP. Build/Lint/Typecheck PASS.

API-014/API-015/API-018/API-019/FEAT-022 persistence composition READY. Production deployability BLOCKED이며 identity/startup/worker와 provider 실행 hold를 유지한다. Production/Railway/Supabase mutation 0/0/0, 단일 bounded closeout commit 승인, push NOT_PERFORMED. [Completion Report](../reviews/REL002_R3B6_COMPLETION_REPORT.md)와 [Master Index](../00_MASTER_INDEX.md)를 따른다.
