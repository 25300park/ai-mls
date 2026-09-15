# REL-001 Phase 5B Admin Console Staging Bootstrap Plan

> **For agentic workers:** Execute this plan with `superpowers:executing-plans`, preserving RED → minimum GREEN and the bounded verification gates below.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-229 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Administration Owner |

## 목표

기존 six-screen Console을 REL-001 Staging에서 실행 가능하게 만들되, Console은 Session·API·persistence·provider authority를 소유하지 않고 기존 Platform Host 경계만 소비한다.

## 구조

`Browser → trusted Staging ingress-injected x-session-id → existing Console server → injected Staging Platform Host read/command ports → owning API/application boundaries`

- Staging에서는 고정 Development Session을 사용하지 않는다.
- browser JavaScript는 Session identifier를 취급하지 않는다. trusted ingress carrier가 없으면 직접 요청은 fail closed 한다.
- `tenantId`와 `scopeRef`는 명시적 Staging 구성에서만 오며 browser query/body가 덮어쓰지 못한다.
- API-015는 기존 HTTP adapter/client를 그대로 사용한다.
- API-016/017은 Console-safe read/status port를 통해서만 접근한다. Console의 durable store import는 금지한다.
- FEAT-022는 provider-independent `READY`, live provider `NOT_READY`, external dependency, `DEC-162=IN_REVIEW`를 presentation projection으로만 표시한다.
- UI-006의 Core API-001/002 정보는 `DEFERRED`/`UNAVAILABLE`로 유지한다.

## Task 1 — Staging configuration and ingress RED

**Files:** `apps/admin-console/src/console-configuration.ts`, `apps/admin-console/src/console-server.ts`, focused tests.

1. RED: Staging parsing 부재, 고정 Development Session 사용, missing/revoked/expired Session disclosure, tenant/scope override를 증명한다.
2. GREEN: explicit `STAGING` configuration과 per-request `x-session-id` carrier를 추가한다.
3. Development composition과 기존 tests를 보존한다.

## Task 2 — Six-screen Platform Host composition RED/GREEN

**Files:** `apps/admin-console/src/console-composition.ts`, new bounded staging adapter/tests.

1. RED: mandatory Session/API-015/API-016/API-017/FEAT-022 port가 없어도 READY가 되는 결함을 증명한다.
2. GREEN: six screens를 기존 adapters에만 라우팅하고 missing mandatory boundary는 fail closed 한다.
3. UI-034 또는 새 route/screen을 추가하지 않는다.

## Task 3 — API-015 controlled read/write preservation

1. UI-006/UI-036가 기존 `AdministrationConsoleReadAdapter`를 사용함을 검증한다.
2. Staging `x-session-id`가 API-015에 전달되고 browser actor/tenant/scope 입력은 권한 근거가 되지 않음을 검증한다.
3. 기존 MFA/SoD/version/idempotency는 backend authority로 유지한다.

## Task 4 — API-016 and API-017 safe reads

1. UI-035는 injected API-016 Console read port만 사용한다.
2. Operations supporting view는 injected API-017 status port를 사용하며 Job store를 import하지 않는다.
3. chronology, lineage, safe failure classification은 owning port DTO를 그대로 bounded projection하며 raw errors는 safe error로 정규화한다.

## Task 5 — FEAT-022 truth and readiness

1. provider-independent `READY`와 live provider `NOT_READY`를 분리한다.
2. `EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY`, `DEC-162=IN_REVIEW`를 보존한다.
3. required backend가 하나라도 unavailable이면 global Staging readiness를 `READY`로 만들지 않는다.

## Task 6 — Security, accessibility, and regression

1. missing/revoked/expired/unauthorized Session, RBAC/MFA, tenant/scope, unsafe diagnostics를 focused test한다.
2. 기존 renderer/client keyboard, focus, label, controlled-write confirmation tests를 재사용한다.
3. focused → affected → full regression once → lint/typecheck/build/verify constituents → architecture/checksum → diff check → Gitleaks → independent review 순으로 검증한다.

## 산출물

- `REL001_PHASE5B_SCREEN_EXECUTION_TRACEABILITY.md`
- `REL001_PHASE5B_BACKEND_WIRING_MATRIX.md`
- `REL001_PHASE5B_COMPLETION_REPORT.md`
- REL-001/FEAT-020/FEAT-021 traceability 및 Master Index의 실제 evidence만 갱신

## Stop boundary

새 screen/API/role/capability/auth protocol/Core transport/provider credential architecture/Audit vocabulary/dependency/network가 필요하면 즉시 중단한다. Phase 5B closeout 승인 전 commit/push/main integration은 수행하지 않는다.
