# REL-002 Phase 2B Migration / Schema Compatibility Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-310 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Identity Owner / Data Owner |
| 기준일 | 2026-09-18 |
| Baseline | `cfc3d8b391be88e55dabb40ac13326aeaf1182e4` |

## 추적성

| 요구사항 | 구현 | 검증 | 결과 |
|---|---|---|---|
| 명시적 v1 migration artifact | `001_registered_service_workload_v1.up.sql` | artifact materialization 및 SHA-256 test | PASS |
| read-only verification artifact | `001_registered_service_workload_v1.verify.sql` | mutation keyword exclusion test | PASS |
| exact Identity-owned schema | `REGISTERED_SERVICE_WORKLOAD_SCHEMA_CONTRACT` 및 migration SQL | exact columns/checks/unique/index test | PASS |
| versioned schema contract | `identity_schema_contracts`, schema version 1, canonical fingerprint | version/fingerprint drift test | PASS |
| durable execution evidence contract | `identity_schema_migrations` schema와 exact ledger validation | missing/conflicting ledger tests | PASS |
| missing schema | `inspectRegisteredServiceWorkloadSchema()` | empty DB read-only inspection | `NOT_READY_MISSING_SCHEMA` |
| incompatible schema | exact column/constraint/index/checksum validation | column/index/check/ledger conflict tests | `NOT_READY_INCOMPATIBLE_SCHEMA` |
| unsupported version | target contract version classifier | schema version 2 test | `NOT_READY_UNSUPPORTED_VERSION` |
| partial migration | schema/metadata/ledger 삼중 결합 | schema-only 및 ledger-only tests | `NOT_READY_PARTIAL_MIGRATION` |
| runtime auto-create 금지 | runtime inspector/assertion은 SELECT/PRAGMA만 사용 | empty DB object count 0 | PASS |
| identity seeding 금지 | artifact는 registration row와 ledger evidence를 삽입하지 않음 | workload/ledger row count 0 after artifact | PASS |
| credential/RBAC duplication 금지 | exact 14-column allowlist | exact schema compatibility test | PASS |
| 기존 durable store 보존 | assertion wrapper가 `READY`만 허용 | Identity affected regression 56/56 | PASS |

## 경계

- Migration execution: `0` (테스트 임시 SQLite에서 artifact 계약만 검증)
- Production DB writes: `0`
- Production schema readiness: `NOT_READY_UNTIL_CONTROLLED_EXECUTION`
- Gaps 004/005/006: `BLOCKING`
- Dependency/lockfile changes: `0`
