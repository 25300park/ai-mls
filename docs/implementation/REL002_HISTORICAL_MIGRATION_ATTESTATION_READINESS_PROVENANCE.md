# REL-002 Historical Migration Attestation Readiness Provenance

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-364 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Runtime Owner / Identity Owner |
| Decision | DEC-193 |

## 공개되는 내부 provenance

`ProductionBootstrap`은 Identity schema readiness가 어떤 증거 경로로 충족되었는지 `identitySchemaReadinessProvenance`로 보존한다.

| 값 | 의미 |
|---|---|
| `NATIVE_MIGRATION_LEDGER_VERIFIED` | canonical native ledger가 true `applied_at`을 포함해 exact 검증됨 |
| `HISTORICAL_MIGRATION_ATTESTATION_VERIFIED` | DEC-193 exact exception과 current exact schema/evidence refs가 검증됨 |

두 값은 readiness를 충족할 수 있으나 provenance 의미는 합치지 않는다. Historical 값은 `NATIVE_MIGRATION_EXECUTION_RECORDED`를 뜻하지 않는다.

## Fail-closed rule

provenance가 null이거나 schema readiness가 `READY`가 아니면 `ProductionBootstrap`은 Session UoW, child roots, listener, worker 또는 provider-capable path를 시작하지 않는다. Native evidence와 historical attestation이 동시에 존재하면 readiness를 거부한다.
