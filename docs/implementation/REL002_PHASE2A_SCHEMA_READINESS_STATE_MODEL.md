# REL-002 Phase 2A Schema Readiness State Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-305 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity Owner / Operations Owner |
| 기준일 | 2026-09-18 |
| Baseline | Phase 1G strict read-only schema checker |

## 1. Internal readiness vocabulary

다음 값은 Production startup 내부 schema evidence다. 새 public API 또는 business lifecycle state가 아니다.

- `READY`
- `NOT_READY_MISSING_SCHEMA`
- `NOT_READY_INCOMPATIBLE_SCHEMA`
- `NOT_READY_UNSUPPORTED_VERSION`
- `NOT_READY_PARTIAL_MIGRATION`

## 2. Database state mapping

| Observed database state | Exact criteria | Internal readiness | Runtime behavior |
|---|---|---|---|
| `TABLE_ABSENT` | target workload table/index/contract row/migration ledger row가 모두 없음; shared metadata의 unrelated rows는 허용 | `NOT_READY_MISSING_SCHEMA` | startup 차단; migration 실행 안 함 |
| `TABLE_PRESENT_COMPATIBLE` | v1 structure/required indexes/target metadata/fingerprint와 exact migration ledger identity/checksum이 일치 | `READY` | 다음 startup validation 단계로 진행 |
| `TABLE_PRESENT_INCOMPATIBLE` | supported version을 주장하지만 structure/constraint/index/fingerprint가 다름 | `NOT_READY_INCOMPATIBLE_SCHEMA` | fail closed; 자동 repair 없음 |
| `SCHEMA_VERSION_UNSUPPORTED` | metadata version이 supported set `{1}` 밖 | `NOT_READY_UNSUPPORTED_VERSION` | fail closed; downgrade 없음 |
| `MIGRATION_PARTIALLY_APPLIED` | target table/index/metadata/ledger 중 일부만 존재, exact schema지만 ledger가 없음, 또는 ledger와 schema가 서로 불일치 | `NOT_READY_PARTIAL_MIGRATION` | fail closed; operator investigation/forward fix 필요 |

Database open/read 자체가 실패하면 schema state를 추정하지 않고 기존 `PRODUCTION_STARTUP_UNAVAILABLE` safe error를 유지한다.

## 3. `startProductionRuntime()` mapping

`openIdentityAuthorityReadOnly()`와 `assertSchemaReady()`는 Session UoW와 child root construction 이전에 실행된다. `READY`만 bootstrap gate input이 될 수 있다. 모든 `NOT_READY_*` 결과는 다음을 0으로 유지한다.

- Session UoW creation
- schema mutation/table creation/migration execution
- child root construction
- listener/worker start
- provider execution

현재 Phase 1G store는 mismatch를 bounded `IDENTITY_AUTHORITY_UNAVAILABLE`로 정규화한다. 후속 구현은 내부 상세 state를 readiness evidence로 분류할 수 있지만 외부 오류 내용이나 database diagnostic을 노출해서는 안 된다.

## 4. Partial migration precedence

1. unsupported metadata version이 읽히면 `NOT_READY_UNSUPPORTED_VERSION`.
2. shared metadata table 자체가 exact 3-column shape가 아니거나 supported v1 metadata가 있으나 required structure가 다르면 `NOT_READY_INCOMPATIBLE_SCHEMA`.
3. required target artifacts/metadata/ledger가 부분적으로 존재하면 `NOT_READY_PARTIAL_MIGRATION`.
4. 아무 artifact도 없으면 `NOT_READY_MISSING_SCHEMA`.
5. shared metadata의 unrelated contract rows는 허용한다.
6. runtime contract와 exact migration ledger identity가 모두 일치할 때만 `READY`.

## 5. Compatibility result

Migration output과 Phase 1G validator의 column/type/nullability/constraint/required-index/metadata contract mapping은 `PASS`다. 현재 checker가 unrelated extra indexes를 허용한다는 실제 동작도 보존한다. DEC-172 ledger는 별도 migration readiness evidence로 추가된다. Migration을 실행하지 않았으므로 Production runtime state는 계속 `NOT_READY_PHASE2_REQUIRED`다.
