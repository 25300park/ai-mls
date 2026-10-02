# REL-002 R3-B5 API-019 External Integration PostgreSQL Persistence Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-259 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner |
| 완료일 | 2026-10-02 |
| Brief | REL-002 R3-B5 — API-019 External Integration PostgreSQL Persistence |
| 기준 Main | `6edc04b38084cd58cf2301afdeb212b25d9a850b` |
| Human/AO authorization | `APPROVE_REL002_R3B5_SHORT_IN_CHAT_DESIGN` |
| Closeout authorization | `APPROVED_TO_CLOSEOUT` / `APPROVE_REL002_R3B5_EXTERNAL_INTEGRATION_POSTGRESQL_PERSISTENCE` |

## 1. Objective

API-019의 기존 durable semantics를 canonical async contract와 PostgreSQL adapter로 구현했다. API-014/API-015/API-018/API-019 persistence composition READY, FEAT-022 FAIL-CLOSED, Production deployability BLOCKED를 유지한다. Production 실행 승인이나 AO closeout commit을 의미하지 않는다.

## 2. Documents read

- [AGENTS.md](../../AGENTS.md), [Document Governance](../00_DOCUMENT_GOVERNANCE.md), [Glossary](../00_GLOSSARY.md), [Document Lifecycle](../00_DOCUMENT_LIFECYCLE.md), [Phase Completion Template](../templates/PHASE_COMPLETION_TEMPLATE.md)의 관련 규칙
- [R3-B0 Architecture](../implementation/REL002_R3B0_POSTGRESQL_ASYNC_PERSISTENCE_ARCHITECTURE.md), [Governance Disposition](../implementation/REL002_R3B0_GOVERNANCE_DISPOSITION_PACKET.md), [Phase Plan](../implementation/REL002_R3B0_IMPLEMENTATION_PHASE_PLAN.md), [Table Inventory](../implementation/REL002_R3B0_CHILD_ROOT_TABLE_INVENTORY.md)의 External Integration 범위
- [R3-B1 Traceability](../implementation/REL002_R3B1_TRACEABILITY_MATRIX.md), [R3-B1A Schema Semantics](../implementation/REL002_R3B1A_SCHEMA_SEMANTICS_DISPOSITION.md)의 ordinal/FK/JSON 계약
- [R3-B4 Completion](REL002_R3B4_COMPLETION_REPORT.md), [R3-B4 Traceability](../implementation/REL002_R3B4_TRACEABILITY_MATRIX.md)
- [Historical fingerprint exception](REL002_002_004_ROLE_BOUNDARY_REMEDIATION_COMPLETION.md)의 기존 full-regression 실패 기록
- 현재 사용자 R3-B5 continuation 및 explicit design approval

## 3. Files created

- `modules/source/src/external-integration-async-persistence.ts`: canonical async port 및 SQLite adapter
- `modules/source/src/external-integration-postgresql-persistence.ts`: PostgreSQL transaction/repository adapter
- `modules/source/src/external-integration-async-persistence.test.ts`: durable async replay 및 binding proof
- `modules/source/src/external-integration-postgresql-persistence.test.ts`: transaction/rollback/quarantine/drain proof
- `apps/api/src/rel002-r3b5-external-postgresql.integration.test.ts`: disposable PostgreSQL parity/concurrency/ACL proof
- [R3-B5 Traceability Matrix](../implementation/REL002_R3B5_TRACEABILITY_MATRIX.md)
- 본 completion report

## 4. Files modified

- `modules/source/src/external-integration-application.ts`, `external-integration-runtime.ts`, `external-integration-application-host.ts`: async call path
- `modules/source/src/external-integration-durable-persistence.ts`: 기존 contract binding validation gap의 SQLite parity 수정
- `modules/source/src/connector-runtime-application.ts`: API-019 async observation 결과 await
- `modules/source/src/external-integration-application.test.ts`, `external-integration-recovery-handoff.test.ts`: 직접 관련 caller/test의 async 전환
- `modules/source/src/index.ts`: canonical async/PostgreSQL export
- `apps/api/src/external-integration-production-composition.ts`, `external-integration-http-adapter.ts`, `external-integration-http-runtime.test.ts`: PostgreSQL/Test 선택 및 async HTTP 오류 처리/검증
- `apps/api/src/connector-production-composition.ts`: observation sink async 결과 type
- `apps/api/src/child-root-postgresql-readiness.ts`, `production-child-root-registry.ts`, `production-main.ts`: API-019 exact readiness 및 bootstrap pool 주입
- `apps/api/src/production-child-root-registry.test.ts`, `production-main.test.ts`: API-019 composition expectation
- [Master Index](../00_MASTER_INDEX.md): 신규 문서 등록

## 5. Key decisions added

새 architecture decision은 추가하지 않았다. 승인된 DEC-195~198과 현재 R3-B5 explicit authorization을 구현했다.

- 승인된 5-table schema, 세 immediate NO ACTION parent FK, logical-only reference, validated JSON TEXT를 변경하지 않는다.
- observation/evidence의 ordinal은 contract parent row lock 안의 같은 transaction에서 각각 할당하며 자동 retry는 0이다.
- `PG_PRODUCTION_POOL` 하나를 재사용하며 child repository는 pool/secret을 생성·해석·종료하지 않는다.
- Production/Staging은 PostgreSQL만, Test는 기존 SQLite async adapter만 허용한다.
- 기존 mapping의 contract binding 변경 및 다른 contract mapping에 observation을 연결하는 validation gap을 양쪽 adapter에서 거부한다.
- 기존 Production HTTP listener topology를 보존하며 API-019 신규 listener route를 추가하지 않는다.

## 6. Open decisions

- AO의 R3-B5 closeout과 단일 bounded commit은 현재 명시적 지시로 승인됐다.
- **OPEN DECISION:** FEAT-022 및 기존 identity/service/binding/startup/worker prerequisites는 각 후속 승인 Brief에서만 처리한다.

## 7. Inconsistencies found

- 과거 R3-B0 phase plan의 B3/B4/B6 순서와 현재 완료 baseline이 다르다. 사용자의 현재 명시적 R3-B5/API-019 scope를 적용하고 과거 승인 문서를 재작성하지 않았다.
- 기존 SQLite store에도 cross-contract mapping/observation validation gap이 있었다. SQLite/PostgreSQL RED로 재현하고 승인된 binding 계약을 양쪽에서 동일하게 검사하도록 수정했다. Schema/authority 변경은 없다.
- 초기 PostgreSQL candidate의 UPSERT rowCount 누락, 종료 drain/queued quarantine, HTTP rejected execution의 400 projection을 독립 리뷰에서 발견했다. 관련 regression과 최소 수정 후 최종 리뷰에서 추가 결함이 없었다.
- Full regression의 historical fingerprint 실패는 기존 승인 예외와 일치한다. 해당 historical fingerprint를 갱신하지 않았다.

## 8. Validation performed

| 검사 | 방법 | 결과 |
|---|---|---|
| 기준점 | pwd / branch / HEAD / status | 지정 저장소, main, exact HEAD, CLEAN PASS |
| TDD | 기능 부재, async rejection, cross-contract binding, close drain, queued quarantine, HTTP rejection의 RED → GREEN | PASS |
| Focused | adapter/application/handoff/HTTP/registry/main 테스트 | PASS |
| Affected | Source/API 중간 실행; 후속 변경은 최종 full regression으로 검증 | `406 PASS / 5 SKIP / 0 FAIL` |
| Disposable PostgreSQL | PostgreSQL 18.4, loopback `127.0.0.1:55451`; 승인된 migration/grants/verifier, runtime role adapter | `1/1 PASS` |
| Atomicity/concurrency | concurrent provision/replay/ordinal, version race, late-write rollback, fingerprint collision, suspension/reopen | PASS |
| Schema/ACL/JSON | exact verifier, 3 immediate NO ACTION FK, TEXT byte equality, runtime DDL/DELETE 거부 | PASS |
| Disposable cleanup | cluster stop, listener 폐쇄, exact temp data directory 삭제 | PASS |
| Build/Lint/Typecheck | canonical clean build 및 설치된 동일 TypeScript/ESLint 직접 실행 | PASS |
| Full regression | canonical `scripts/run-compiled-tests.mjs` | `1655 PASS / 1 known authorized historical failure / 10 SKIP` |
| Independent review | 별도 reviewer가 source diff 검토, 수정 후 재검토 | candidate 승인 가능; 추가 Critical/Important/Minor `0/0/0` |
| Final diff/doc/scope/secret checks | 25개 변경 파일; 필수 10개 heading, metadata/link 검증; diff whitespace 및 protected path 검사 | PASS; 신규 secret 0, unchanged baseline test fixture 1개 제외 |

유일한 full-regression 실패명은 `REL-001 Blocker 2C durably persists the exact post-UI-006 candidate across reopen`이다. Current compiled candidate와 immutable historical expected fingerprint `7fef924f...`가 다르며 기존 `EXPECTED_STALE_HISTORICAL_CANDIDATE_FINGERPRINT` 예외에 해당한다. 전체 suite를 0 FAIL로 표현하지 않는다.

## 9. Known limitations

- Production/Railway/Supabase mutation `0/0/0`; Production migration, deployment, push는 수행하지 않았다. 구현 검증 시점의 closeout commit은 0이며 현재 승인된 단일 bounded closeout commit만 허용한다.
- Physical Production pool topology는 기존 count 1 구조를 보존했다. Live Production pool 측정 또는 연결은 수행하지 않았다.
- API-019 persistence/composition READY는 repository candidate의 범위다. 실제 identity/binding/runtime/provider prerequisites의 충족을 의미하지 않는다.
- FEAT-022는 FAIL-CLOSED이고 전체 Production deployability는 BLOCKED다.
- `pnpm` launcher가 implicit install을 시도하여 중단됐으므로 dependency install을 수행하지 않고 설치된 도구와 동일 canonical compiled-test runner를 직접 사용했다. Dependency/lockfile 변경은 없다.
- Independent review는 source review이며 테스트의 독립 재실행은 수행하지 않았다. 실제 실행 증거는 본 작업의 검증 결과다.

## 10. Next brief prerequisites

R3-B5 closeout과 단일 commit은 승인됐다. R3-B6 및 모든 후속 Brief는 별도 명시적 승인이 필요하다. 다음 Brief, FEAT-022 구현, provider activation 또는 Production 실행을 시작하지 않았다.

## Completion statement

R3-B5 implementation candidate는 승인된 scope의 TDD, disposable PostgreSQL 및 independent review를 통과했다. 최종 full regression에는 기존 승인 historical fingerprint 실패 1개가 남아 있다. Human/AO는 `APPROVE_REL002_R3B5_EXTERNAL_INTEGRATION_POSTGRESQL_PERSISTENCE`로 R3-B5 closeout을 승인했다. R3-B5는 COMPLETE이며 본 승인 기록과 변경만 단일 bounded closeout commit에 포함한다. Production deployability BLOCKED와 mutation `0/0/0`을 유지하고 다음 Brief를 시작하지 않았다.
