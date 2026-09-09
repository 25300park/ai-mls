# FEAT-023-D Security / Privacy Operational Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 Security, Authorization, AI 및 FEAT-023 operational evidence 경계를 재사용해 privacy-safe tenant/scope-bound security evidence와 readiness projection을 검증한다.

**Architecture:** 기존 `DurableOperationalEvidenceStore` 안에 append-only tenant/scope binding을 저장하고, 단일 내부 `SecurityPrivacyOperationalControlService`가 `AuthorizationService`를 통한 live authorization 후에만 evidence 조회와 security readiness projection을 허용한다. Sanitizer는 기존 `[REDACTED]` 표현을 유지하면서 key와 value 모두를 검사한다.

**Tech Stack:** Node.js 24.18.0, TypeScript, `node:test`, `node:sqlite`, pnpm 11.9.0

**Spec:** Architecture Owner가 승인한 FEAT-023-D Minimal Implementation Design (2026-09-10)

## Global Constraints

- 새 API ID, role/capability, lifecycle state, privacy classification, dependency 또는 network를 추가하지 않는다.
- purpose는 `SECURITY_MONITORING`으로 고정한다.
- 기존 Health/Readiness vocabulary만 사용하며 domain mutation과 automatic remediation은 0이다.
- Production 코드는 RED가 증명한 결함에 필요한 최소 범위만 변경한다.

---

### Task 1: Value-aware security sanitization

**Files:**
- Modify: `modules/security/src/privacy-controls.test.ts`
- Modify: `modules/security/src/privacy-controls.ts`

**Interfaces:**
- Consumes: `sanitizeSecurityDetails(input)`
- Produces: 기존 `[REDACTED]` 표현을 사용하는 recursive key/value sanitizer

- [x] unsafe value regression test를 추가하고 현재 leakage로 RED를 확인한다.
- [x] email, phone, authorization/secret, raw prompt/provider response, reasoning, stack/path 값을 최소 규칙으로 redact한다.
- [x] focused security tests를 GREEN으로 만든다.

### Task 2: Durable tenant/scope binding and controlled access

**Files:**
- Modify: `modules/operations/src/durable-operational-evidence-store.test.ts`
- Modify: `modules/operations/src/durable-operational-evidence-store.ts`
- Create: `modules/operations/src/security-privacy-operational-controls.test.ts`
- Create: `modules/operations/src/security-privacy-operational-controls.ts`
- Modify: `modules/operations/src/index.ts`

**Interfaces:**
- Consumes: `OperationalEvidenceStore`, `AuthorizationService.evaluate()`, canonical telemetry/status DTOs
- Produces: append-only evidence binding and one internal authorized control service

- [x] unbound/cross-tenant/cross-scope access tests를 추가하고 missing boundary로 RED를 확인한다.
- [x] 동일 SQLite boundary에 append-only tenant/scope binding을 구현한다.
- [x] fixed-purpose live authorization과 concealed denial을 구현한다.
- [x] `audit.query` read와 `security.admin` readiness projection을 focused GREEN으로 만든다.

### Task 3: Cross-control privacy and authority regression

**Files:**
- Create or modify only directly relevant FEAT-023-D tests under `modules/operations/src`, `modules/security/src`, and `modules/ai/src`.

**Interfaces:**
- Consumes: existing AuthorizationService, AdvisoryRuntime, durable operational store
- Produces: regression evidence only

- [x] MFA, existing SoD, concealment, AI tenant/scope and strict-output assertions를 실행한다.
- [x] telemetry/security projection이 domain mutation이나 automatic remediation을 만들지 않음을 검증한다.
- [x] RED가 없는 AI/Authorization production 파일은 변경하지 않는다.

### Task 4: Verification and completion evidence

**Files:**
- Modify: `docs/implementation/FEAT023_TRACEABILITY_MATRIX.md`
- Create: `docs/reviews/FEAT023_D_SECURITY_PRIVACY_OPERATIONAL_CONTROLS_COMPLETION.md`

**Interfaces:**
- Consumes: 실제 focused/affected/full verification 결과
- Produces: Phase D traceability와 completion report

- [x] focused 및 affected tests, lint, typecheck, build, verify, architecture checksum, gitleaks를 실행한다.
- [x] independent review에서 Critical 0 / Important 0을 확인한다.
- [x] 실제 evidence만 RTM/report에 기록하고 `git diff --check`를 통과한다.
- [x] 범위가 요구하는 경우 정확히 한 개의 bounded local commit 후 clean 상태를 확인한다.
