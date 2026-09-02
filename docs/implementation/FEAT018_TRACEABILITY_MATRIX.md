# FEAT-018 Implementation Traceability Matrix

| 항목 | 값 |
|---|---|
| Version | v1.0 |
| Status | APPROVED |
| Scope | F18-A~F18-H implementation evidence |
| Canonical authority | `TRACE-019`, `TRACE-020`, `API-017`, `API-018`, `API-019` |
| Baseline | `cd14c099b2dbc47fd78f553238686d50bc6bed46` |

## 1. Purpose

FEAT-018 Source / Connector Runtime Integration의 canonical requirement, production execution boundary, direct test와 completion evidence를 연결한다. 이 문서는 implementation evidence이며 frozen [Canonical RTM](../00_CANONICAL_TRACEABILITY_MATRIX.md)의 identity, ownership 또는 status를 변경하지 않는다.

## 2. Phase traceability

| Slice | Canonical requirement / decision | Production evidence | Direct verification evidence | Completion evidence | Status |
|---|---|---|---|---|---|
| F18-A Inventory | `API-017` scheduling-only, `API-018` connector technical execution, `API-019` external identity/evidence, `API-014` Publication, `API-015` governance | Production change 0; ownership inventory only | Canonical registry and import-graph inspection | [F18 Source / Connector Inventory](../reviews/F18_SOURCE_CONNECTOR_RUNTIME_INVENTORY_GAP_REPORT.md) | VERIFIED |
| F18-B Admission | NEW invocation은 live Source/Connector/tenant/scope/purpose/method/version/authority binding을 통과해야 하며 BLOCKED는 side effect 0 | `modules/source/src/source-ingestion-admission.ts`; `connector-execution-coordinator.ts` | `source-ingestion-admission.test.ts`; blocked coordinator/application assertions | [F18-B Completion](../reviews/F18_B_SOURCE_INGESTION_ADMISSION_BOUNDARY_COMPLETION.md) | IMPLEMENTED_AND_VERIFIED |
| F18-C Durability | durable lease, intent, `EXECUTION_STARTED`, result, idempotency, checkpoint, immutable evidence; ambiguous restart는 blind rerun 0 | `connector-durable-persistence.ts`; `connector-execution-coordinator.ts`; production durable composition | `connector-durable-persistence.test.ts`; `connector-execution-coordinator.test.ts` | [F18-C Report](../reviews/F18_C_DURABLE_CONNECTOR_FOUNDATION_IMPLEMENTATION_REPORT.md) | IMPLEMENTED_AND_VERIFIED |
| F18-D API-018 | closed logical operations 8; HTTP 7; `AdvanceCheckpoint` internal-only; trusted context/concealment/durable path | `connector-api-contracts.ts`; Runtime/Host/Application; API-018 HTTP adapter and production composition | API-018 contract, Runtime/Host/Application, durable record and HTTP tests | [F18-D Report](../reviews/F18_D_CLOSED_API_018_RUNTIME_HTTP_IMPLEMENTATION_REPORT.md) | IMPLEMENTED_AND_VERIFIED |
| F18-E API-019 | closed operations 6; internal commands 4; HTTP queries 2; stable mapping, observation evidence, suspension, technical reconciliation only | External integration contract, durable store, Application/Runtime/Host/HTTP composition | API-019 contract/application/durable/HTTP tests | [F18-E Report](../reviews/F18_E_API_019_EXTERNAL_EVIDENCE_MAPPING_IMPLEMENTATION_REPORT.md) | IMPLEMENTED_AND_VERIFIED |
| F18-F Restart hardening | trusted access precedes history disclosure; exact replay precedes live admission; conflict is deterministic; new identity alone revalidates live admission | `connector-execution-coordinator.ts` | restart/replay/conflict, lease, API-018/019 restart, safe DTO and durable-authority assertions | [F18-F Report](../reviews/F18_F_RESTART_IDEMPOTENCY_AMBIGUITY_HARDENING_IMPLEMENTATION_REPORT.md) | IMPLEMENTED_AND_VERIFIED |
| F18-G Scheduler classification | API-017 is a scheduling boundary only; no second Connector Runtime, admission bypass, lease/idempotency/checkpoint authority | Production change 0; Job and Connector import graphs remain disjoint | `f18-final-integration-architecture.test.ts` — API-017 scheduling-only assertion | [F18-H Report](../reviews/F18_H_FINAL_INTEGRATION_HARDENING_REPORT.md) | NOT_APPLICABLE |
| F18-H Final hardening | cross-layer ownership, durability, restart, ambiguity, isolation, leakage, F17 preservation and F19 exclusion | Production change 0 | focused 77/77; F17 59/59; total 909/909; architecture assertion 2/2 | [F18-H Report](../reviews/F18_H_FINAL_INTEGRATION_HARDENING_REPORT.md) | IMPLEMENTED_AND_VERIFIED |
| F18 Final Gate | approved integrated evidence만 사용한 ownership, safety, contract, regression 및 traceability closure | Production change 0 | F18-H approved evidence 재사용; integrated ancestry와 closure requirements 검증 | [F18 Final Gate Report](../reviews/F18_FINAL_GATE_REPORT.md) | APPROVED |

## 3. Required F18-H scenario matrix

| # | Required scenario | Direct assertion | Result |
|---:|---|---|---|
| 1 | Exact replay after live admission drift | `connector-execution-coordinator.test.ts` — completed exact replay bypasses blocked admission, connector call 0 | PASS |
| 2 | Exact ambiguous replay after restart | same file — ambiguous replay returns `RECONCILIATION_REQUIRED`, connector call 0 | PASS |
| 3 | Fingerprint conflict after restart | coordinator/API-018 HTTP conflict assertions — `IDEMPOTENCY_CONFLICT`, mutation 0 | PASS |
| 4 | Lease expiry after reopen | `connector-durable-persistence.test.ts` — ACTIVE/EXPIRED remain authoritative | PASS |
| 5 | Crash after external call before local commit | coordinator test — reopen AMBIGUOUS, blind rerun 0 | PASS |
| 6 | Duplicate checkpoint advance prevention | exact replay and atomic completion assertions — checkpoint remains version 1 | PASS |
| 7 | API-018 exact HTTP replay | `connector-api-http-runtime.test.ts` — prior body reused, connector call 0 | PASS |
| 8 | API-018 conflicting HTTP replay | same test — HTTP 409, connector call 0 | PASS |
| 9 | API-019 mapping restart | `external-integration-durable-persistence.test.ts` — mapping identity survives reopen | PASS |
| 10 | Remap conflict restart | same file — original binding preserved and conflict evidence retained | PASS |
| 11 | Observation idempotency restart | same file — exact result replay, conflict rejection, observation count 1 | PASS |
| 12 | SUSPENDED contract restart | API-019 durable/HTTP restart tests — state remains SUSPENDED | PASS |
| 13 | API-018→API-019 suspended ingress | `external-integration-http-runtime.test.ts` — HTTP 403, new observation 0 | PASS |
| 14 | Append-only conflict evidence | durable mapping test — historical conflict count preserved after reopen | PASS |
| 15 | Safe reload / DTO sanitization | `f18-restart-authority-architecture.test.ts` — forbidden secret/path/raw markers 0 | PASS |
| 16 | Wrong tenant/scope replay concealment | `connector-runtime-application.test.ts` — NOT_FOUND, prior result disclosure 0 | PASS |
| 17 | Process-local production authority | restart authority architecture assertion — durable adapters selected; Map/Set fallback 0 | PASS |
| 18 | F19 implementation count | `f18-final-integration-architecture.test.ts` — recovery/business reconciliation module/export 0; handoff evidence preserved | PASS |

## 4. Final verification evidence

| Gate | Result |
|---|---|
| F18-H focused | 77/77 PASS |
| F17 affected regression | 59/59 PASS |
| Full regression | 909/909 PASS |
| Lint / Typecheck / Build / Verify | PASS |
| Architecture checksum | 153/153 PASS; `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |
| Gitleaks current tree | 0 findings |
| Production audit | 0 vulnerabilities |
| Full audit | Existing approved development-only transitive `brace-expansion` High 4 only |
| New unapproved High/Critical | 0 |
| Dependency/lockfile changes | 0 |
| F19 | NOT_STARTED |
| FEAT-018 | COMPLETE |

## 5. Scope protection

- New API ID/operation, lifecycle state, authority, persistence subsystem: 0.
- Real provider, external destination, credential, network activation: 0.
- Production code changes in F18-H: 0.
- Frozen Registry/Canonical RTM changes: 0.
- F19 reconciliation/recovery implementation: 0.
