# REL-001 Phase 5 Admin Console Staging Bootstrap Implementation Plan

> **For agentic workers:** Execute this plan only after separate implementation authorization, using the repository TDD and verification gates.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-228 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Administration Owner |

**Goal:** 기존 six-screen Console을 Phase 0 topology와 Phase 1D/2/3/4 owning boundaries에 결합해 fail-closed REL-001 Staging executable로 만든다.

**Architecture:** `Admin Console Process -> configured local Staging Platform Host -> owning API/application ports`. Console은 persistence, credentials와 business authority를 소유하지 않는다. Existing renderer/server/adapters를 확장하고 Development composition을 보존·격리한다.

**Tech Stack:** Node.js 24, TypeScript, existing Node HTTP/server-rendered HTML/CSS/client script, built-in SQLite owners. 새 package 없음.

**Spec:** [Inventory](REL001_PHASE5A_ADMIN_CONSOLE_STAGING_INVENTORY.md), [Screen mapping](REL001_PHASE5A_CONSOLE_SCREEN_RUNTIME_MAPPING.md), [Session matrix](REL001_PHASE5A_SESSION_AUTH_BOOTSTRAP_MATRIX.md), [Backend matrix](REL001_PHASE5A_BACKEND_BOUNDARY_READINESS_MATRIX.md), [Gap matrix](REL001_PHASE5A_STAGING_BOOTSTRAP_GAP_MATRIX.md).

## Global constraints

- Required screen set은 UI-006/031/032/033/035/036뿐이다.
- UI-034와 나머지 dependency-gated screens를 활성화하지 않는다.
- 새 API ID/operation, role/capability, state, auth protocol, Audit vocabulary, dependency/network/credential 사용은 없다.
- `UNKNOWN`/`NOT_READY`/`UNAVAILABLE`을 READY 또는 business success로 변환하지 않는다.

### Task 1: Staging configuration and composition RED

**Files:** Modify `apps/admin-console/src/console-configuration.ts`, `console-composition.ts`; create focused `*.test.ts` only when authorized.

RED tests: exact `STAGING`, explicit listener/Platform Host origin, unknown-field rejection, Development Session rejection, no hardcoded tenant/principal/session, missing dependency fail closed. Confirm current parser/composition fails for expected missing Staging path.

Minimum GREEN: add `Rel001AdminConsoleStagingConfiguration` parsing and a separate Staging composition that requires injected Session/backend ports. Do not weaken Development isolation.

### Task 2: Trusted Session ingress

**Files:** Modify existing Console server/composition and Phase 1D adapters only as RED proves necessary.

RED tests: missing/revoked/expired/idle/absolute Session, stale MFA on UI-036, tenant/scope override, unauthorized refresh, process-local Development authority. Minimum GREEN forwards only trusted `x-session-id` to Platform Host and uses existing durable Session/access coordinator. No login/token issuance.

### Task 3: Existing API-015 composition

**Files:** Reuse `administration-console-http-client.ts`, `administration-console-read-adapter.ts`, `apps/api/src/administration-production-composition.ts`.

RED tests prove the Staging root currently leaves UI-006/036 unavailable. Minimum GREEN wires existing closed API-015 reads/commands, selector scopes, live auth/MFA/SoD/version/idempotency. No API-015 semantic edits.

### Task 4: API-016 safe scoped read

**Files:** Extend the API-016 owner/application adapter and existing Console `auditQueryPort` only.

RED tests: direct store access, cross-tenant/scope data, chronology/source-link loss, raw unsafe evidence, unbounded query. Minimum GREEN exposes existing API-016 query semantics over durable events through Platform Host and reconstructs immutable safe DTOs. No new Audit event vocabulary.

### Task 5: API-017 and FEAT-022 status projection

**Files:** Extend existing Host-owned status/read port and `ConsoleReadAdapter`; do not add UI-034 route.

RED tests: provider-independent READY collapsed with live provider; live provider shown READY; DEC-162/external hold hidden; caller-supplied Job/provider status; cross-scope read. Minimum GREEN projects API-017 runtime/readiness and FEAT-022 split status using existing enums. Exact Job collection/action screen remains blocked.

### Task 6: Complete existing read-port composition

**Files:** Modify `console-composition.ts`, `main.ts`, and existing Console adapter wiring.

Wire API-014/018/019/F19/FEAT-023/024 existing read ports through Platform Host. A missing optional dependency produces bounded `UNAVAILABLE`; mandatory Session/API-015/API-016/API-017 dependency prevents end-to-end readiness.

### Task 7: Renderer, security and accessibility preservation

**Files:** Modify existing renderer/client only if a failing test proves the need.

Verify six screen identities, existing 13 routes, keyboard/focus/labels, escaped errors, no credential/prompt/provider/SQL/path/stack leakage, no new mutation controls except existing UI-036 controlled flow, UI state/runtime state separation.

### Task 8: Integrated Staging verification and evidence

Run focused config/session/composition tests, six-screen/browser tests, API-015/016/017 affected tests, FEAT-020/021/023/024 regression, then full suite once, lint, typecheck, clean build, verify constituents, architecture checksum, `git diff --check`, Gitleaks and independent review. Update RTM/report with actual results only. Dependency audit requires separate scoped network approval.

## Mandatory implementation stop

If a new API operation, public Core transport semantic, UI-034 contract, auth/token model, role/capability, state, provider credential architecture or package is required, stop and request AO review instead of extending scope.
