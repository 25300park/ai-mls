# REL-001 Phase 2A Audit Intent Source Port Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-113 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Audit Owner / Domain Owners |
| 기준 commit | `e5a2cfc9a17cdb20c0c3db1e79e3184e7a09052f` |

## 1. Internal port

`AuditIntentSourcePort` is a bounded read-only internal port, not a generic cross-domain repository.

Minimum semantics:

- immutable canonical `sourceDomain` from the closed set of seven owners;
- `readByIntentId(intentId)` for exact stable lookup;
- bounded deterministic enumeration of eligible immutable intents using an opaque source-owned continuation;
- trusted tenant/system ownership binding carried from the source;
- no domain mutation, acknowledgement, deletion, retry, lease or scheduling method.

Each owner adapts its own existing store. The port does not merge store ownership or expose raw database handles.

## 2. Selection and replay

The API-016 runtime explicitly enables source adapters in configuration. Missing required adapters make readiness `NOT_READY`. Materialization success is identified in the API-016 final store; source intents are not marked or deleted. Re-enumeration is safe because stable intent identity makes exact replay append-free and conflict fail-closed.

## 3. Failure semantics

Reader or materializer failure leaves the intent authoritative and durable, produces no fabricated final event, changes no domain state and creates no duplicate. No autonomous retry semantics are defined.

## 4. Status

The seven-source reader contract is `RESOLVED`; implementation remains `0` in Phase 2A.
