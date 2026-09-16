# REL-001 Phase 5C Admin Console Integrated Verification Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-232 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Administration Owner |

## 목표

Phase 5B의 six-screen Staging Console을 하나의 runtime graph로 검증하고, 관측된 mandatory backend failure가 전역 readiness에 반영되지 않는 결함만 bounded hardening한다.

## 실행 순서

1. 기존 `1460/1460` baseline을 재현한다.
2. API-016 failure와 API-017 `NOT_READY`가 global readiness에 반영되지 않는 결함을 RED로 증명한다.
3. existing composition 내부에 process-local observation만 추가한다. 이는 authority나 durable truth가 아니며 성공한 후속 read로 갱신된다.
4. Session reload/restart가 매 요청 Phase 1D authority를 다시 조회하는지 검증한다.
5. Phase 5B, Session, API-015/016/017, provider truth, Console security/accessibility regression을 실행한다.
6. full regression과 repository gates를 한 번 수행하고 실제 evidence만 RTM/report에 기록한다.

## 변경 경계

- Production: existing `console-composition.ts`의 readiness observation만 변경한다.
- Test: existing Staging composition/ingress tests에 Phase 5C cases만 추가한다.
- API, screen, route, auth model, role/capability, persistence, provider, Audit vocabulary는 추가하지 않는다.
- live provider는 `NOT_READY`, `DEC-162`는 `IN_REVIEW`, Core API-001/002는 `DEFERRED`를 유지한다.

## 완료 조건

[Screen E2E Traceability](REL001_PHASE5C_SCREEN_E2E_TRACEABILITY.md)와 [Failure/Readiness Matrix](REL001_PHASE5C_FAILURE_READINESS_MATRIX.md)의 모든 bounded gate, full verification 및 independent review가 PASS/READY여야 한다. Dependency audit은 별도 승인 없이는 `NOT_RUN`이다.
