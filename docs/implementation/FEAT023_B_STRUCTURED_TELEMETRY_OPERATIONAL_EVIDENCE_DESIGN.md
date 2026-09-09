# FEAT-023-B Structured Telemetry / Operational Evidence Foundation Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-037 |
| Version | v0.1 |
| Status | APPROVED |
| Owner | Architecture Owner / Security / Operations Owners |
| Baseline | `657fc4e28e13bd8a73885895a10af613e91db208` |

## 1. 목적

승인된 FEAT-023 amendment의 canonical telemetry record와 bounded durable operational projection store를 구현한다. Domain truth, alert evaluation, health/readiness/freshness 계산, business authority 및 external monitoring은 이 phase에 포함하지 않는다.

## 2. Boundary

`OperationalTelemetryRecord`는 amendment의 required field와 optional identity reference만 허용한다. Unknown field, free-text payload, unsafe reference, credential-like reference, non-canonical timestamp 및 bounded limit 초과는 fail closed한다. 반환 record와 collection은 immutable snapshot이다.

## 3. Persistence

`DurableOperationalEvidenceStore`는 Node.js `node:sqlite`와 explicit file path를 사용한다. 하나의 append-only `operational_telemetry` table에는 normalized telemetry reference만 저장하고 complete domain object는 저장하지 않는다. `telemetryEventId`는 immutable identity이며:

- same identity + same canonical record: prior authoritative record 반환;
- same identity + conflicting record: `TELEMETRY_IDENTITY_CONFLICT`;
- close/reopen: committed record와 ordering 보존;
- malformed/corrupt stored record: `PERSISTENCE_UNAVAILABLE`로 fail closed.

UPDATE/DELETE trigger는 normal operation에서 evidence replacement/deletion을 금지한다. Production factory는 빈 path와 in-memory SQLite path를 거부하며 silent fallback을 제공하지 않는다.

## 4. Read boundary

Store read는 exact `telemetryEventId` 또는 bounded exact filter(`component`, `resourceRef`, `correlationId`)만 허용한다. FEAT-023-B는 HTTP/API/Console read를 노출하지 않는다. Tenant/scope authorization과 presentation은 후속 approved phase에서 기존 API ownership을 통해 결합한다.

## 5. Safety

String field는 categorical token 또는 opaque safe reference로 제한한다. Email/free text/JSON/header/cookie/token/raw payload 형태는 accepted telemetry content가 될 수 없다. `safeErrorCode`는 bounded category code이며 raw error/stack을 저장하지 않는다. `evidenceRefs`와 optional identity는 bounded collection/reference만 허용한다.

## 6. TDD evidence

RED는 missing contract/store module을 직접 import하여 실패해야 한다. GREEN test는 exact schema, unknown field, unsafe secret/PII/raw payload, immutability, restart, idempotent replay, conflicting identity, append-only DB trigger, invalid path 및 no-domain-mutation architecture를 검증한다.

## 7. Exclusions

- Alert category/lifecycle evaluation
- Health/readiness/freshness projection
- Incident workflow
- Backup/deploy/rollback execution
- New API ID or business command
- External network, provider, credential or dependency
