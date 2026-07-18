# SP-001 Implementation Plan

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 문서 상태 | DRAFT |
| Sprint | SP-001 |
| Epic | EPIC-002, EPIC-008 |
| Feature | FEAT-001–003, FEAT-016, FEAT-017, FEAT-023 |
| Developer Task | DEV-001–003, DEV-016, DEV-017, DEV-023 |
| Implementation ID | IMP-001–003, IMP-016, IMP-017, IMP-023 |
| Test | TEST-005, TEST-006, TEST-009, TEST-026, TEST-034, TEST-046–049, TEST-053 |
| 기준일 | 2026-07-19 |

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Sub-agent dispatch는 저장소 작업 규칙상 사용자가 요청한 경우에만 사용한다.

**Goal:** framework와 database provider를 확정하지 않고 identity/session, authorization, administration, audit와 privacy/security foundation을 test-first TypeScript contract로 구현한다.

**Architecture:** modular monolith의 module public contract를 유지한다. `apps/api`는 framework-neutral application adapter와 composition만 소유하고, `modules/*`가 domain/application rule을 소유하며, `packages/security-contracts`는 여러 module이 공유하는 좁은 security/audit contract만 제공한다. Persistence와 identity provider는 port 뒤에 두고 SP-001에서는 in-memory test adapter만 제공한다.

**Tech Stack:** Node.js 24.18.0, TypeScript 6.0.3, pnpm 11.9.0, ESLint 9.39.5, typescript-eslint 8.64.0, @types/node 24.13.3, Node.js test runner.

## Global Constraints

- frozen Architecture Bible 문서는 수정하지 않는다.
- `.env`, NAS configuration, connector, source/intake, AI, publication과 SP-002 artifact를 수정하거나 생성하지 않는다.
- HTTP framework, final endpoint, database schema/migration, identity provider와 token format을 확정하지 않는다.
- authorization은 default deny이며 authentication success, UI visibility, role name만으로 business authority를 만들지 않는다.
- AI/service principal은 human approval capability를 받을 수 없다.
- privileged action은 MFA, reason, scope와 append-oriented audit evidence를 요구한다.
- log/audit/error에 credential, token, password, full contact/raw payload를 기록하지 않는다.

---

### Task 1: Reproducible TypeScript Toolchain

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `eslint.config.mjs`
- Create: `scripts/run-compiled-tests.mjs`
- Modify: `.gitignore`

**Produces:** `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm verify`.

- [ ] Pin only the approved toolchain versions and define reproducible scripts.
- [ ] Install dependencies with pnpm and create `pnpm-lock.yaml`.
- [ ] Run the empty build/lint/typecheck/test pipeline and retain the expected baseline result.

### Task 2: Audit Contract and Append-oriented Evidence

**Files:**
- Create: `packages/security-contracts/src/index.ts`
- Create: `modules/audit/src/audit-log.test.ts`
- Create: `modules/audit/src/audit-log.ts`
- Create: `modules/audit/src/index.ts`

**Interfaces:**
- Produces: `AuditSink.append(input): AuditEvent`
- Produces: `AuditReader.query(request): readonly AuditEvent[]`
- Produces: `AuditLog.correct(request): AuditEvent`

- [ ] Write TEST-006/034/049 tests for required fields, immutable returned evidence, purpose-required query, restricted payload rejection and correction-by-link.
- [ ] Run the focused test and verify RED because the audit implementation does not exist.
- [ ] Implement the minimum append-oriented audit log and safe-detail validation.
- [ ] Run the focused test and verify GREEN.

### Task 3: Identity and Session Boundary

**Files:**
- Create: `modules/identity/src/session-service.test.ts`
- Create: `modules/identity/src/session-service.ts`
- Create: `modules/identity/src/index.ts`

**Interfaces:**
- Consumes: `AuditSink`
- Produces: `AuthenticationAdapter.verify(evidence): AuthenticatedIdentity | null`
- Produces: `SessionService.createSession/refreshSession/revokeSession/readSession`

- [ ] Write TEST-026/046 tests for generic authentication failure, bounded session, refresh rotation, replay-family revocation, expired/revoked access and service-principal human-role rejection.
- [ ] Run the focused test and verify RED.
- [ ] Implement provider-neutral authentication port and in-memory session lifecycle without storing raw credentials.
- [ ] Run the focused test and verify GREEN.

### Task 4: Default-deny Authorization and SoD

**Files:**
- Create: `modules/authorization/src/authorization-service.test.ts`
- Create: `modules/authorization/src/authorization-service.ts`
- Create: `modules/authorization/src/index.ts`

**Interfaces:**
- Consumes: active `SessionContext`, `RoleAssignment`, `AuditSink`
- Produces: `AuthorizationService.evaluate(request): AuthorizationDecision`

- [ ] Write TEST-009/026/046/047 tests for unauthenticated/stale session, inactive assignment, team/resource/purpose mismatch, privileged MFA/reason obligations, service approval denial, manager/admin non-inheritance and creator/approver conflict.
- [ ] Run the focused test and verify RED.
- [ ] Implement explicit capability grants with deny-first evaluation and policy/version trace.
- [ ] Run the focused test and verify GREEN.

### Task 5: Governed Administration

**Files:**
- Create: `modules/administration/src/administration-service.test.ts`
- Create: `modules/administration/src/administration-service.ts`
- Create: `modules/administration/src/index.ts`

**Interfaces:**
- Consumes: `AuthorizationService`, `AuditSink`
- Produces: `AdministrationService.proposeAssignment/approveAssignment/revokeAssignment`

- [ ] Write TEST-005/034/047/053 tests for self-assignment prohibition, proposer/approver separation, expected-version conflict, prohibited human role for service principal, reason/effective-period requirements and audited activation/revocation.
- [ ] Run the focused test and verify RED.
- [ ] Implement versioned two-person role assignment lifecycle and append-only decision evidence.
- [ ] Run the focused test and verify GREEN.

### Task 6: Privacy-safe Security Controls

**Files:**
- Create: `modules/security/src/privacy-controls.test.ts`
- Create: `modules/security/src/privacy-controls.ts`
- Create: `modules/security/src/security-events.test.ts`
- Create: `modules/security/src/security-events.ts`
- Create: `modules/security/src/index.ts`

**Interfaces:**
- Produces: `classifyCombinedData`, `maskRestrictedValue`, `sanitizeSecurityDetails`
- Produces: `SecurityEventService.record`

- [ ] Write TEST-048/049/053 tests for highest-class inheritance, unknown-as-restricted, masked restricted values, recursive sensitive-key removal, privacy-safe structured events and immutable correlation/control metadata.
- [ ] Run the focused tests and verify RED.
- [ ] Implement deterministic classification, masking, sanitization and security-event contracts.
- [ ] Run the focused tests and verify GREEN.

### Task 7: Framework-neutral API Application Adapters

**Files:**
- Create: `apps/api/src/contracts.ts`
- Create: `apps/api/src/identity-api.test.ts`
- Create: `apps/api/src/identity-api.ts`
- Create: `apps/api/src/admin-audit-api.test.ts`
- Create: `apps/api/src/admin-audit-api.ts`
- Create: `apps/api/src/composition.ts`

**Interfaces:**
- Consumes: public module contracts only.
- Produces: stable success/error envelopes for API-001, API-002, API-015 and API-016 logical operations.

- [ ] Write TEST-026/034 integration tests for request/correlation propagation, safe stable errors, body actor rejection, authorization ordering and no hidden success.
- [ ] Run the focused tests and verify RED.
- [ ] Implement thin adapters that translate contract input/output without owning authority.
- [ ] Run the focused tests and verify GREEN.

### Task 8: Sprint Evidence and Completion Gate

**Files:**
- Create: `docs/reviews/SP-001_COMPLETION.md`
- Create: `docs/development/SP001_TEST_EVIDENCE.md`

- [ ] Run `pnpm verify`.
- [ ] Run Gitleaks with `.gitleaks.toml`.
- [ ] Run Markdown-link, forbidden-scope, frozen-document and trace checks.
- [ ] Record exact commands/results, limitations, rollback and SP-002 prerequisites.
- [ ] Review the diff against FEAT/DEV/IMP/TEST scope and create the Sprint 1 completion commit.
