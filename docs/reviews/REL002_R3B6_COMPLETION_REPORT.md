# REL-002 R3-B6 FEAT-022 Advisory PostgreSQL Persistence Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-260 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner |
| 완료일 | 2026-10-02 |
| Brief | REL-002 R3-B6 — FEAT-022 Advisory PostgreSQL Persistence |
| 기준 Main | `69163dcc9e1907fc6454c7f18a09caff599b45f6` |
| Human/AO authorization | AUTHORIZED_TO_DESIGN_AND_IMPLEMENT |
| Closeout authorization | APPROVED_TO_CLOSEOUT / APPROVE_REL002_R3B6_ADVISORY_POSTGRESQL_PERSISTENCE |

## 1. Objective

승인된 app_advisory 3-table JSONB schema를 변경하지 않고 FEAT-022 persistence boundary를 canonical async PostgreSQL로 구현했다. 5개 persistence composition은 READY이며 Production deployability는 BLOCKED다. 구현 gate 충족은 Production 실행 승인이나 closeout commit을 의미하지 않는다.

## 2. Documents read

- [AGENTS.md](../../AGENTS.md), [Document Governance](../00_DOCUMENT_GOVERNANCE.md), [Glossary](../00_GLOSSARY.md), [Document Lifecycle](../00_DOCUMENT_LIFECYCLE.md), [Phase Completion Template](../templates/PHASE_COMPLETION_TEMPLATE.md)
- [R3-B0 Architecture](../implementation/REL002_R3B0_POSTGRESQL_ASYNC_PERSISTENCE_ARCHITECTURE.md), [R3-B1 Traceability](../implementation/REL002_R3B1_TRACEABILITY_MATRIX.md), [R3-B1A Semantics](../implementation/REL002_R3B1A_SCHEMA_SEMANTICS_DISPOSITION.md)의 Advisory 계약
- [R3-B5 Completion](REL002_R3B5_COMPLETION_REPORT.md), [Historical fingerprint exception](REL002_002_004_ROLE_BOUNDARY_REMEDIATION_COMPLETION.md)
- 현재 사용자의 R3-B6 schema/async/ACL/검증 및 commit 제한 지시; 기존 Advisory migration/up/grants/verifier

## 3. Files created

- `modules/ai/src/advisory-async-persistence.ts`: async port와 SQLite adapter
- `modules/ai/src/advisory-postgresql-persistence.ts`: shared-pool JSONB transaction adapter
- `modules/ai/src/advisory-async-persistence.test.ts`, `advisory-async-runtime.test.ts`, `advisory-persistence.test-fixtures.ts`: parity, lifecycle, input snapshot regression
- `apps/api/src/rel002-r3b6-advisory-postgresql.integration.test.ts`: disposable PostgreSQL parity/atomicity/concurrency/JSONB/readiness/ACL
- [Traceability Matrix](../implementation/REL002_R3B6_TRACEABILITY_MATRIX.md), 이 completion report

## 4. Files modified

- Advisory runtime/application/readiness/production composition/index 및 직접 관련 tests: async end-to-end와 await 전 검증 입력 snapshot
- Advisory durable persistence: 기존 검증·canonical JSON·immutable helper export만 추가
- Advisory job handlers/JobExecutionRuntime 및 직접 tests: async handler 결과를 기다린 뒤 기존 admission 재검증과 durable terminal CAS
- Production registry/main/readiness 및 tests: 동일 PG_PRODUCTION_POOL 주입, app_advisory exact readiness; 기존 staging integrated test는 await한 startup readiness snapshot 사용
- [Master Index](../00_MASTER_INDEX.md): 문서 2개 등록

## 5. Key decisions added

새 schema/ACL/architecture 결정 없음. R3-B1A Advisory JSONB와 SELECT/INSERT-only ACL을 재사용한다. idempotency 경합의 loser insert는 rollback하고 같은 admitted client로 winner를 조회한다. Provider 호출과 write의 자동 retry는 추가하지 않는다. Production provider execution은 계속 held 상태다.

## 6. Open decisions

None. Human/AO가 R3-B6 구현 및 검증을 수락하고 정확히 한 개의 bounded closeout commit을 승인했다.

## 7. Inconsistencies found

- 기존 phase plan의 다음 단계 명칭보다 현재 사용자의 R3-B6 Advisory 범위가 우선한다. R3-B7/R3-B8은 수행하지 않았다.
- historical fingerprint mismatch는 이전 승인된 immutable historical-candidate mismatch로 유지한다. test를 수정·완화·refresh하지 않았다.
- 독립 review의 async mutation 및 close race 3건은 재현 RED → 수정 GREEN → 독립 재리뷰 승인으로 해결했다.

## 8. Validation performed

| 검사 | 결과 |
|---|---|
| Baseline main/HEAD/worktree | main / 69163dcc9e1907fc6454c7f18a09caff599b45f6 / 시작 시 CLEAN |
| Focused | 신규 async 12 PASS; 기존 runtime/application/readiness/jobs focused 32 PASS; composition 3 PASS |
| Disposable PostgreSQL | 1 PASS; approved migration/grants/exact verifier, runtime role, JSONB, atomicity, concurrency, restart, readiness drift; cluster stop/remove 완료 |
| Affected | 59 PASS; async assertion 3건 수정 후 해당 16-test module PASS; 최종 full suite 포함 |
| Full regression | 1667 PASS / 1 authorized historical fingerprint failure / 11 SKIP |
| Build/Lint/Typecheck | PASS/PASS/PASS |
| git diff --check | PASS |
| Secret scan | 변경 파일 scoped scan PASS; credential/local DB 포함 없음 |
| Independent review | APPROVE_REL002_R3B6_ADVISORY_POSTGRESQL_PERSISTENCE; 수정 3건 재리뷰 승인 |
| 문서 구조/링크/상태/버전/범위 | PASS; 10개 completion section, v0.1 APPROVED |

## 9. Known limitations

Production deployability BLOCKED. Runtime identity/startup/worker 및 provider execution hold는 잔여 phase scope다. 실제 외부 provider/network validation은 수행하지 않았다. 전체 회귀는 승인된 immutable historical fingerprint mismatch 때문에 exit 1이며 새 실패는 없다. Disposable integration은 일반 full suite에서 skip되어 총 11 SKIP이다. Runtime migration, ACL 확대, Production SQLite fallback, raw DATABASE_URL, migration credential 소비 없음.

## 10. Next brief prerequisites

Human/AO가 구현 결과와 [Traceability Matrix](../implementation/REL002_R3B6_TRACEABILITY_MATRIX.md)를 검토하여 R3-B6 closeout을 승인했다. 이 승인에 따라 bounded commit만 수행하며 R3-B7/R3-B8을 자동 시작하지 않는다.

최종 recommendation: **APPROVE_REL002_R3B6_ADVISORY_POSTGRESQL_PERSISTENCE**. API-014/API-015/API-018/API-019/FEAT-022 READY. Production/Railway/Supabase mutation 0/0/0. Commit은 승인된 단일 R3-B6 closeout Git 기록을 따른다. Push NOT_PERFORMED.
