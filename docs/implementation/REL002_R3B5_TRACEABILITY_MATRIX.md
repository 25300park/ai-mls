# REL-002 R3-B5 API-019 External Integration PostgreSQL Persistence Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-377 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner |
| 기준 Main | `6edc04b38084cd58cf2301afdeb212b25d9a850b` |
| 범위 | API-019 External Integration only |

## 요구사항 추적

| 요구사항 | 구현 근거 | 검증 근거 | 결과 |
|---|---|---|---|
| 승인된 5-table schema | `PostgreSqlExternalIntegrationStore`는 기존 `app_external_integration` relation만 사용; migration/verifier/grants 변경 0 | disposable PostgreSQL의 기존 migration/grants/exact verifier | PASS |
| canonical async call path | `AsyncExternalIntegrationPersistence` → application → runtime/host → HTTP; Connector observation sink 결과 await | application/handoff/HTTP 및 전체 회귀 | PASS |
| SQLite Local/Test parity | 기존 durable store를 async adapter로 감싸며 sync 오류도 Promise rejection으로 전달 | 재시작/replay/fingerprint conflict 및 PostgreSQL parity | PASS |
| atomicity | mutation당 shared pool client 하나와 단일 transaction; mapping/observation/evidence/idempotency 함께 commit 또는 rollback | late idempotency write fault 후 실제 PostgreSQL mapping/evidence rollback | PASS |
| contract-local immutable ordinal | contract parent row `FOR UPDATE` 뒤 동일 transaction에서 table별 `MAX(ordinal)+1`; positive safe integer 검증; `ORDER BY ordinal` | 12 concurrent observation writes, contiguous observation/evidence ordinal | PASS |
| immediate NO ACTION parent FK | 기존 mapping/observation/evidence → contract FK 3개를 보존 | exact verifier와 FK catalog의 `a/a/false` 검증 | PASS |
| logical-only references | mappingId 및 cross-domain target에 FK 추가 없음; mapping/observation의 contract binding 검사 | cross-contract rejection; 존재하지 않는 logical target의 정상 mapping | PASS |
| validated JSON TEXT | `JSON.stringify` 문자열을 TEXT parameter로 저장; JSONB 변환 없음 | SQLite 결과와 raw PostgreSQL payload bytes 비교 | PASS |
| idempotency/concurrency | parent lock 후 replay; fingerprint 충돌 거부; mapping UPSERT 변경 행 검증; driver retry 0 | 동일 key concurrent replay, version race의 성공 1개, rollback | PASS |
| ambiguous COMMIT | safe error, client discard, repository quarantine; pool 획득 후 및 COMMIT 전 상태 재검사 | ambiguous commit 및 queued request regression | PASS |
| shutdown ownership | child close는 admitted 작업을 drain하고 pool을 종료하지 않음 | drain 및 composition pool ownership tests | PASS |
| exact readiness | 기존 read-only catalog contract로 `assertR3B1ExternalIntegrationSchemaReady` 수행 | registry/main 및 readiness 회귀 | PASS |
| canonical pool/credential | bootstrap-owned `PG_PRODUCTION_POOL` 주입; child pool/secret resolver 생성 0; runtime ACL 유지 | composition/registry review, disposable runtime role 검증 | PASS |
| Production/Staging fallback 금지 | pool 필수; `databasePath` 병용 거부; Test는 SQLite만 허용 | Staging composition behavior test 및 기존 Production authority regression | PASS |
| bounded activation | API-014/015/018/019 persistence composition READY; FEAT-022 fail-closed | main options/registry tests 및 independent review | PASS |

## 기존 승인 문서와의 관계

[R3-B0 Architecture](REL002_R3B0_POSTGRESQL_ASYNC_PERSISTENCE_ARCHITECTURE.md), [R3-B1 Traceability](REL002_R3B1_TRACEABILITY_MATRIX.md), [R3-B1A Semantics](REL002_R3B1A_SCHEMA_SEMANTICS_DISPOSITION.md)를 구현한다. 현재 사용자 지시가 phase plan의 과거 B3/B4/B6 sequence보다 우선하며 승인된 R3-B4의 API-018 완료 상태를 보존한다. 새 schema, business authority, provider execution 또는 Production listener route를 추가하지 않았다.

## 검증 요약

- Focused RED → GREEN: async SQLite replay, transaction/rollback, ambiguous commit, drain/quarantine, binding, application/HTTP 오류 처리.
- Affected Source/API 중간 검증: `406 PASS / 5 environment-gated SKIP / 0 FAIL`; 이후 수정은 최종 전체 회귀가 포함한다.
- Disposable PostgreSQL 18.4, loopback `127.0.0.1:55451`: `1/1 PASS`; cluster stop, port closure, data removal PASS.
- 최종 clean build / 전체 lint / typecheck: PASS. `pnpm` launcher의 implicit install을 피하고 설치된 동일 TypeScript/ESLint와 canonical compiled-test runner를 직접 실행했다.
- Full regression: `1655 PASS / 1 known authorized historical fingerprint failure / 10 SKIP`.
- 유일한 실패: `REL-001 Blocker 2C durably persists the exact post-UI-006 candidate across reopen`. [기존 예외 기록](../reviews/REL002_002_004_ROLE_BOUNDARY_REMEDIATION_COMPLETION.md)의 `EXPECTED_STALE_HISTORICAL_CANDIDATE_FINGERPRINT`와 일치한다. historical test/evidence를 변경하지 않았다.
- Independent review: initial findings를 RED로 재현하고 수정 후 재검토; 최종 추가 Critical/Important/Minor `0/0/0`, candidate 승인 가능.

## 범위 제한

Production deployability는 **BLOCKED**다. Identity/service/binding/startup/worker 및 FEAT-022 prerequisites는 이번 단계의 완료와 별개다. Production/Railway/Supabase mutation `0/0/0`, Production migration/deploy/push `0`; closeout commit은 Human/AO가 승인한 단일 bounded commit만 허용한다. Runtime role은 `ai_mls_production_runtime`이며 migration credential, raw `DATABASE_URL`, SQLite Production fallback, privilege 확대, dependency/lockfile/schema 변경이 없다. Production physical pool topology는 기존 단일 pool 구조를 유지하며 live Production 연결로 측정하지 않았다.

상세 증빙과 잔여 prerequisite는 [R3-B5 Completion Report](../reviews/REL002_R3B5_COMPLETION_REPORT.md)를 따른다.
