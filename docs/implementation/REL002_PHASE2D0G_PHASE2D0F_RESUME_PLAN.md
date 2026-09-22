# REL-002 Phase 2D-0G Phase 2D-0F Resume Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-343 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Development Owner |
| 기준 Main | `aff2b1a1377faba75b30e78faede913a130266ba` |
| 선행 결정 | DEC-188 ratification 필요 |

## 1. Goal

기존 Phase 2D-0F 구현을 보존하면서 API-014, API-015와 `/readyz`를 정확히 하나의 Railway listener에 연결하고 2D-0F의 same-listener blocker만 닫는다.

## 2. Planned file boundary

| 작업 | 예상 파일 | 결과 |
|---|---|---|
| prepared handler roots | `apps/api/src/composition.ts`, `apps/api/src/administration-production-composition.ts` | API-014/015 handler와 lifecycle을 listener에서 분리 |
| closed shared host | `apps/api/src/production-readiness-http.ts` 또는 bounded successor | exact route table + one Node listener |
| root contract | `apps/api/src/production-bootstrap.ts`, `apps/api/src/production-child-root-registry.ts` | child listener exposure 제거, handler port 제공 |
| startup/shutdown ordering | `apps/api/src/production-bootstrap-engine.ts` | ratified shared bind → activation/worker → READY; close는 listener → workers/roots 순서로 교정 |
| executable wiring | `apps/api/src/production-main.ts` | existing signal/30s shutdown 재사용 |
| tests | directly corresponding `*.test.ts` | RED/GREEN 및 affected regression |

## 3. Execution sequence after AO approval

1. RED: API-014와 API-015 root가 두 listener를 노출하는 현재 blocker를 고정한다.
2. RED: one PORT에서 `/readyz`, API-014, API-015가 함께 동작하지 않음을 증명한다.
3. RED: route collision/duplicate registration, pre-gate bind, authorization crossover, unsafe fallback를 검증한다.
4. 최소 변경으로 Production prepared handler root contracts를 추가한다.
5. exact closed multiplexer와 shared listener owner를 구성한다.
6. root registry에서 API-014/API-015 listener ownership을 제거한다.
7. GREEN: one listener, exact route/method, readiness, authority preservation, safe 404/405를 확인한다.
8. RED로 현재 workers-first cleanup을 고정한 뒤 listener-first shutdown, restart, bind-failure 및 active-request behavior를 검증한다.
9. API-014, API-015, Production bootstrap, Session/Auth affected regression을 실행한다.
10. Full regression, lint, typecheck, clean build, architecture, gitleaks, document/link validation 및 independent review를 한 번 수행한다.

## 4. Acceptance criteria

- Production listener count `1`
- child Production listener count `0`
- `/readyz` same listener `YES`
- API-014/API-015 exact routes 모두 PASS
- route collision/override `0`
- business authority changes `0/0`
- listener bind before gate PASS `0`
- new API/role/capability/dependency/persistence `0`
- existing 2D-0F config, executable, shutdown, role artifacts regression PASS

## 5. Stop conditions

AO ratification 없는 DEC-188 구현, route collision, new business route/API ID, new authorization middleware authority, second listener, dependency 추가 또는 Production/network/credential operation이 필요하면 중단한다.

## 6. Current execution state

`COMPLETED_BY_PHASE_2D_0H`. Architecture Owner가 DEC-188과 2D-0H implementation을 승인했고 successor evidence는 Phase 2D-0H Completion Report에 기록한다.

## 7. 관련 문서

- [Same-Listener Design](REL002_PHASE2D0G_SAME_LISTENER_COMPOSITION_DESIGN.md)
- [HTTP Listener Lifecycle](REL002_PHASE2D0G_HTTP_LISTENER_LIFECYCLE.md)
- [Completion Report](../reviews/REL002_PHASE2D0G_COMPLETION_REPORT.md)
