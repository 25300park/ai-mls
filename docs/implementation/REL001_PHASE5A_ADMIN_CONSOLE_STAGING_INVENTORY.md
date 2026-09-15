# REL-001 Phase 5A Admin Console Staging Inventory

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-222 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Administration Owner |
| 기준 baseline | `4be72f53d6ccd686b333454f8ff95565b57bdfd3` |

## 1. 목적과 범위

기존 Admin Console, FEAT-020/021, Phase 1D/2/3/4 경계를 REL-001 `Staging` topology와 대조한다. 이 문서는 inventory이며 Production/Test 구현, 네트워크, credential 사용, 새 API/role/state를 만들지 않는다.

## 2. 현재 구현 inventory

| 구성요소 | 근거 | 현재 분류 | Staging 결손 |
|---|---|---|---|
| Console executable | `apps/admin-console/src/main.ts` | `EXECUTABLE` — Development 전용 | `STAGING` mode와 staging root 없음 |
| Console configuration | `console-configuration.ts` | `PARTIAL` | Development Session이 필수이고 tenant/session/principal이 process-local 고정값 |
| Console composition | `console-composition.ts` | `PARTIAL` | `composeDevelopmentAdminConsole()`만 존재; Platform Host composition 없음 |
| Browser/server shell | `console-server.ts`, `console-renderer.ts` | `EXECUTABLE` | Staging auth ingress와 backend dependency lifecycle 미결합 |
| Safe read projection | `console-read-adapter.ts` | `READ_ONLY_ONLY` | injected ports 일부가 Development composition에서 unavailable |
| UI-036 administration | API-015 HTTP client/read adapter | `EXECUTABLE` | Production API-015 origin과 Staging durable Session resolver를 함께 조립하는 root 없음 |
| Operations Console | FEAT-020 A~H | `EXECUTABLE` | Staging Platform Host의 실제 ports가 주입되지 않음 |
| Accessibility | FEAT-021 eligible scope | `EXECUTABLE` | 새 bootstrap에서도 동일 renderer/client contract 보존 필요 |
| Session boundary | Phase 1D durable Session UoW/access coordinator | `EXECUTABLE` | Console request ingress에 연결되지 않음 |
| API-015 | durable Application/HTTP/Node server composition | `EXECUTABLE` | Staging Platform Host/root에서 미조립 |
| API-016 | durable six-source materializer/store | `IN_PROCESS_ONLY` | Console-safe scoped query transport/composition 미조립 |
| API-017 | durable store, one-shot runtime, read-by-id | `IN_PROCESS_ONLY` | Console-safe status projection/transport 미조립; UI-034는 계속 dependency-gated |
| FEAT-022 provider-independent | AI-001/004/005 boundary | `EXECUTABLE` provider-independent | status projection 미조립 |
| FEAT-022 live provider | DEC-162 | `BLOCKED` | external account/contract dependency; `0/3 NOT_READY` |
| Core API-001~010 public transport | Phase 1F/1L | `BLOCKED` | HOLD; Phase 5에서 45 operations를 재개하지 않음 |

## 3. Phase 0 topology 적합성

Canonical flow는 `Admin Console Process -> Staging Platform Host -> bounded application/runtime ports`다. 저장소 검사에서 Console의 직접 persistence/provider SDK/Job Store/Audit store/credential/database 접근은 발견되지 않았다. 현재 shortcut은 authority 위반이 아니라 Development-only composition이다: process-local Session과 unavailable default adapter가 Staging root를 대신하고 있다. Staging 구현은 이 shortcut을 재사용하면 안 된다.

## 4. 전달과 실행 경계

- Browser delivery는 기존 Node server-rendered HTML/CSS/client script를 재사용할 수 있다.
- 별도 frontend framework, bundle system 또는 deployment infrastructure는 필요하지 않다.
- Console은 Platform Host의 approved local origin만 호출하고 `x-session-id`만 identity carrier로 전달한다.
- actor, tenant, role, capability, MFA 또는 purpose를 browser body/query의 권한 주장으로 수용하지 않는다.
- backend 장애는 해당 section을 `UNAVAILABLE`/safe error로 표시하며 global `READY`를 만들지 않는다.

## 5. 보안 및 상태 분리

`CONSOLE_READ_STATE`(`LOADING|READY|EMPTY|UNAVAILABLE|NOT_AUTHORIZED|ERROR`)는 Health/Readiness/Freshness, Job state, Publication state 또는 AI provider readiness가 아니다. Renderer는 immutable bounded DTO만 받고 HTML escape와 FEAT-023 unsafe-value 방어를 유지한다. API key, auth header, token, raw prompt/provider payload, chain-of-thought, SQL/SQLite, path, stack은 노출하지 않는다.

Canonical role은 Permission Matrix의 17 rows 중 `EXT`가 POST-MVP이므로 현재 executable internal baseline은 16 roles다. Phase 5A는 role/capability를 추가하지 않는다. 화면 visibility는 presentation only이며 privileged API-015 action은 backend live authorization, MFA와 SoD가 최종 권한이다.

## 6. 결론

Architecture와 provider-independent repository boundary는 준비됐지만 Staging executable root는 없다. 결손은 bounded bootstrap/wiring이며 canonical screen/API/authority redesign은 필요하지 않다. UI-034 및 나머지 30 dependency-gated screen은 이 단계에서 승격하지 않는다.

관련 문서: [Screen mapping](REL001_PHASE5A_CONSOLE_SCREEN_RUNTIME_MAPPING.md), [Session matrix](REL001_PHASE5A_SESSION_AUTH_BOOTSTRAP_MATRIX.md), [Backend readiness](REL001_PHASE5A_BACKEND_BOUNDARY_READINESS_MATRIX.md), [Gap matrix](REL001_PHASE5A_STAGING_BOOTSTRAP_GAP_MATRIX.md).
