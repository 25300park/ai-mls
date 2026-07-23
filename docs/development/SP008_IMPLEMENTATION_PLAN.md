# SP-008 구현 계획

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-SP008-PLAN |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| Sprint | SP-008 |
| 승인 근거 | SP-008 Implementation Brief v1.0 + AO-018–AO-021 / DEC-096–DEC-099 |

## Goal

`FEAT-014`, `DEV-014`, `IMP-014`, `API-013`, `UI-029`, `UI-030`, `TEST-021`, `TEST-022`와 `TEST-033` SP-008 subset을 구현한다.

## Architecture

`modules/proposal`은 Client Proposal의 identity, lifecycle, `CLIENT_SHARING` Permission과 공유/피드백 evidence를 소유한다. `modules/publication-approval`은 versioned immutable representation snapshot, independent Publication Approval aggregate, exact prerequisite evaluation, actor-level SoD와 Effective Approval을 소유한다. `apps/api`의 `ProposalApprovalApi`는 두 namespace를 하나의 API-013 capability 아래 분리하고 session-derived Actor, safe errors와 UI-025/029/030 framework-neutral view contract를 제공한다.

FEAT-015-owned Publication Target/Channel은 injected read-only policy resolver로만 조회한다. Publication, connector, delivery, reconciliation과 external effect는 생성하지 않는다. 기존 in-memory immutable/versioned persistence pattern을 재사용하므로 schema 또는 migration은 없다.

## Tech Stack

TypeScript `6.0.3`, Node.js `24.18.0`, pnpm `11.9.0`, `node:test`, strict TypeScript project references.

## Global Constraints

- Human `PUA`만 claim/assignment/decision/revoke authority를 가지며 MGR/ADM/SEC/REV/OPS/SVC/AI는 이를 상속하지 않는다.
- Decision/revoke는 MFA, reason, exact version, idempotency, current prerequisite와 immutable audit를 요구한다.
- actor-level conflict는 role/session 변경과 무관하게 immutable actor ID로 평가한다.
- Snapshot은 FEAT-014 aggregate component이며 Publication 또는 delivery payload가 아니다.
- `CheckEffectiveApproval`은 exact current human Approval만 뜻하며 API-014 또는 connector를 호출하지 않는다.
- 기존 GOV-001 문서 변경을 보존하고 accepted architecture decisions를 수정하지 않는다.
- FEAT-015, API-014, UI-031+, external delivery/reconciliation과 dual-PUA quorum을 구현하지 않는다.
- Commit은 명시적 승인이 없으므로 생성하지 않는다.

---

### Task 1: Client Proposal domain

**Files:**
- Create: `modules/proposal/src/proposal-service.test.ts`
- Create: `modules/proposal/src/proposal-service.ts`
- Create: `modules/proposal/src/index.ts`

**Produces:** `ProposalService` create/read/review/share/feedback operations with immutable history, active `CLIENT_SHARING` Permission checks, idempotency and audit.

- [x] Write TEST-021 failures for create/read/review/share/feedback and authority isolation.
- [x] Run focused tests and confirm failure because the module is absent.
- [x] Implement the minimum closed Proposal lifecycle and immutable evidence.
- [x] Re-run focused tests and existing regressions.

### Task 2: Immutable Representation and Publication Approval domain

**Files:**
- Create: `modules/publication-approval/src/publication-approval-service.test.ts`
- Create: `modules/publication-approval/src/publication-approval-service.ts`
- Create: `modules/publication-approval/src/index.ts`

**Produces:** immutable/versioned representation snapshots; Approval request/claim/reassign-release/decide/revoke/expire/read/queue/review-context/effective/history operations.

- [x] Write TEST-022/033 failures for lifecycle, exact bindings, prerequisite failures, SoD, MFA, idempotency, expiry/revoke and no-delivery boundary.
- [x] Run focused tests and confirm failure because the module is absent.
- [x] Implement snapshots, Approval aggregate, read-only target/channel policy port and append-only histories.
- [x] Implement deterministic Effective Approval and recovery/replay revalidation without external effects.
- [x] Re-run focused tests and regressions.

### Task 3: Authorization and safe error vocabulary

**Files:**
- Modify: `modules/authorization/src/authorization-service.test.ts`
- Modify: `modules/authorization/src/authorization-service.ts`
- Modify: `apps/api/src/contracts.ts`

**Produces:** explicit Proposal/Publication Approval capabilities, privileged obligations and stable safe API-013 semantic errors.

- [x] Add failing authorization regressions for PUA-only authority, inheritance denial, scheduler-only expiry and Proposal/Approval separation.
- [x] Run focused tests and observe canonical capability failures.
- [x] Add only FEAT-014 actions to existing role capability tables and privileged/human action sets.
- [x] Add safe public error codes without exposing restricted evidence.
- [x] Re-run authorization and security regressions.

### Task 4: API-013 and UI contracts

**Files:**
- Create: `apps/api/src/proposal-approval-api.test.ts`
- Create: `apps/api/src/proposal-approval-api.ts`
- Modify: `apps/api/src/composition.ts`
- Modify: `apps/api/src/index.ts`

**Produces:** Proposal API operations; all ten canonical Approval operations; UI-025/029/030 accessible role-aware projections.

- [x] Add failing API tests for session-derived Actor, ten Approval operations, UI states/actions, masking, safe errors and no API-014 path.
- [x] Run focused tests and confirm missing API/composition member failure.
- [x] Implement the API façade and bounded UI projections.
- [x] Compose/export API-013 without replacing API-001–012.
- [x] Re-run API and full regression tests.

### Task 5: Evidence and gates

**Files:**
- Create: `docs/development/SP008_TEST_EVIDENCE.md`
- Create: `docs/reviews/SP-008_COMPLETION.md`
- Modify: `docs/governance/REQUIREMENTS_TRACEABILITY_MATRIX.md` (implementation evidence only)
- Modify: `docs/book-12/15_IMPLEMENTATION_REGISTRY.md` (post-freeze implementation progress overlay only)

**Produces:** SP-008 DoD evidence without changing accepted architecture.

- [x] Run targeted TEST-021/022/033 subset and required regressions.
- [x] Run lint, typecheck, test, build and aggregate verify.
- [x] Run Gitleaks and dependency audit.
- [x] Confirm docs/code scope, no migration, no `.env`/NAS/frozen-decision changes and no FEAT-015 artifact.
- [x] Record counts/results, RTM implementation evidence and completion recommendation.
- [x] Do not commit; report working tree and stop before FEAT-015.

## Self-review

- Brief sections 1–20 map to Tasks 1–5.
- Every production behavior starts with a failing test.
- Proposal and Publication Approval have separate identities, lifecycle, authorization, purpose and evidence.
- Exact snapshot/target/channel/policy/Verification/Permission bindings are represented without a Publication entity.
- Assignment does not create `PUA` authority; role stacking and session switching cannot remove actor conflict.
- TEST-033 is limited to API-013 gate/effective/idempotency/no-delivery behavior.
- No provider, connector, database, migration, infrastructure or FEAT-015 decision is introduced.
