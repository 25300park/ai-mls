# F18-E API-019 External Evidence Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved six-operation API-019 technical identity, mapping, observation, reconciliation, and contract-suspension boundary.

**Architecture:** Add a closed API-019 contract, a domain-specific durable SQLite store following the F18-C transaction pattern, and one Application/Runtime/Host boundary. A trusted governed-binding resolver provisions technical contracts; API-018 remains the only observation ingress and delegates to API-019. Only the two approved queries are HTTP-exposed.

**Tech Stack:** TypeScript, Node.js 24 `node:sqlite`, `node:test`, existing Runtime/Host/HTTP patterns.

**Spec:** Architecture Owner-approved F18-E API-019 Canonical Contract Amendments V1 and V2 (2026-09-02).

## Global Constraints

- Exactly 6 operations, 2 HTTP queries, 4 internal commands.
- No business authority, F19 behavior, provider/network/credentials, new API ID, or generic persistence subsystem.
- Preserve F18-A/B/C/D changes and keep main unchanged.
- RED → minimum GREEN for each slice; no audit without scoped approval.

### Task 1: Closed contract
- [ ] RED exact union/exposure/schema/bounds/proof tests.
- [ ] Implement immutable parser and exports.
- [ ] GREEN focused contract tests.

### Task 2: Durable technical state
- [ ] RED governed provisioning, stable mapping, remap conflict evidence, optimistic version, observation idempotency, suspension, reconciliation, and restart tests.
- [ ] Implement domain-specific durable API-019 store using the approved F18-C SQLite transaction pattern.
- [ ] GREEN durability tests and F18-C regression.

### Task 3: Application and API-018 handoff
- [ ] RED trusted resolver/authorization/isolation and all six operation tests.
- [ ] RED API-018 observation delegation and suspended-contract containment.
- [ ] Implement the single API-019 Application and injected API-018 handoff port.
- [ ] GREEN focused and F18-D tests.

### Task 4: Runtime/Host/HTTP
- [ ] RED lifecycle, two-query allowlist, command HTTP rejection, safe errors, and durable production composition tests.
- [ ] Implement Runtime/Host/HTTP and fail-closed production composition.
- [ ] GREEN transport tests.

### Task 5: Verification/report
- [ ] Run focused, F18-B/C/D, affected F17, lint/typecheck/build/verify, architecture, diff-check, Gitleaks, and full regression once.
- [ ] Create `docs/reviews/F18_E_API_019_EXTERNAL_EVIDENCE_MAPPING_IMPLEMENTATION_REPORT.md` with actual evidence.
- [ ] Confirm main clean; worktree intentionally dirty; no commit/push; F19 not started.
