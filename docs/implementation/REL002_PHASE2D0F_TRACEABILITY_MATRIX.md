# REL-002 Phase 2D-0F Production Executable / Readiness / PostgreSQL Role Artifact Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-338 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture / Development Owner |
| 기준 Main | `aff2b1a1377faba75b30e78faede913a130266ba` |

## 1. 구현 추적

| 요구사항 | 구현 | 검증 | 상태 |
|---|---|---|---|
| Production executable | `apps/api/src/production-main.ts` | `production-main.test.ts` | PASS |
| canonical `startProductionRuntime()` 1회 호출 | `runProductionMain()` | startup count / readiness ordering test | PASS |
| Railway `PORT` binding | `parseRailwayProductionRuntimeConfiguration()` + `createProductionRuntimeListenerStarter()` | parsed port composition test | PASS |
| `GET /readyz` bounded handler/listener artifact | `production-readiness-http.ts` | READY / NOT_READY / 405 / safe-body tests | PASS |
| canonical application + `/readyz` same-listener integration | `ProductionHttpHost`가 API-014/API-015 handler와 `/readyz`를 one listener에 mount | `production-readiness-http.test.ts` | PASS — Phase 2D-0H successor evidence |
| graceful `SIGTERM` / `SIGINT` | `runProductionMain()` | idempotent shutdown tests | PASS |
| exact Railway variables | `production-runtime-configuration.ts` | mandatory / exact-value / fail-closed tests | PASS |
| pool / timeout / TLS | `createProductionPostgreSqlPoolOptions()`와 `PgConnectionPoolAdapter` | exact mapping / invalid bound tests | PASS |
| runtime role artifact | `002_runtime_role_grants.sql` | static least-privilege negative test | PASS |
| migration operator artifact | `003_migration_operator_role_grants.sql` | role separation static test | PASS |
| SQLite Production rejection | existing `assertCanonicalProductionChildRootsPostgreSqlReady()` | `production-bootstrap.test.ts` | PASS |

## 2. 안전 경계

| 경계 | 결과 |
|---|---|
| Production connection | `0` |
| Production DB writes | `0` |
| SQL role execution | `0` |
| Migration execution | `0` |
| Railway deploy | `0` |
| Credential / secret value 기록 | `0` |
| `SECRET_BACKEND_EXECUTION` | `BLOCKED` |
| SQLite Production fallback | `0` |

실제 executable의 기본 composition은 physical secret-value backend가 승인되지 않은 상태에서 PostgreSQL pool을 열기 전에 fail closed한다. Phase 2D-0H에서 API-014/API-015 child roots를 handler-owning root로 전환하고 `/readyz`와 함께 단일 Production listener에 합성했다. 독립 Production listener 또는 duplicate/missing root composition은 fail closed한다.

## 3. 잔여 조건

- **OPEN DECISION:** runtime-only physical secret-value backend 선택과 실행 승인은 별도 AO gate가 필요하다.
- Production Supabase role creation/grant 실행, Railway variable 설정, deployment, migration은 본 구현 범위가 아니다.
- PostgreSQL로 전환되지 않은 canonical child roots가 있으므로 실제 Production startup readiness를 주장하지 않는다.
- 실제 Supabase/Railway 연결·배포 및 physical secret backend는 계속 별도 승인 대상이다.

## 4. Disposition

`APPROVE_REL002_PHASE2D0F_EXECUTABLE_READINESS_ROLE_IMPLEMENTATION` — repository-side salvage completed by Phase 2D-0H; live execution remains externally gated.

## 5. 관련 문서

- [Phase 2D-0E Implementation Plan](REL002_PHASE2D0E_IMPLEMENTATION_PLAN.md)
- [Phase 2D-0E Executable Design](REL002_PHASE2D0E_PRODUCTION_EXECUTABLE_DESIGN.md)
- [Phase 2D-0F Completion Report](../reviews/REL002_PHASE2D0F_COMPLETION_REPORT.md)
- [Phase 2D-0H Completion Report](../reviews/REL002_PHASE2D0H_COMPLETION_REPORT.md)

## 6. Production role-boundary execution addendum — 2026-09-29

Section 2의 SQL role execution `0`과 Section 3의 미실행 상태는 이 matrix 작성 당시의 역사 기록이다. Main `5b9421dd9b76e9ca728600a460dcd484df141e02`에서 canonical `011` transaction이 `COMMIT PASS`했고 final `004` verification이 모든 expected invariant에 PASS했다.

| Trace | Artifact/evidence | Current status |
|---|---|---|
| Explicit SET-authority recovery | `011_complete_production_runtime_role_boundary_with_explicit_set_authority.sql` | `PRODUCTION_EXECUTION_PASS` |
| Final Production role verification | `004_production_role_privilege_verification.sql` | `PRODUCTION_FINAL_VERIFICATION_PASS` |
| Membership cleanup | no residual `postgres`-granted temporary membership | PASS |
| Runtime DB/schema/table/function boundary | final `004` exact checks | PASS |
| DEC-192 TEMPORARY contract | effective `TRUE`, direct `FALSE` | PRESERVED |
| Canonical evidence | [Production Role Boundary Execution Evidence](../evidence/REL002_PRODUCTION_ROLE_BOUNDARY_EXECUTION_EVIDENCE.md) | FINALIZED |

Bounded disposition: `PRODUCTION_ROLE_BOUNDARY = CLOSED`. 다른 Production readiness 또는 deployment gate는 이 addendum로 자동 변경하지 않는다.
