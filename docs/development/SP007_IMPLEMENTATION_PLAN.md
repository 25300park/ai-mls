# SP-007 구현 계획

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-SP007-PLAN |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| Sprint | SP-007 |
| 승인 근거 | SP-007 Implementation Brief v1.0 + AO-012–AO-016 |

## Goal

`FEAT-013`, `DEV-013`, `IMP-013`, `API-012`와 `UI-028`, Permission 부분의 `UI-026/032`를 구현한다.

## Architecture

`modules/permission`이 exact subject revision, field scope, purpose, audience, validity, Verification dependency, immutable lifecycle/history와 effective Permission 계산을 소유한다. `apps/api`의 `PermissionApi`는 session-derived Actor, safe errors와 framework-neutral accessible UI projection을 제공한다. 기존 `AuthorizationService`, `AuditLog`, `VerificationService` read port와 `AI-007` validator를 재사용하고 Proposal, Publication Approval, Publication 또는 external delivery를 생성하지 않는다.

## Tech Stack

TypeScript `6.0.3`, Node.js `24.18.0`, pnpm `11.9.0`, `node:test`, strict TypeScript project references.

## Global Constraints

- Permission decision authority는 `PMR`만 가진다. `REV`는 review support만 수행한다.
- `MGR` override는 MFA, documented reason, immutable audit가 있는 same-actor Verification/Permission exception에만 사용한다. MGR은 Permission decision을 대신하지 않는다.
- Permission type, purpose, audience는 Brief의 closed vocabularies만 허용한다.
- Permission validity는 type default와 Verification field validity 중 이른 시각을 넘지 않는다.
- Raw Contact value는 state, log, audit/history reason, error 또는 AI contract에 포함하지 않는다.
- Frozen Architecture Bible/governance/registry, `.env`, NAS, infrastructure와 database schema는 변경하지 않는다.
- `FEAT-014/015`, `API-013/014`, `UI-025/029/030/031`, SP-008 기능은 구현하지 않는다.

---

### Task 1: Permission Domain and Verification Boundary

**Files:**
- Create: `modules/permission/src/permission-service.test.ts`
- Create: `modules/permission/src/permission-service.ts`
- Create: `modules/permission/src/index.ts`

**Interfaces:**
- Consumes: `AuthorizationService`, `AuditSink`, `Clock`, `IdFactory`, `validateAdvisoryResult`, read-only `VerificationResolver`.
- Produces: `PermissionService` request/review/decide/revoke/expire/successor/read/history/effective/list/validate operations.

- [x] Write domain tests for lifecycle, exact revision, scope/purpose/audience isolation, validity capping, Verification invalidation, successor immutability, idempotency, version conflicts and privacy.
- [x] Run `pnpm.cmd test` and verify failure because `modules/permission` is missing.
- [x] Implement closed vocabularies and immutable Permission aggregate with `DRAFT → UNDER_REVIEW → ACTIVE/REJECTED` and `ACTIVE → EXPIRED/REVOKED/SUPERSEDED`.
- [x] Implement effective checks that require exact valid Verification scope/revision and never mutate Verification.
- [x] Run `pnpm.cmd test` and verify domain tests pass with all existing regression tests.

### Task 2: Authorization and AI-007 Boundary

**Files:**
- Modify: `modules/authorization/src/authorization-service.test.ts`
- Modify: `modules/authorization/src/authorization-service.ts`
- Test: `modules/permission/src/permission-service.test.ts`

**Interfaces:**
- Consumes: canonical `RoleCode` registry without additions.
- Produces: `permission.request/read/review/decide/revoke/expire` capability decisions and privileged obligations.

- [x] Add failing authorization tests for PMR-only decision, REV support, read-context roles, self-permission, service/scheduler/AI rejection, cross-team scope and MFA manager-override evidence.
- [x] Run focused compiled tests and confirm expected capability failures.
- [x] Add only the API-012 capabilities required by the approved role matrix; keep MGR/SEC/ADM oversight non-authoritative.
- [x] Verify AI-007 validates closed evidence summaries without changing Permission state.
- [x] Run domain and authorization regression tests.

### Task 3: API-012 and UI-026/028/032 Contracts

**Files:**
- Create: `apps/api/src/permission-api.test.ts`
- Create: `apps/api/src/permission-api.ts`
- Modify: `apps/api/src/composition.ts`
- Modify: `apps/api/src/contracts.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: `PermissionService` port and session reader.
- Produces: API-012 session-bound responses plus accessible `UI-026`, `UI-028`, `UI-032` Permission views.

- [x] Add failing API/UI tests for session-derived Actor, create/read/review/grant/deny/revoke/effective/history, safe errors, role-visible actions, masking and accessibility metadata.
- [x] Run `pnpm.cmd test` and verify failure because `PermissionApi` and composition member are absent.
- [x] Implement API boundary and only the three approved screen projections.
- [x] Add stable public Permission error codes without exposing restricted values.
- [x] Compose/export `PermissionApi` without replacing API-001–011 modules.
- [x] Run API tests and full regression.

### Task 4: Evidence, Gates and Completion

**Files:**
- Create: `docs/development/SP007_TEST_EVIDENCE.md`
- Create: `docs/reviews/SP-007_COMPLETION.md`

**Interfaces:**
- Consumes: final test/gate output and git scope diff.
- Produces: SP-007 trace, security, AI-boundary and DoD evidence.

- [x] Record exact tests, counts, feature/API/UI/security mappings and scope exclusions.
- [x] Run `pnpm.cmd lint`, `pnpm.cmd typecheck`, `pnpm.cmd test`, `pnpm.cmd build`, `pnpm.cmd verify`.
- [x] Run `gitleaks detect --source . --config .gitleaks.toml --redact` and `pnpm.cmd audit`.
- [x] Verify frozen docs, `.env`, NAS and SP-008 artifacts have no changes.
- [ ] Create `feat(sp-007): permission authority` as the single completion commit.
- [ ] Verify final working tree is clean and report the commit hash.

## Self-review

- Brief sections 1–19 map to Tasks 1–4 without introducing new RoleCode, entity, Requirement ID, Security ID or downstream API.
- All behavior changes start with a failing test.
- Purpose/audience/type values and validity periods match the approved Brief exactly.
- Manager override does not grant MGR Permission decision authority; it records the approved SoD exception context for a PMR decision.
- No provider, model, prompt, confidence threshold, persistence or infrastructure decision is introduced.
