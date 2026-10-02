# REL-002 R3-B7 Cross-Domain Async / Unit-of-Work Hardening Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-261 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner |
| 완료일 | 2026-10-02 |
| Brief | REL-002 R3-B7 — CROSS-DOMAIN ASYNC / UNIT-OF-WORK HARDENING |
| 기준 Main | `a6304f70341a93cd8b0537e5b8cbbd9a002efe6e` |
| Source 승인 | APPROVE_REL002_R3B7_TRANSACTION_LIFECYCLE_REMEDIATION |
| 추가 승인 | APPROVE_REL002_R3B7_API015_HYDRATION_CONSISTENCY_REMEDIATION |
| Closeout authorization | APPROVED_TO_CLOSEOUT / APPROVE_REL002_R3B7_CROSS_DOMAIN_ASYNC_UOW_HARDENING |
| Push | NOT_PERFORMED |

## 1. Objective

5개 READY persistence root의 단일 pool·async transaction·client lifecycle을 함께 검증하고 실제 재현 결함만 기존 owner 안에서 보강했다. 새로운 domain 동작, schema, global UoW, distributed transaction, retry engine을 추가하지 않았다. Production deployability는 BLOCKED다.

## 2. Documents read

- 사용자 R3-B7 원요청, 명시적 transaction/lifecycle remediation 승인, API-015 hydration consistency 추가 승인
- [AGENTS.md](../../AGENTS.md), [Document Governance](../00_DOCUMENT_GOVERNANCE.md), [Glossary](../00_GLOSSARY.md), [Document Lifecycle](../00_DOCUMENT_LIFECYCLE.md), [Phase Completion Template](../templates/PHASE_COMPLETION_TEMPLATE.md)
- [R3-B0 Architecture](../implementation/REL002_R3B0_POSTGRESQL_ASYNC_PERSISTENCE_ARCHITECTURE.md), [Phase Plan](../implementation/REL002_R3B0_IMPLEMENTATION_PHASE_PLAN.md)의 async/lock/pool 기준
- [R3-B6 Completion](REL002_R3B6_COMPLETION_REPORT.md), 기존 5개 approved migration/grants/verifier 및 persistence tests
- [Historical fingerprint exception](REL002_002_004_ROLE_BOUNDARY_REMEDIATION_COMPLETION.md)

## 3. Files created

- `apps/api/src/rel002-r3b7-async-uow-hardening.test.ts`: 5개 domain pool error/drain/terminal/quarantine·architecture regression
- `apps/api/src/rel002-r3b7-shared-pool-postgresql.integration.test.ts`: 실제 single-pool 5개 schema/readiness/atomicity/replay/locks/ACL/client trace
- [Traceability Matrix](../implementation/REL002_R3B7_TRACEABILITY_MATRIX.md), 이 completion report

## 4. Files modified

- Publication/Administration/Connector PostgreSQL persistence: in-flight tracking·close drain·safe acquisition·quarantine·exact-once terminal/release
- Administration persistence engine: async terminal guard 및 commit preflight 실패의 physical rollback
- Administration PostgreSQL hydration: 기존 target revision lock 유지 후 linkage용 additional revisions unlocked hydration
- External Integration PostgreSQL persistence: completed read의 quarantine 재검사
- Production bootstrap engine/test: concurrent close도 같은 owned shutdown completion을 기다림; cleanup 순서 변경 없음
- [Master Index](../00_MASTER_INDEX.md): R3-B7 문서 2개 등록

## 5. Key decisions added

Architecture/schema/ACL/domain semantics 결정 변경 없음. child root close는 admitted 작업과 physical cleanup이 끝날 때까지 기다린다. terminal guard는 await 이전에 닫아 staged mutation과 terminal re-entry를 막는다. API-015의 기존 global linkage 검증에 필요한 revision을 읽되 target FOR UPDATE 범위를 확대하지 않는다. 반복 helper를 generic subsystem으로 병합하지 않는다.

## 6. Open decisions

None. Human/AO가 R3-B7 구현·검증 및 API-015 hydration consistency remediation을 수락하고 정확히 한 개의 bounded closeout commit을 승인했다.

## 7. Inconsistencies found

- 최초 TDD 4 PASS / 8 FAIL로 close/acquisition/terminal 결함을 재현했다. 자동 승인 검토가 broad source rewrite를 거부하여 source 수정 없이 보고했고, 사용자의 명시적 remediation 승인 이후만 수정했다.
- 독립 review의 Administration failed-begin drain 순서 결함은 RED→GREEN으로 수정했다.
- actual shared-pool test의 다른 Administration resource begin이 PERSISTENCE_INPUT_INVALID로 실패했다. 추가 명시적 hydration 승인 후 resource/proposal read와 revision inventory를 맞췄다. invalid linkage 검증은 유지한다.
- 기존 phase plan의 R3-B7 명칭보다 현재 사용자 scope가 우선한다. 승인된 prior BLOCK/PARTIAL 및 historical evidence를 수정하지 않았다.

## 8. Validation performed

| 검사 | 결과 |
|---|---|
| Baseline | main / a6304f70341a93cd8b0537e5b8cbbd9a002efe6e; 이전 턴 생성 RED test만 untracked |
| Focused | R3-B7 25 PASS + bootstrap concurrent close 1 PASS |
| Affected | 66 PASS |
| Disposable PostgreSQL | 6 PASS: 기존 R3-B2~B6 5개 + actual shared-pool 1개; approved artifacts 그대로 적용 |
| Full regression | 1693 PASS / 1 authorized immutable historical fingerprint mismatch / 12 SKIP |
| Build/Lint/Typecheck | PASS/PASS/PASS |
| git diff --check / Secret scan | PASS/PASS; changed-file scoped patterns 및 protected path 검사 |
| Independent review | APPROVED; lifecycle 및 추가 hydration 재리뷰 완료 |
| 문서 구조/링크/상태/버전/범위 | PASS; 10개 section, v0.1 APPROVED |

## 9. Known limitations

Production deployability BLOCKED. R3-B8 aggregate startup gate, R3-D listener/worker redesign, provider 실행은 out of scope다. Production SQLite/raw DATABASE_URL/migration credential fallback 없음. READ COMMITTED의 global multi-statement hydration을 snapshot isolation으로 표현하지 않는다. 불안정하거나 invalid한 linkage는 fail-closed이며 새로운 driver retry를 추가하지 않았다. Full suite의 authorized immutable historical fingerprint mismatch를 별도 분류하고 test/migration을 변경하지 않았다. Disposable integration 1개가 일반 suite에서 추가 skip되어 12 SKIP이다. 검증 cluster는 stop/remove하여 남기지 않았다.

## 10. Next brief prerequisites

Human/AO가 [Traceability Matrix](../implementation/REL002_R3B7_TRACEABILITY_MATRIX.md)와 이 결과를 수락하여 closeout을 승인했다. 승인된 bounded commit만 수행하며 R3-B8을 시작하지 않는다.

최종 recommendation: **APPROVE_REL002_R3B7_CROSS_DOMAIN_ASYNC_UOW_HARDENING**. API-014/API-015/API-018/API-019/FEAT-022 persistence composition READY. Production/Railway/Supabase mutation 0/0/0. Commit은 승인된 단일 R3-B7 closeout Git 기록을 따른다. Push NOT_PERFORMED.
