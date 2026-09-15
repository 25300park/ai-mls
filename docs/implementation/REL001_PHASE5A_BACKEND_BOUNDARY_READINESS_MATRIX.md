# REL-001 Phase 5A Backend Boundary Readiness Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-225 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / API Owners |

## 1. Boundary status

| Boundary | Architecture | Implementation | Transport/runtime | Auth | Console wiring | Phase 5 classification |
|---|---|---|---|---|---|---|
| API-015 Administration | READY | durable UoW/Application/closed HTTP/Node server READY | executable composition exists | Session-derived/live authorization READY | API-015 client exists, Staging root missing | `NOT_WIRED`; Staging readiness `PARTIAL` |
| API-016 Audit | READY for six-source boundary | durable append-only store/materializer READY | Staging in-process runtime; no Console-owned store access | `audit.query`, tenant/scope/purpose model exists | durable scoped query adapter/Host wiring absent | `IN_PROCESS_ONLY` / `TRANSPORT_BLOCKED` |
| API-017 Jobs | READY for provider-integration boundary | durable store/one-shot/runtime/audit integration READY | in-process; no public HTTP/RPC added | session-derived JobApi boundary exists | bounded status/readiness projection absent | `IN_PROCESS_ONLY` / `TRANSPORT_BLOCKED` |
| FEAT-022 provider-independent | READY | AI-001/004/005 3/3 READY | capability adapters/app services ready without live network | no business authority; tenant/scope/provenance preserved | status projection absent | `NOT_WIRED` |
| FEAT-022 live provider | canonical external hold | 0/3 | no inference/network/credentials | N/A | must show NOT_READY | `BLOCKED` |
| Core API-001~010 | topology defined | seven durable stores exist | public transport HOLD, 45/45 not transport-ready in Phase 1F record | Phase 1D auth ready | full Core screens not in required six | `BLOCKED`, defer; does not block shell/bootstrap |

## 2. API-015 surface

Existing closed contract supplies Policy, Source/Target governance, Role, Team scope, proposal and Decision reads plus existing propose/approve/reject flows. The existing Console client sends `x-session-id` to `/administration/queries` and `/administration/commands`. It is not `EXECUTABLE_IN_STAGING` until the configured API-015 Node server and durable Session resolver share the Staging Platform Host lifecycle.

## 3. API-016 surface

The durable store supports append, intent read and append-only `listAll()`, but direct use from Console is forbidden and `listAll()` is not a tenant/scope-safe Console contract. Existing `AdminAuditApi.queryAudit()` demonstrates live `audit.query` authorization against an AuditLog. Minimum work is to compose an existing-API-016-owned scoped immutable read projection over durable events with chronology and source linkage; no new event type or Console store access.

## 4. API-017 surface

The durable store exposes exact Job reads, result, history/successor lineage and runtime readiness. The required six-screen Staging scope does not activate UI-034. Existing `/system/operations` may show bounded component readiness and provider state after a Host-owned projection is injected. A canonical UI-034 collection/action surface remains dependency-gated and must not be invented.

## 5. Core dependency disposition

Only UI-006's full canonical dashboard data mentions Core API-001/002 among API-001~010. The currently eligible administration overview can remain bounded to API-015/supporting readiness and mark unavailable Core data truthfully. Therefore exact public Core dependencies are `2 APIs / 1 screen`, deferred, and do not block the Console process bootstrap. Phase 5 does not reopen the 45-operation transport HOLD.

## 6. Owner decisions

Remaining owner decisions for the bounded six-screen bootstrap are `0`: existing Session, API IDs, authorization and UI states suffice. Activating UI-034 or full Core dashboard behavior would require a separate canonical readiness/transport decision and is excluded.
