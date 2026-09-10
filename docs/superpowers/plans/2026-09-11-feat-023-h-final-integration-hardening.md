# FEAT-023-H Final Integration / Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FEAT-023-A~G의 기존 운영 evidence 경계를 새 authority나 동작 없이 하나의 최종 hardening 기준으로 검증한다.

**Architecture:** 기존 `DurableOperationalEvidenceStore`, `SecurityPrivacyOperationalControlService`, Alert/readiness projectors와 injected `ConsoleReadAdapter` 경로만 검증한다. 새 Production component를 만들지 않으며, focused verification이 실제 결함을 증명할 때만 해당 기존 경계에 최소 수정한다.

**Tech Stack:** Node.js 24.18.0, TypeScript 6.0.3, Node test runner, built-in `node:sqlite`, vanilla Console runtime.

**Spec:** Architecture Owner-approved FEAT-023-H Final Integration / Hardening Start Authorization.

## Global Constraints

- Baseline은 `1ecb3b5d23e81cc446892c54ad606782b8a43a68`이다.
- 새 API, route, role/capability, lifecycle/state vocabulary, persistence subsystem, dependency와 external network를 추가하지 않는다.
- automatic remediation과 deployment/backup/rollback execution은 `0`이어야 한다.
- FEAT-023 Final Gate는 시작하지 않는다.

---

### Task 1: Integrated hardening evidence

**Files:**
- Verify: `modules/operations/src/*.test.ts`
- Verify: `apps/admin-console/src/*.test.ts`
- Verify: existing Audit, Authorization, AI privacy and SoD regression tests

**Interfaces:**
- Consumes: FEAT-023-B~G의 durable store, security service, projections와 injected Console read contracts.
- Produces: durability/restart/idempotency, tenant/scope concealment, data minimization, truthful readiness/Alert와 read-only Console의 integrated evidence.

- [x] **Step 1: Run the focused A~G hardening set**

  기존 direct tests에서 close/reopen, immutable identity replay/conflict, append-only records, MFA/live authorization, tenant/scope concealment, secret/PII/provider/prompt/CoT rejection, `UNKNOWN` preservation와 mutation control absence를 실행한다.

- [x] **Step 2: Inspect any first meaningful failure**

  실패가 있으면 해당 assertion이 증명하는 실제 경계를 좁히고, canonical contract 변경이 필요하면 즉시 중단한다.

- [x] **Step 3: Apply TDD only for a proven defect**

  기존 test가 부족한 실제 결함이면 최소 RED assertion을 먼저 추가하고 예상 사유로 실패한 뒤, 승인된 기존 경계만 최소 수정해 GREEN으로 만든다.

- [x] **Step 4: Confirm preservation invariants**

  Production changes, new API/route/authority/state/dependency/network와 automatic remediation/execution path가 모두 `0`인지 diff와 architecture assertions로 확인한다.

### Task 2: Final verification and evidence

**Files:**
- Modify: `docs/implementation/FEAT023_TRACEABILITY_MATRIX.md`
- Create: `docs/reviews/FEAT023_H_FINAL_INTEGRATION_HARDENING_COMPLETION.md`
- Modify: `docs/00_MASTER_INDEX.md`

**Interfaces:**
- Consumes: Task 1과 repository quality-gate 결과.
- Produces: FEAT-023 A~H actual evidence. Final Gate는 `NOT_STARTED`로 유지한다.

- [x] **Step 1: Run affected and full regression**

  Operations/Console/security/AI affected set을 실행한 뒤 전체 suite를 최종 한 번 실행한다.

- [x] **Step 2: Run repository gates**

  lint, typecheck, clean build, verify constituents, Architecture checksum, `git diff --check`, Gitleaks와 dependency/lockfile diff를 확인한다. H-scoped network approval 없이 dependency audit은 실행하지 않는다.

- [x] **Step 3: Record only verified A~H evidence**

  H row와 evidence chain만 실제 결과로 갱신하고 Final Gate는 완료 처리하지 않는다. Completion report는 repository template의 10개 필수 항목을 포함한다.

- [x] **Step 4: Request fresh independent review**

  Critical `0`, Important `0`, unresolved blockers `0`을 요구한다.

- [x] **Step 5: Create exactly one local commit**

  approved H files만 stage하고 cached diff를 검증한 뒤 한 개의 local commit을 만든다. Push와 main integration은 수행하지 않는다.
