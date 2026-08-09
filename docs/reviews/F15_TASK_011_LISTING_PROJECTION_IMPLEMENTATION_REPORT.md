# F15-TASK-011 Listing Projection Implementation Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-082 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 작성일 | 2026-08-10 |
| Brief | F15-TASK-011 — PRJ-002 Listing Projection |

## 1. Final Recommendation

`APPROVE_F15_TASK_011_IMPLEMENTATION`

`PRJ-002` Listing Projection을 canonical Event Journal 기반의 비권위적이고 결정적이며 재구축 가능한 read model로 구현했다. `F15-TASK-012`는 시작하지 않았다.

## 2. Baseline Commit

- Branch: `main`
- Baseline/`origin/main`: `04bcfc9024da7a18938078b92cba1b28acce6d80`
- 시작 상태: working tree clean

## 3. F15-TASK-011A Dependency

- Dependency commit: `04bcfc9024da7a18938078b92cba1b28acce6d80`
- [F15-TASK-011A Event Provenance Amendment Report](F15_TASK_011A_EVENT_PROVENANCE_AMENDMENT_REPORT.md)
- `EVT-003/007/008/009`의 `publicationVersion`, `targetReference`, `channelReference`를 immutable Event provenance로 소비한다.

## 4. Implementation Commit

- Implementation commit: `SELF` — 본 보고서와 구현을 포함하는 단일 local commit

## 5. Commit Message

`feat(feat-015): implement prj-002 listing projection`

## 6. Files Created

- `modules/publication/src/listing-projection-contracts.ts`
- `modules/publication/src/listing-projection-error.ts`
- `modules/publication/src/listing-projection-store.ts`
- `modules/publication/src/in-memory-listing-projection-store.ts`
- `modules/publication/src/listing-projection.ts`
- `modules/publication/src/listing-projection-rebuild.ts`
- `modules/publication/src/listing-projection.test.ts`
- `docs/reviews/F15_TASK_011_LISTING_PROJECTION_IMPLEMENTATION_REPORT.md`

## 7. Files Modified

- API query contract/facade/tests: `apps/api/src/publication-api-contracts.ts`, `publication-api.ts`, `publication-api.test.ts`
- Publication exports/wiring/tests: `modules/publication/src/index.ts`, `publication-infrastructure-configuration.ts`, `publication-infrastructure.ts`, `publication-infrastructure.test.ts`, `publication-runtime-contracts.ts`, `publication-runtime-registry.ts`, `publication-runtime.test.ts`
- Traceability evidence: `docs/implementation/FEAT015_TRACEABILITY_MATRIX.md`

## 8. PRJ-002 Architecture

Immutable Publication Domain Event → `ListingProjectionConsumer` → optimistic `ListingProjectionStore` → immutable `ListingProjectionRecord` → query-only `ListingProjectionReadService` 경로를 구현했다. Source Aggregate나 Event Journal은 변경하지 않는다.

## 9. Projection Non-Authority Boundary

Projection, query, rebuild는 Publish, Approve, Withdraw, Republish 또는 다른 business decision을 생성하지 않는다. Aggregate, connector, notification과 Publication command port를 호출하지 않는다.

## 10. Projection Record Contract

Record는 Publication identity/lifecycle/suspension, Aggregate·Publication·effective version, last Event identity/sequence/integrity, Target/Channel, classification/privacy/purpose, projection definition/schema/record version, generation, stale metadata와 bounded applied Event identity만 보존한다.

## 11. Projection Lifecycle

Generation lifecycle은 `BUILDING`, `ACTIVE`, `STALE`, `REBUILDING`, `FAILED`, `ARCHIVED`로 business lifecycle과 분리했다. Serving pointer는 `(tenantId, publicationId)`별로 격리된다.

## 12. Event Consumption

Consumer는 injected shared `PublicationEventJournal.findByEventId(tenantId, eventId)`로만 Event를 취득한다. Caller payload, audit record, Aggregate 조회 또는 임의 Event 객체는 projection source가 아니다.

## 13. 011A Provenance Consumption

필수 Event의 branded, integrity-bound 011A provenance를 Event validation에서 확인하고 exact `publicationVersion`, Target와 Channel lineage를 Projection record로 전파한다. 누락 또는 충돌은 fail closed다.

## 14. Event Mapping Matrix

| Event | Disposition | Projection effect |
|---|---|---|
| `EVT-003` | APPLY | listing `ACTIVE` 생성 |
| `EVT-004` | APPLY | suspension 상태 반영 |
| `EVT-005` | NO_STATE_CHANGE | source progress만 검증·기록 |
| `EVT-006` | APPLY | reconciliation 결과 progress 반영 |
| `EVT-007` | APPLY | `WITHDRAWN` 반영 |
| `EVT-008` | APPLY | republish `ACTIVE` 반영 |
| `EVT-009` | APPLY | material-change lineage 반영 |
| `EVT-010/011` | CONTROL | rebuild control progress 반영 |
| `EVT-012` | NO_STATE_CHANGE | validated replay progress 반영 |

## 15. Duplicate Handling

동일 Event identity·sequence·integrity는 projection mutation 없이 `DUPLICATE_IGNORED` evidence를 추가한다. 동일 identity의 다른 내용은 `PROJECTION_EVENT_DUPLICATE_CONFLICT`로 거부한다.

## 16. Event Sequence Enforcement

Aggregate-local sequence 1 시작, 단조 증가, gap/out-of-order/identity conflict를 검증한다. Global ordering은 요구하거나 생성하지 않는다.

## 17. Version Model

Aggregate version, Publication version, Event contract/schema version, Projection definition/schema version, Projection record version과 generation identity를 독립적으로 유지한다. Store save는 optimistic record version을 정확히 1 증가시킨다.

## 18. Classification/Privacy/Purpose

Event의 source classification, privacy scope와 purpose를 상속한다. 기존 record와의 downgrade/expansion 또는 Target/Channel lineage 변경을 거부하며 serving CAS도 candidate generation metadata와 final record의 값을 정확히 비교한다.

## 19. Projection Store Port

Serving/read-by-generation, optimistic save, atomic record+audit save, generation create/delete/read/mark, per-Publication serving read와 compare-and-swap만 제공한다. Business command API는 없다.

## 20. In-Memory Projection Store

Injected in-memory adapter는 immutable copy, tenant/publication/generation isolation, optimistic concurrency, atomic record rollback과 serving CAS를 구현한다. Physical database, ORM, Queue 또는 process-global singleton은 추가하지 않았다.

## 21. Drift Detection

Sequence/order, source/publication/schema/definition version, integrity/provenance, tenant, classification/privacy/purpose drift를 canonical safe code로 거부한다. `DRIFT_DETECTED` audit 실패가 원래 safe error를 대체하지 않는다.

## 22. Stale Behaviour

Drift audit 성공 후에만 stale record와 `PROJECTION_MARKED_STALE` audit을 원자적으로 저장한다. Stale record는 일반 Event apply를 차단하고 query는 bounded `stale`/`staleReason`을 노출한다.

## 23. Rebuild Coordinator

권한 검증 후 isolated generation을 만들고 immutable Event Journal을 순서대로 replay한다. final source progress, schema/definition과 보안 metadata를 검증한 뒤에만 serving cutover를 시도한다.

## 24. Rebuild Authorization Boundary

`ListingProjectionRebuildAuthority`를 injected read-only boundary로 사용하며 기본값은 deny다. Purpose는 `PROJECTION_REBUILD`로 제한되고 Publication business authority를 부여하지 않는다.

## 25. Isolated Generations

Rebuild는 serving generation을 직접 수정하지 않는다. 실패 candidate는 `FAILED`로 격리하며 bootstrap apply 실패의 빈 non-serving generation은 제거해 동일 Event 재시도를 허용한다.

## 26. Atomic Cutover

CAS는 expected predecessor, candidate completeness, final progress, definition/schema, stale=false, classification/privacy/purpose와 Target/Channel 일치를 검증한다. Cutover evidence 실패 시 prior serving pointer와 lifecycle을 복원하며 predecessor가 없으면 pointer를 제거한다.

## 27. Rebuild Determinism

동일 canonical Event stream은 generation ID와 technical timestamp를 제외한 동일 semantic record를 생성한다. Rebuild는 Aggregate와 Event Journal을 변경하지 않는다.

## 28. Projection Audit

Event apply/duplicate/drift/stale, rebuild request/start/failure/validation, cutover/archive를 bounded append-only audit로 기록한다. Raw Event payload, customer/contact data와 stack/internal error를 복제하지 않는다.

## 29. Projection Idempotency

Event apply는 Event identity로, rebuild는 tenant/projection/idempotency key와 deterministic fingerprint로 멱등성을 보장한다. Same key/different fingerprint와 optimistic conflicts는 fail closed다.

## 30. Query Boundary

`ListingProjectionReadService.getServing()`은 immutable bounded view 또는 undefined만 반환한다. stale/provenance/version은 제공하지만 authority나 command surface는 제공하지 않는다.

## 31. API-014 Integration

API-014에 query-only `GET_LISTING_PROJECTION`을 추가했다. Session-derived Actor와 current authorization을 source Aggregate version 기준으로 재검증하며 Aggregate repository 조회 없이 Projection read boundary만 호출한다.

## 32. Runtime Registration

Runtime registry가 `listingProjectionStore`, `listingProjectionAudit`, `listingProjectionConsumer`, `listingProjectionRead`, `listingProjectionRebuild`를 명시적으로 검증·등록한다.

## 33. Infrastructure Wiring

Infrastructure는 기존 Clock과 동일 Event Journal identity를 모든 Projection consumer/rebuild에 주입한다. 별도 Journal, connector 또는 persistence technology를 만들지 않는다.

## 34. Composition Registration

기존 canonical Composition Root가 생성하는 단일 Infrastructure/Runtime graph를 그대로 통과한다. 별도 composition 경로나 전역 mutable service를 추가하지 않았다.

## 35. Direct Test Results

`listing-projection.test.ts`의 17개 테스트가 Event mapping, duplicate, failure atomicity/retry, ordering/version/drift/stale, provenance/security, store isolation/CAS, rebuild/rollback/idempotency/audit와 registration을 직접 검증했다.

## 36. Integration Test Results

API-014 통합 테스트는 PRJ-002 조회가 Projection boundary를 통과하고 Aggregate repository lookup을 0회 수행하며 current authorization revalidation을 적용함을 검증했다. Infrastructure/Runtime tests는 shared Journal과 동일 service identity를 확인했다.

## 37. Rebuild Test Results

Isolated deterministic replay, serving preservation, per-Publication cutover, prior archive, repeated request replay, unauthorized/empty source rejection, post-cutover evidence rollback, 최초 cutover rollback과 audit failure sanitization을 검증했다.

## 38. Total Tests

Fresh `pnpm.cmd verify`: 556/556 PASS, fail 0, skipped mandatory test 0.

## 39. Verification Results

| Gate | Result |
|---|---|
| Node / pnpm | PASS — v24.18.0 / 11.9.0 |
| Install | PASS — frozen lockfile, 변경 0 |
| Lint | PASS, warnings 0 |
| Typecheck | PASS |
| Build | PASS |
| Verify | PASS — 556/556 |
| Test | PASS — 556/556 |
| `git diff --check` | PASS |
| Markdown relative links | PASS |

## 40. Architecture Checksum

PASS — frozen primary Architecture scope 153/153 변경 0, baseline SHA-256 `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` 유지.

## 41. Gitleaks

`gitleaks detect --source . --config .gitleaks.toml --redact --no-banner`: PASS, actual secrets 0, unexplained findings 0.

## 42. Production Audit

`pnpm.cmd audit --prod`: PASS, known production vulnerabilities 0.

## 43. Full Audit

Direct/production vulnerability 0. 기존 승인된 dev-only transitive `brace-expansion` High advisory 4건만 존재하며 dependency 자동 수정, manifest 또는 lockfile 변경을 수행하지 않았다.

## 44. Independent Review

최종 독립 재검토: Critical 0, Important 0, Minor 0, `READY`. Bootstrap retry, audit failure containment, CAS metadata, per-Publication isolation과 전체 Brief 경계를 재검증했다.

## 45. Scope Protection

Publication Aggregate business rules, Event Journal, authorization semantics, connector, notification, physical persistence, DB/ORM/schema/migration, Queue/Event Bus/Worker, 새로운 API command와 `F15-TASK-012` Operations/Observability를 구현하거나 변경하지 않았다.

## 46. Traceability Update

[FEAT-015 Traceability Matrix](../implementation/FEAT015_TRACEABILITY_MATRIX.md)의 `F15-TASK-011` 행만 `IMPLEMENTED_AND_VERIFIED`로 갱신했다. `F15-TASK-012`는 `PENDING`을 유지한다.

## 47. Remaining Risks

- Projection storage는 승인된 logical in-memory foundation이며 physical persistence는 deferred다.
- `EVT-009` production source trigger는 기존 `CONTRACT_ONLY` 경계를 유지한다.
- Full audit의 승인된 dev-only transitive advisory는 production 영향이 없지만 upstream remediation을 계속 추적해야 한다.

## 48. Next Recommended Task

Architecture Owner가 본 Task를 승인한 뒤에만 별도 Brief로 `F15-TASK-012`를 검토한다. 자동 시작하지 않는다.

## 49. Working Tree Status

Completion commit 직후 clean 상태를 검증한다.

## 50. Push Status

`NOT_PUSHED`

## 51. Governance Completion Evidence

1. Objective: canonical `PRJ-002` Listing Projection 구현·검증.
2. Documents read: F15-TASK-011 Resumed Brief, Task 011A report/contract, FEAT-015 plan/task/RTM/test strategy, Projection/Event/API/Workflow/Security registries와 frozen Architecture baseline.
3. Files created: §6 참조.
4. Files modified: §7 참조.
5. Key decisions added: 새 Architecture Decision 없음. 승인된 Event-only, non-authority, isolated rebuild/CAS 경계를 구현했다.
6. Open decisions: physical Projection persistence와 deferred runtime products.
7. Inconsistencies found: 최종 unresolved inconsistency 0.
8. Validation performed: §35~44 참조.
9. Known limitations: §47 참조.
10. Next brief prerequisites: Architecture Owner acceptance와 별도 `F15-TASK-012` authorization.

## Completion Statement

본 보고서는 `F15-TASK-011` 범위만 다룬다. 검증과 단일 local commit 후 중단하며 Push와 `F15-TASK-012` 시작은 수행하지 않는다.
