# REL-001 Phase 2A Audit Runtime Configuration / Lifecycle

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-114 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Audit Owner / Operations Owner |
| 기준 commit | `e5a2cfc9a17cdb20c0c3db1e79e3184e7a09052f` |

## 1. Runtime ownership

`STAGING_API016_AUDIT_RUNTIME` is composed inside the existing Staging Platform Host. It owns API-016 application composition and the durable final-event store, but no domain authority, HTTP expansion or API-017 scheduling semantics.

## 2. Required configuration

- runtime mode fixed to Staging for REL-001;
- explicit API-016 final store path/reference;
- exact enabled set of the seven owner adapters;
- approved mapping-registry fingerprint/version;
- explicit internal materialization invocation mode;
- safe telemetry plus existing Health/Readiness projection.

Missing or malformed durable store, adapter, mapping registry or authorization/read boundary fails startup/readiness closed. There is no in-memory Production/Staging fallback.

## 3. Lifecycle

Materialization is an explicit synchronous/internal bounded scan invoked through API-016 application composition. It is not a scheduler, queue, polling daemon, lease, retry worker or new public operation. Autonomous processing is deferred to Phase 3/API-017.

## 4. Health and readiness

Existing FEAT-023 vocabulary only:

- store/adapters/mapping/read authorization all available: eligible for `READY` subject to normal component health;
- required durable final store unavailable: `NOT_READY`;
- unknown evidence: `UNKNOWN`, never `READY`;
- partial optional telemetry may degrade Health but cannot make missing mandatory audit durability ready.

## 5. External boundary

External sink, SIEM, network destination, credential and distributed transaction are excluded.

## 6. Status

Runtime lifecycle/configuration is `RESOLVED`; Production implementation remains unauthorized while mapping and principal provenance are blocked.
