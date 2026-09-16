# REL-001 Phase 5C Failure / Readiness Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-234 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner |

| Condition | Surface result | Global readiness | Mutation / leakage |
|---|---|---|---|
| all mandatory boundaries observed available; live provider unavailable | owning surface remains truthful | `DEGRADED` | 0 / 0 |
| Session missing/revoked/expired/stale MFA | concealed authorization failure before backend | no cached access; authority re-resolved | 0 / 0 |
| API-015 unavailable/unsafe | safe Console error | `NOT_READY` after observation | 0 / 0 |
| API-016 unavailable/unsafe | safe Console error | `NOT_READY` after observation | 0 / 0 |
| API-017 `NOT_READY`/`UNKNOWN` | truthful operational status | `NOT_READY` | 0 / 0 |
| FEAT-022 provider-independent projection invalid/unavailable | safe Console error | `NOT_READY` | 0 / 0 |
| live provider `NOT_READY` under approved external hold | only live-provider surface unavailable | `DEGRADED` | provider call 0 |
| Core API-001/002 unavailable | `DEFERRED` / `NOT_AVAILABLE` on UI-006 | unrelated screens continue | hidden transport 0 |
| later successful owning read after transient API-015/016 failure | authoritative fresh data | failed observation cleared | stale READY cache 0 |
| restart/reload | new Session resolution and reconstructed ports | no prior access grant reused | stale authority 0 |

Readiness observation is process-local operational state only. It does not grant business authority, replace owning health truth, persist a new status, or turn live provider execution on.

API-015 read availability is an initial mandatory observation. The controlled command path is not probed at startup because doing so would create a mutation. Its configured handler shape is validated during composition; an actual thrown failure or `REJECTED/INTERNAL_ERROR` sets an independent command-failure latch, and only a later successful command clears that latch. A healthy automatic read refresh cannot mask it.
