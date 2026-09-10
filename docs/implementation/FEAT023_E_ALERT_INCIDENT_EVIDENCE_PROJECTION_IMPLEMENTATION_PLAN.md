# FEAT-023-E Alert / Incident Evidence Projection Implementation Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-041 |
| Version | v0.1 |
| Status | APPROVED |
| Owner | Security / Privacy / Operations Owners |
| Baseline | `63aad0f0a453602ed5933693d76aaa17f741641f` |

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 기존 authoritative evidence를 안전한 내부 signal로 정규화하고 동일 operational SQLite 경계에 restart-safe `ACTIVE | CLEARED` Alert projection을 제공한다.

**Architecture:** 각 원천 record는 `OperationalAlertSignal` 내부 boundary를 통해 condition만 전달하며 Alert evaluator에는 business authority가 없다. Alert occurrence와 evaluation history는 기존 `DurableOperationalEvidenceStore` 안에 append-only로 저장하고 현재 상태는 최신 evaluation으로 파생한다. Console은 session-derived authorization을 통과하는 injected read-only port만 사용한다.

**Tech Stack:** TypeScript 6, Node.js 24 `node:test`, built-in `node:sqlite`, pnpm 11.9.0.

**Spec:** Architecture Owner가 승인한 `FEAT-023-E — ALERT / INCIDENT EVIDENCE PROJECTION`, authoritative-source normalization authorization 및 canonical Alert type/severity mapping.

## Global Constraints

- Alert type은 승인된 14개만 표현하며 활성 evaluator는 prerequisite가 존재하는 10개만 가진다.
- `AUTHORIZATION_FAILURE_SPIKE`, `IDEMPOTENCY_CONFLICT_SPIKE`, `BACKUP_READINESS_FAILURE`, `DEPLOYMENT_READINESS_FAILURE` 생성은 비활성화한다.
- Severity는 `INFO | WARNING | HIGH | CRITICAL`, lifecycle은 `ACTIVE | CLEARED`만 허용한다.
- Alert는 incident, acknowledgement, retry, recovery, remediation 또는 business mutation authority를 만들지 않는다.
- Persistence는 기존 operational SQLite store만 확장하며 새 DB, API, dependency 또는 external network를 추가하지 않는다.
- Evidence는 tenant/scope bound safe reference만 포함하며 PII, secret, raw provider/model payload, prompt, chain-of-thought, stack/path를 포함하지 않는다.

## Approved Alert Matrix

| Alert type | Authoritative normalized condition | Severity | Enabled |
|---|---|---:|---:|
| `COMPONENT_UNHEALTHY` | operational status `health=UNHEALTHY` | `HIGH` | yes |
| `COMPONENT_NOT_READY` | operational status `readiness=NOT_READY` | `HIGH` | yes |
| `STALE_OPERATIONAL_EVIDENCE` | operational status `freshness=STALE` with existing threshold | `WARNING` | yes |
| `PUBLICATION_UNKNOWN_OUTCOME` | Publication authoritative outcome `UNKNOWN` | `HIGH` | yes |
| `CONNECTOR_AMBIGUITY` | Connector invocation `AMBIGUOUS` | `HIGH` | yes |
| `OPEN_RECOVERY_CASE` | F19 recovery case `OPEN` | `WARNING` | yes |
| `SUSPENDED_INTEGRATION_CONTRACT` | API-019 Integration Contract `SUSPENDED` | `WARNING` | yes |
| `AUTHORIZATION_FAILURE_SPIKE` | no approved threshold | none | no |
| `IDEMPOTENCY_CONFLICT_SPIKE` | no approved threshold | none | no |
| `SECRET_LEAKAGE_DETECTED` | safe security finding reference | `CRITICAL` | yes |
| `DEPENDENCY_SECURITY_FINDING` | authoritative audit severity normalization | mapped | yes |
| `ARCHITECTURE_DRIFT_DETECTED` | unapproved checksum drift evidence | `HIGH` | yes |
| `BACKUP_READINESS_FAILURE` | no canonical readiness source yet | none | no |
| `DEPLOYMENT_READINESS_FAILURE` | no canonical readiness source yet | none | no |

---

### Task 1: Strict Alert contracts and authoritative signal normalization

**Files:**
- Create: `modules/operations/src/operational-alert-projection.ts`
- Create: `modules/operations/src/operational-alert-projection.test.ts`
- Modify: `modules/operations/src/index.ts`

**Interfaces:**
- Consumes: strict `OperationalAlertSignal` with tenant/scope binding and safe evidence references.
- Produces: immutable `OperationalAlertProjectionRequest`, canonical severity normalization, deterministic condition fingerprint and `ACTIVE | CLEARED` evaluation.

- [x] Write RED tests for all 14 allowed types, forbidden type/severity/state, approved severity mapping, dependency severity normalization, enabled source normalization and disabled conditions.
- [x] Run the focused test and confirm RED because the Alert module is absent.
- [x] Implement the minimum strict contract, normalizers and pure evaluator.
- [x] Run the focused test and confirm GREEN.

### Task 2: Durable identity, lifecycle and tenant/scope projection

**Files:**
- Modify: `modules/operations/src/durable-operational-evidence-store.ts`
- Modify: `modules/operations/src/durable-operational-evidence-store.test.ts`
- Modify: `modules/operations/src/operational-evidence-architecture.test.ts`

**Interfaces:**
- Consumes: validated Alert evaluation request.
- Produces: append-only occurrence/evaluation records, stable active identity, deterministic clear/reopen behavior and scoped reads in the existing SQLite store.

- [x] Write RED tests for duplicate-active suppression, deterministic clear, reopen occurrence, close/reopen durability, identity conflict, append-only enforcement and tenant/scope concealment.
- [x] Confirm RED for missing durable Alert methods/tables.
- [x] Add minimum Alert tables, triggers and store methods to the existing database transaction boundary.
- [x] Run Alert/store/architecture tests and confirm GREEN.

### Task 3: Read-only authorized Console projection

**Files:**
- Modify: `apps/admin-console/src/console-read-adapter.ts`
- Inspect only: `apps/admin-console/src/console-composition.ts` (the approved injected port already supplies the boundary; no source change required)
- Modify: `apps/admin-console/src/console-renderer.ts`
- Modify: directly affected Console tests.

**Interfaces:**
- Consumes: injected `OperationalAlertReadPort`; never accesses SQLite/repository directly.
- Produces: safe Operations-page active/cleared Alert view after session-derived authorization, tenant/scope filtering and concealment.

- [x] Write RED tests for safe projection, missing adapter unavailable state, wrong tenant/scope concealment, sanitized fields and zero mutation controls.
- [x] Confirm RED because no Alert read port/rendering exists.
- [x] Add the minimum injected read-only adapter and renderer section.
- [x] Run focused Console tests and confirm GREEN.

### Task 4: Regression, evidence and completion gate

**Files:**
- Modify: `docs/implementation/FEAT023_TRACEABILITY_MATRIX.md`
- Modify: `docs/00_MASTER_INDEX.md`
- Create: `docs/reviews/FEAT023_E_ALERT_INCIDENT_EVIDENCE_PROJECTION_COMPLETION.md`

- [x] Run FEAT-023-E focused and affected FEAT-023-B/C/D, FEAT-017/018/019/020/022/016 regression.
- [x] Run one final full regression, lint, typecheck, build, verify, architecture checksum, `git diff --check` and Gitleaks.
- [x] Confirm dependency audit is not required because dependency/lockfile changes are zero; do not use network without phase-scoped authorization.
- [x] Obtain fresh independent review and resolve all Critical/Important findings.
- [x] Record only verified evidence in RTM/report and create exactly one local commit; do not push or integrate to main.
