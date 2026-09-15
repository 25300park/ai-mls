# REL-001 Phase 4 FEAT-022 Executable Lifecycle Implementation Plan

> **For agentic workers:** Execute no Production task until its preceding Architecture Owner gate is explicitly approved. Use RED → minimum implementation → GREEN for each authorized task.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-177 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / AI Reviewer / Operations Owner |
| 기준일 | 2026-09-15 |

**Goal:** Connect the three approved API-017 handler-specific ports to a provider-backed FEAT-022 advisory lifecycle without moving provider, prompt, validation, authority or credential semantics into API-017.

**Architecture:** Preserve `API-017 → exact handler → FEAT-022 port → AdvisoryRuntime → approved adapter`. Provider output is normalized and validated inside FEAT-022; API-017 receives only safe advisory result references. Current unavailable Production composition remains authoritative until all decision gates close.

**Tech Stack:** Node.js 24, TypeScript, existing SQLite persistence, existing API-017 and FEAT-022 modules; no new package is approved.

**Spec:** [Phase 4A Inventory](REL001_PHASE4A_FEAT022_EXECUTABLE_LIFECYCLE_INVENTORY.md)

## Global constraints

- Canonical capabilities are exactly `AI-001`, `AI-004`, `AI-005` for this integration.
- DEC-152/153/154 and Phase 3 Job/Audit semantics remain unchanged.
- API-017 credential, provider client, raw prompt/response and network access remain `0`.
- No real provider, credential, destination, model, timeout, retry, fallback or observability value may be invented.
- Public review mutation and autonomous business authority remain outside this plan.

## Task 1: Canonical owner decision closure

**Files:** bounded decision documents and Decision Register only.

1. Approve one provider/model/capability/data-class evaluation disposition.
2. Approve fixed/router/config selection and fallback compatibility.
3. Approve credential/config ownership and Staging secret/destination boundary.
4. Approve immutable Production prompt asset resolution and activation.
5. Approve timeout, rate-limit, provider retry and fallback semantics.
6. Approve safe provider response/failure/observability contract.
7. Approve exact Job↔Advisory input/result/principal/audit binding.
8. Recompute the Gap Matrix; if any decision remains unresolved, stop with Production changes `0`.

Expected result: seven decisions approved without new capability, authority or Audit vocabulary.

## Task 2: Provider contract and adapter TDD

**Files:** existing FEAT-022 provider/runtime contracts, Production composition and focused tests. Exact file additions require Task 1 approval.

1. Add RED tests for forbidden arbitrary adapter injection, unsafe raw response/error, secret exposure, wrong provider/model/config binding, timeout/rate-limit normalization and unapproved fallback.
2. Prove failures arise at the missing provider boundary.
3. Implement only the approved provider adapter/config interfaces and normalization.
4. Run focused tests; require raw prompt/provider/credential leakage `0`.

Expected result: provider boundary is executable only under exact approved Staging configuration.

## Task 3: Prompt and application-port TDD

**Files:** existing FEAT-022 prompt persistence/runtime, three approved application-port contracts/adapters and focused tests.

1. Add RED tests for missing/inactive/mismatched prompt asset and capability-specific port mismatch.
2. Implement the approved prompt asset resolver without exposing prompt body to API-017.
3. Implement three literal-narrowed port adapters over the single `AdvisoryRuntime`.
4. Verify strict `AI-001/004/005` output and durable replay/idempotency.

Expected result: three FEAT-022 ports are concrete; no second advisory service exists.

## Task 4: API-017 handler binding TDD

**Files:** existing API-017 handler/runtime composition, exact thin handlers and focused integration tests.

1. Add RED tests for wrong reference/version selection, caller prompt override, principal loss, result/evidence mismatch and raw provider leakage.
2. Implement the approved Job↔Advisory mapping only.
3. Map FEAT-022 safe failures into the existing Job failure vocabulary.
4. Verify manual `RetryAsSuccessor` remains distinct from provider retry.

Expected result: handlers contain orchestration/binding only and provider/network capability `0`.

## Task 5: Staging composition and final verification

**Files:** existing Staging composition and bounded Phase 4 traceability/report evidence.

1. Add RED tests proving missing config/credential/provider/prompt makes runtime `NOT_READY` with provider calls `0`.
2. Wire only approved Staging composition.
3. Run three-capability E2E, tenant/scope/provenance, failure, restart/idempotency, audit, leakage and readiness tests.
4. Run affected and full gates once, architecture checksum, Gitleaks and separately authorized dependency audit if required.
5. Obtain independent review before any completion or integration claim.

Expected result: `STAGING_EXECUTION_READY = 3/3` only when every approved gate passes; otherwise remain `NOT_READY`.

## Current execution gate

Tasks 2–5 are `NOT_AUTHORIZED`. The next permissible work is a documentation-only owner-decision closure for Task 1.
