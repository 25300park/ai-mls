# REL-001 Phase 2 API-016 Durable Audit Runtime Gap Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-106 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Security/Governance Owner / Audit Owner |
| 기준 commit | `e5a2cfc9a17cdb20c0c3db1e79e3184e7a09052f` |
| Runtime component | `STAGING_API016_AUDIT_RUNTIME` |

## 1. Scope and governing rule

이 문서는 Phase 1G의 durable audit intent와 API-016 final Audit Event 사이의 실행 가능성을 검토한다. Core는 intent만 소유하고 API-016만 final event를 소유한다. Phase 1H~1L Core transport decision은 재개하지 않는다.

## 2. Current implementation inventory

| Boundary | Current evidence | Current state | Gap |
|---|---|---|---|
| Canonical API-016 contract | [Admin and Audit API](../book-6/10_ADMIN_AND_AUDIT_API.md) | query/history/export logical surface; append-oriented correction principle | internal materialization contract and executable runtime absent |
| Audit Event schema | [`AppendAuditEvent` / `AuditEvent`](../../packages/security-contracts/src/index.ts) | principal, action, target, purpose, policyVersion, classification, decision, outcome, correlation and generated occurrence time | no intent identity, domain owner, mutation identity, tenant/scope or evidence-ref field |
| Final event implementation | [`AuditLog`](../../modules/audit/src/audit-log.ts) | process-local array; immutable snapshots; append-only correction behavior | no durable store, restart durability or materialization identity |
| API read boundary | [`AdminAuditApi.queryAudit`](../../apps/api/src/admin-audit-api.ts) | Session-derived actor and `audit.query` authorization | underlying query is not tenant/scope bound; no production API-016 runtime composition |
| Phase 1G intent source | seven bounded SQLite stores, summarized by [Phase 1G Traceability](REL001_PHASE1G_PERSISTENCE_TRACEABILITY_MATRIX.md) | durable immutable intents committed atomically with domain mutation | no common reader port, cross-tenant enumeration contract or consumption checkpoint |
| Intent schema | [Phase 1G-C Audit Atomicity Decision](REL001_PHASE1GC_AUDIT_ATOMICITY_DECISION.md) | intentId, domain owner, aggregate/mutation identity, actorId, tenant/scope where applicable, classificationRef, committedAt, evidence refs | explicitly states classificationRef is not final API-016 vocabulary |
| Existing persistence | Phase 1G owner-local databases | durable domain state and intent | no API-016-owned final-event database |
| Runtime/host | no API-016 host or production composition | unavailable | lifecycle, configuration, health/readiness and fingerprint responsibility absent |

## 3. Intent-to-event field closure

| Required final/event evidence | Available from Phase 1G intent | Closure assessment |
|---|---|---|
| stable materialization identity | `intentId` | available as dedup source, but final event ID derivation is not approved |
| domain owner / aggregate / mutation | yes | available as source provenance; target/action mapping is not approved |
| human/service principal type | no | blocked |
| active role/team/assignment | no | blocked |
| purpose | no | blocked |
| policy/control version | no | blocked |
| final data classification | only `classificationRef` | blocked; source reference is explicitly not final vocabulary |
| decision | no | blocked |
| outcome | no | blocked |
| authoritative chronology | `committedAt` | available, but current `AuditLog` replaces it with processing clock |
| tenant/scope visibility | tenant/scope exists except system-bound Property tenant | source binding exists; final schema/query enforcement absent |
| safe evidence refs | yes | available, but canonical final-event placement is not approved |

## 4. Materialization and persistence assessment

| Requirement | Feasibility | Blocker / required decision |
|---|---|---|
| exactly-once logical materialization | technically feasible with unique `intentId` in an API-016-owned SQLite transaction | deterministic event identity and conflicting-content fingerprint inputs need approval |
| append-only final events | technically feasible with insert-only table and update/delete triggers | canonical stored payload fields remain incomplete |
| restart durability | technically feasible with explicit database path | production composition/configuration contract absent |
| source intent recovery | intents survive independently | common safe reader and tenant enumeration/selection contract absent |
| failed materialization leaves intent intact | feasible without distributed transaction | invocation/selection semantics must avoid API-017 retry vocabulary |
| chronology | source `committedAt` can be preserved | contract must distinguish occurred/committed/materialized time without inventing event fields |

## 5. Authorization, visibility and safety

| Control | Existing evidence | Gap |
|---|---|---|
| read authorization | `AdminAuditApi` evaluates `audit.query` | live authorization exists at interface boundary only |
| tenant isolation | Phase 1G intent stores bind tenant where domain-owned | `AuditLog.query` has no tenant parameter or tenant filter |
| scope isolation | intent includes `scopeRef` | final query has no scope filter or concealment contract |
| caller override | Session actor is derived by API | final store/read port must receive trusted tenant/scope independently of caller filters |
| safe content | `AuditLog` recursively rejects unsafe detail keys/values | no approved conversion placement for evidence refs; raw intent pass-through must be prohibited |

## 6. Execution model decision

| Option | Result | Reason |
|---|---|---|
| A — in-process Staging Platform Host using application ports | preferred candidate, not implementation-ready | avoids new transport/API-017 semantics, but common intent reader, mapping and composition contracts are missing |
| B — later Worker process | deferred | scheduling, lease and retry would require Phase 3/API-017 semantics |

No HTTP transport is required or authorized for internal materialization. Existing API-016 public exposure remains unchanged and incomplete.

## 7. Canonical decisions required before RED

1. Final API-016 mapping for every intent field, including event type/action, principal type, purpose, policy version, classification, decision and outcome.
2. Trusted provenance source for principal type, roles/team/assignment when the intent contains only `actorId`.
3. Final-event representation of `intentId`, tenant/scope and evidence references without using arbitrary `details` vocabulary.
4. Deterministic event ID and conflicting-content fingerprint definition.
5. API-016 internal intent reader/selection contract across six tenant-bound stores and the system-bound Property store.
6. In-process invocation/lifecycle rule that does not create API-017 scheduling or retry semantics.
7. Staging database-path, startup fail-closed, health/readiness and component fingerprint ownership.

## 8. Gap decision

Implementing now would require new Audit Event vocabulary or unapproved default semantics, which is a mandatory stop condition. Production and test changes remain `0`.

## 9. Phase 2A reassessment

[Phase 2A Canonical Closure](REL001_PHASE2A_AUDIT_INTENT_EVENT_MAPPING_MATRIX.md) resolves tenant/scope visibility, intent identity/chronology, the seven-source reader boundary, and the in-process Staging lifecycle/configuration. It does not supply the missing per-mutation event vocabulary or immutable principal/context evidence. Remaining owner blockers are therefore reduced to three, but implementation remains blocked before RED:

1. exact Audit Owner mapping registry for all seven sources;
2. immutable trusted principal provenance for every intent;
3. exact source of purpose, policy version, classification, decision and outcome.
