# REL-001 Phase 3F Materialization Compatibility Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-154 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / API Owner |
| 기준일 | 2026-09-15 |
| 기준 commit | `d1c8664ff4ff872ec16519ed94f0c2b18397cd22` |

## 1. 호환성 결론

API-017은 기존 API-016 enriched-intent validator, read-only source port, materializer와 durable Audit Event store를 그대로 사용한다. 새로운 materializer, Audit store 또는 final-event write path는 없다.

## 2. Source compatibility

| Source domain | Enriched version | Source port | Final-event owner | 상태 |
|---|---|---|---|---|
| `SOURCE_REGISTRY` | `v2` | 기존 | API-016 | 보존 |
| `INTAKE` | `v2` | 기존 | API-016 | 보존 |
| `PROPERTY` | `v2` | 기존 | API-016 | 보존 |
| `LISTING` | `v2` | 기존 | API-016 | 보존 |
| `CONTACT` | `v2` | 기존 | API-016 | 보존 |
| `MATCHING` | `v2` | 기존 | API-016 | 보존 |
| `API-017` | `v2` | 기존 factory로 한 번 등록 | API-016 | 추가/검증 |

Staging API-016 composition은 정확한 source `7/7`이 있을 때만 READY다. 누락·중복·unknown source는 fail closed다.

## 3. Invariant compatibility

| Invariant | Phase 3F 결과 |
|---|---|
| strict source/event allowlist | API-017 exact 7-event tuple만 허용 |
| tenant/scope binding | source intent부터 final event까지 보존 |
| principal provenance | processing-time Session reconstruction 없이 mutation-time provenance 보존 |
| chronology | `occurredAt`과 `materializedAt` 분리 |
| replay/idempotency | restart 후 exact replay duplicate `0`; conflict fail closed |
| bounded pagination | code-unit comparator를 sort/filter/monotonic guard에 공통 적용; mixed-case/underscore `120/120` |
| append-only | 기존 final event update/delete path `0` |
| source durability | materialization failure 후 intent durable/replayable |
| concurrency | stale/losing Job mutation의 intent/final event `0` |
| unsafe content | raw stack/path/token evidence 거부 |
| retry lineage | predecessor evidence ref + successor target + reason 보존; 기존 100-ref 허용 범위 유지 |

## 4. 비변경 경계

- `v1` source intent materialization 규칙은 변경하지 않았다.
- Client/Requirement materialization 상태를 변경하지 않았다.
- API-017 operation, Job state, API-016 Audit vocabulary, public HTTP/RPC를 추가하지 않았다.
- Scheduler, polling, automatic retry, queue/message bus와 external provider/network를 추가하지 않았다.
