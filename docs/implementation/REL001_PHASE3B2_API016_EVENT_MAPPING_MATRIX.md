# REL-001 Phase 3B.2 API-016 Event Mapping Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-141 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Audit Owner / API Owner / Security Owner |
| 기준일 | 2026-09-14 |

## 1. Existing vocabulary review

Existing Phase 2 Core tuples와 `EVT-001`–`012`는 Job lifecycle을 표현하지 않는다. 유사한 Publication, Projection, Replay 또는 Recovery event를 재사용하면 source aggregate, actor, trigger와 authority 의미가 바뀌므로 허용하지 않는다.

## 2. Classification

| Point | Existing exact match | Classification | Proposed closure | Reason |
|---|---|---|---|---|
| submit | none | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `JOB_SUBMITTED` | accepted Job identity/input/provenance fact |
| claim | none | `NOT_APPLICABLE` | no event | selected option C has no claim/lease transition |
| start | none | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `JOB_STARTED` | exact attempt execution start fact |
| heartbeat | none | `NOT_APPLICABLE` | no event | selected option C has no lease/heartbeat state |
| result | none | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `JOB_SUCCEEDED` | immutable successful technical result fact |
| fail | none | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `JOB_FAILED` | trusted normalized technical failure fact |
| cancel | none | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `JOB_CANCELLED` | authorized best-effort cancellation fact |
| expire | none | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `JOB_EXPIRED` | deterministic deadline terminal fact |
| retry | none | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `JOB_RETRY_SUBMITTED` | authorized successor creation and lineage fact |

No audit point is renamed or merged. Seven new event types are the minimum because their trigger, principal, state transition and outcome semantics differ. Claim and heartbeat are not emitted as no-op events.

## 3. Totals

| Classification | Count |
|---|---|
| `MAPPED_EXISTING_EVENT` | `0` |
| `NOT_APPLICABLE` | `2` |
| `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `7` |
| classified | `9/9` |
| unknown | `0` |
| proposed mappings closed | `9/9` |
| effective mappings | `9/9` |

DEC-151 approval makes all nine dispositions effective: seven approved event types and two `NOT_APPLICABLE` points. Remaining canonical decisions are `0`; Phase 3C still requires separate implementation authorization.

## 4. Ownership and materialization

API-017 owns Job state and approved enriched intent production. API-016 owns final event vocabulary, immutable event identity and durable final event materialization. API-017 direct final event creation is `0`.

Each mapped API-017 mutation and its `v2` intent must commit atomically in the API-017 owner-local transaction. API-016 materializes exact replay once; conflict fails closed; materialization failure leaves source intent durable. No distributed transaction or final-event write is added to API-017.
