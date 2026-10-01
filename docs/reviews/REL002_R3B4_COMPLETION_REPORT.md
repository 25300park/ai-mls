# REL-002 R3-B4 API-018 Connector PostgreSQL Persistence Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-258 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 완료일 | 2026-10-01 |
| Brief | REL-002 R3-B4 — API-018 Connector PostgreSQL Persistence |
| 기준 Main | `69829e93f78cacea726079089cf58f8a1be0a5a3` |

## 1. Objective

API-018 Connector의 기존 durable execution, replay, checkpoint, evidence 및 recovery semantics를 canonical async persistence contract로 보존하면서 `app_connector` PostgreSQL adapter를 구현한다. API-014/API-015 READY를 유지하고 API-019/FEAT-022는 fail-closed로 유지한다.

## 2. Documents read

- [R3-B0 Architecture](../implementation/REL002_R3B0_POSTGRESQL_ASYNC_PERSISTENCE_ARCHITECTURE.md)
- [R3-B0 Governance Disposition](../implementation/REL002_R3B0_GOVERNANCE_DISPOSITION_PACKET.md)
- [R3-B1 Traceability](../implementation/REL002_R3B1_TRACEABILITY_MATRIX.md)
- [R3-B2 Traceability](../implementation/REL002_R3B2_TRACEABILITY_MATRIX.md)
- [R3-B3 Traceability](../implementation/REL002_R3B3_TRACEABILITY_MATRIX.md)
- [Document Governance](../00_DOCUMENT_GOVERNANCE.md) 및 [Glossary](../00_GLOSSARY.md)

## 3. Files created

- `modules/source/src/connector-async-persistence.ts`: canonical async port와 SQLite parity adapter
- `modules/source/src/connector-postgresql-persistence.ts`: API-018 PostgreSQL transaction/UoW adapter
- `modules/source/src/connector-async-persistence.test.ts`: SQLite async parity proof
- `modules/source/src/connector-postgresql-persistence.test.ts`: transaction, rollback, ACL-compatible replay, ambiguous commit proof
- `apps/api/src/rel002-r3b4-connector-postgresql.integration.test.ts`: disposable PostgreSQL lifecycle/concurrency proof
- [R3-B4 Traceability Matrix](../implementation/REL002_R3B4_TRACEABILITY_MATRIX.md)
- 본 completion report

## 4. Files modified

- Connector coordinator/runtime/application/host/HTTP/recovery와 관련 tests: async persistence call chain 전파
- Connector composition: Local/Test SQLite async adapter와 Production/Staging shared-pool PostgreSQL 선택
- Production child-root registry/readiness/main: exact `app_connector` readiness 이후 API-018 boundary READY
- `modules/source/src/index.ts`: 승인된 async/PostgreSQL persistence export
- [Master Index](../00_MASTER_INDEX.md): R3-B4 문서 등록

## 5. Key decisions added

- 새 architecture decision은 추가하지 않았다. 승인된 DEC-195~198과 CR-030 implementation direction을 구현한다.
- API-018 PostgreSQL persistence는 `ProductionBootstrap` 소유 `PG_PRODUCTION_POOL` 하나를 재사용한다.
- Append-only `connector_results`는 invocation row lock 아래 조회하며 UPDATE 권한이 필요한 `FOR UPDATE`를 요구하지 않는다.
- Production/Staging은 PostgreSQL만 허용하고 Local/Test는 기존 SQLite semantics를 같은 async contract로 유지한다.
- lease, invocation, technical record 쓰기는 모두 scope row를 먼저 잠그며 release/acquire 및 expiry/acquire 경쟁에서도 교착을 외부 오류로 노출하지 않는다.

## 6. Open decisions

- **OPEN DECISION:** API-019/FEAT-022 PostgreSQL adapter와 activation은 각 후속 승인 단계에서만 수행한다.
- **OPEN DECISION:** 전체 Production deployability는 남은 identity/service/startup/worker 및 external prerequisites가 닫힌 뒤 재평가한다.

## 7. Inconsistencies found

- 최초 PostgreSQL replay integration에서 append-only `connector_results`에 `FOR UPDATE`를 사용해 승인된 runtime ACL과 충돌했다. 회귀 test RED를 고정한 뒤 invocation row lock만 유지하는 최소 수정으로 해소했다.
- R3-B1 Connector schema/migration/ACL defect는 발견되지 않아 해당 artifact를 변경하지 않았다.

## 8. Validation performed

| 검사 | 방법 | 결과 |
|---|---|---|
| Focused | Connector async/PostgreSQL/runtime/recovery/API/composition | `79/79 PASS` |
| Affected | Source/API | `396 PASS / 3 environment-gated SKIP / 0 FAIL` |
| Disposable PostgreSQL | PostgreSQL 18.4, loopback `127.0.0.1:55450` | `1/1 PASS`; exact-key concurrency, release/acquire, expiry/acquire, stop/data removal/port closure PASS |
| Full regression | compiled repository suite | `1644 PASS / 1 authorized historical failure / 9 SKIP` |
| Build / Lint / Typecheck | canonical scripts | PASS |
| Scope | dependency/lockfile, migration/schema, 다른 child-root 활성화 확인 | PASS |
| `git diff --check` | Git whitespace check | PASS |
| Secret scan | 27 changed files | 0 findings |
| Independent review | bounded implementation review | `READY`; Critical/Important/Minor `0/0/0` |

## 9. Known limitations

- Production/Supabase migration 실행, Production connection, Railway deployment는 수행하지 않았다.
- API-018 persistence/composition boundary는 repository candidate에서 READY지만 실제 Connector execution dependencies는 기존 startup prerequisite가 충족되기 전까지 fail-closed다.
- 전체 Production deployability는 API-019/FEAT-022 및 기존 external/startup prerequisites 때문에 `BLOCKED`다.

## 10. Next brief prerequisites

AO review와 별도 closeout authorization 전에는 commit하지 않는다. 후속 R3-B 단계는 별도 Brief 승인 후에만 시작한다.

## Completion statement

R3-B4 구현 candidate는 focused, affected, disposable PostgreSQL 및 full regression gate를 통과했고 independent review는 `READY`이다. AO closeout 대상으로 보고하며, Production/Railway/Supabase mutation은 `0/0/0`이고 다음 Brief는 시작하지 않았다.
