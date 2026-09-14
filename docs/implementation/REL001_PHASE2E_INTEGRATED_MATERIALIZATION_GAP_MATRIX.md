# REL-001 Phase 2E Integrated Materialization Gap Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-122 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Audit Owner / Quality Owner |
| 기준 commit | `099bddc9cad4aa20b4d7db791ca28c01adb9f6c3` |

## 1. 범위

Phase 2E는 기존 in-process Staging 경로를 검증하고 구체적인 RED가 증명한 결함만 최소 보강한다. 새 Audit 의미, scheduler, queue, public HTTP, API-017, Client / Requirement, dependency 또는 cross-domain persistence owner를 추가하지 않는다.

## 2. Six-source gap matrix

| Source | Domain mutation → durable v2 | v2 source port | API-016 materialization | 현재 gap | 조치 |
|---|---|---|---|---|---|
| Source Registry | Source store 직접 테스트 PASS | Phase 2D adapter 존재 | snapshot 기반 composition PASS | 실제 mutation부터 final event까지 단일 assertion 없음 | 실제 mutation E2E 추가 |
| Intake | Intake store 직접 테스트 PASS | Phase 2D adapter 존재 | snapshot 기반 composition PASS | 동일 | 실제 mutation E2E 추가 |
| Property | SYSTEM_BOUND store 직접 테스트 PASS | Phase 2D adapter 존재 | snapshot 기반 composition PASS | 동일 | SYSTEM_BOUND 실제 mutation E2E 추가 |
| Listing | derived tenant/team store 직접 테스트 PASS | Phase 2D adapter 존재 | snapshot 기반 composition PASS | 동일 | 실제 mutation E2E 추가 |
| Contact | direct tenant store 직접 테스트 PASS | Phase 2D adapter 존재 | snapshot 기반 composition PASS | 동일 | 실제 mutation E2E 추가 |
| Matching | derived tenant/team store 직접 테스트 PASS | Phase 2D adapter 존재 | snapshot 기반 composition PASS | 동일 | 실제 mutation E2E 추가 |

## 3. Cross-cutting gaps

| Invariant | 기존 evidence | Gap | Phase 2E disposition |
|---|---|---|---|
| v1 isolation | store/materializer 직접 PASS | 실제 6-source path에서 rewrite `0` 통합 evidence 보강 필요 | 테스트 |
| Client / Requirement exclusion | closed source list PASS | integrated path에서 source count `0` 재검증 | 테스트 |
| replay/restart/collision | seeded-row composition PASS | 실제 mutation identity 기반 검증 없음 | 테스트 |
| chronology/provenance/visibility | field equality PASS | 실제 mutation-generated intent 기반 검증 없음 | 테스트 |
| append-only final event | SQLite trigger 직접 PASS | six-source final event에 대한 update/delete 거부 연결 evidence 보강 | 테스트 |
| failed materialization | materializer rollback PASS | source intent durability/retryability 연결 evidence 없음 | 테스트 |
| source-port safety | version/source filter만 존재 | malformed v2 row가 port에서 노출 가능 | RED 후 최소 validator 보강 후보 |
| health/readiness | startup/reopen `HEALTHY/READY` PASS | closed/unavailable fail-closed 통합 확인 필요 | 테스트 |
| `IMMUTABLE_REFERENCE` resolver 없음 | known limitation | Staging composition에서 반드시 `INTENT_INVALID`; default principal 금지 | fail-closed 테스트, resolver 추가 없음 |
| unsafe diagnostics | bounded errors 개별 PASS | integrated failure의 raw path/SQL/secret 노출 방지 확인 필요 | 테스트 |
| direct Core final event | source-store architecture PASS | Phase 2E에서도 API-016 owner 유지 확인 필요 | architecture assertion |

## 4. 설계 결론

우선 실제 six-source mutation E2E와 negative matrix를 RED로 작성한다. Production 변경 후보는 generic `createAuditIntentSourcePort()`의 strict validation뿐이며, 해당 RED가 현재 malformed v2 노출을 실제로 증명할 때만 적용한다. `IMMUTABLE_REFERENCE` resolver는 만들거나 기본값으로 대체하지 않는다.
