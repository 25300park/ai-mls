# REL-001 Phase 3A API-017 canonical inventory 보고서

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-182 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner / API Owner |
| 기준 commit | `7f7661d791c6268204f2453f6a500e0553cbfab7` |
| 기준일 | `2026-09-14` |
| Brief | REL-001 Runtime Foundation Phase 3 — API-017 Durable Jobs Runtime Foundation |

## 1. 목표

API-017의 frozen contract, existing code, persistence, authority, audit, worker topology와 release gap을 실제 evidence로 대조하고 Phase 3B/3C 진입 조건을 확정한다. Production/Test implementation은 수행하지 않는다.

## 2. 읽은 문서

- [Background Job Contracts](../book-6/11_BACKGROUND_JOB_CONTRACTS.md)
- [Event and Job Architecture](../book-2/06_EVENT_AND_JOB_ARCHITECTURE.md)
- [Data Dictionary](../book-3/15_DATA_DICTIONARY.md)
- [Status Dictionary](../book-5/13_STATUS_DICTIONARY.md)
- [State Transition Rules](../book-5/14_STATE_TRANSITION_RULES.md)
- [API Registry](../book-6/16_API_REGISTRY.md)
- [Phase 0 topology](../implementation/REL001_PHASE0_STAGING_RUNTIME_TOPOLOGY_DESIGN.md)
- [Phase 0 lifecycle](../implementation/REL001_PHASE0_STARTUP_LIFECYCLE_MATRIX.md)
- [Phase 2 API-016 final traceability](../implementation/REL001_PHASE2_API016_FINAL_TRACEABILITY_MATRIX.md)
- [FEAT-019 traceability](../implementation/FEAT019_TRACEABILITY_MATRIX.md)
- [FEAT-023 readiness evidence](../implementation/FEAT023_F_DEPLOYMENT_BACKUP_ROLLBACK_READINESS_IMPLEMENTATION_PLAN.md)
- [FEAT-024 traceability](../implementation/FEAT024_TRACEABILITY_MATRIX.md)
- [`JobService`](../../modules/jobs/src/job-service.ts), [`JobApi`](../../apps/api/src/job-api.ts), [API composition](../../apps/api/src/composition.ts)

## 3. 생성 파일

- [Runtime Inventory Gap Matrix](../implementation/REL001_PHASE3_API017_RUNTIME_INVENTORY_GAP_MATRIX.md)
- [Lifecycle and Authority Matrix](../implementation/REL001_PHASE3_API017_LIFECYCLE_AUTHORITY_MATRIX.md)
- [Persistence Readiness Matrix](../implementation/REL001_PHASE3_API017_PERSISTENCE_READINESS_MATRIX.md)
- [Conditional Implementation Plan](../implementation/REL001_PHASE3_API017_IMPLEMENTATION_PLAN.md)
- 이 보고서.

## 4. 수정 파일

- `docs/00_MASTER_INDEX.md`: `DOC-DEV-125`–`128`과 `DOC-REVIEW-182` 등록만 수정했다.
- Global canonical RTM, `DEV-018`, `IMP-018`은 변경하지 않았다. 이들의 canonical mapping/status는 runtime completion evidence가 아니다.

## 5. 추가된 핵심 결정

- 새 canonical decision: `None`.
- 인벤토리 판정: frozen logical API-017 operation count는 `5`이며 현재 seven-method adapter는 새 canonical operation grant가 아니다.
- 인벤토리 판정: bounded in-process Staging fallback은 topology-approved지만 identity, lifecycle, policy, audit, persistence contract가 close되기 전에는 executable하지 않다.
- 인벤토리 판정: `EVT-010`–`012`과 FEAT-019 recovery evidence는 generic API-017 audit/recovery authority를 부여하지 않는다.

## 6. Open decision

- **OPEN DECISION:** AI Job와 Retention Job vocabulary를 포함한 supported job class와 per-type lifecycle.
- **OPEN DECISION:** durable job/attempt/lease identity와 tenant/scope ownership.
- **OPEN DECISION:** claim/lease/heartbeat identity, value, interrupted execution behavior.
- **OPEN DECISION:** retry ceiling, retryable failure mapping, delay/backoff source.
- **OPEN DECISION:** exact five operation schema와 bounded execution-handler registry.
- **OPEN DECISION:** 아홉 required lifecycle action에 대한 API-017 enriched audit intent/event mapping.
- **OPEN DECISION:** new service principal 없이 immutable worker/scheduler provenance를 보존하는 방법.

## 7. 발견된 불일치

| ID | 불일치 | 영향 | 판정 |
|---|---|---|---|
| `P3A-INC-001` | frozen five operation과 current seven adapter method가 다르고 distinct `ReadJobResult`가 없다. | current class를 그대로 노출해서는 transport를 close할 수 없다. | Phase 3B schema/operation mapping이 필요하다. |
| `P3A-INC-002` | AI Job lifecycle과 Retention Job lifecycle이 다르다. | 하나의 generic durable status schema는 normalization을 새로 만들게 된다. | per-type canonical decision이 필요하다. |
| `P3A-INC-003` | worker lease authority와 Session-derived `start/succeed/fail`, fabricated scheduler principal이 충돌한다. | 재시작 뒤 worker/scheduler authority를 신뢰할 수 없다. | execution provenance decision이 필요하다. |
| `P3A-INC-004` | API-016이 final event를 소유하지만 JobService가 final-looking audit record를 직접 append한다. | job evidence는 approved six-source mapping을 사용할 수 없다. | new approved source mapping이 필요하며 direct final event는 금지된다. |
| `P3A-INC-005` | Phase 0은 durable tenant/scope/job identity를 요구하지만 current job은 optional team만 저장한다. | cross-tenant isolation을 증명할 수 없다. | exact binding decision이 필요하다. |
| `P3A-INC-006` | caller `failureCode`는 nonblank 검사만 거친 뒤 stored `SystemErrorReference` 및 audit reason에 도달할 수 있다. normalization, allowlist, bounds, redaction은 `NOT_PROVEN`. | safe failure reference 또는 audit reason의 안전성을 주장할 수 없다. | `P3A-GAP-013`의 approved safe failure vocabulary 및 projection 결정/검증이 필요하다. |

## 8. 수행한 검증

| 검사 | 결과 |
|---|---|
| API-017 canonical operation inventory | `5/5`를 식별했다. |
| Lifecycle states | AI Job `6`; Retention Job distinct `6` |
| Transport-executable operations | `0/5` |
| Durable-ready operations | `0/5` |
| Handler-backed job types | `0` |
| Unresolved lifecycle decision groups | `3` |
| Unresolved authority decision groups | `3` |
| Unresolved numeric retry decision groups | `2` |
| API-017 audit mapping readiness | `0/9` |
| Persistence readiness | `0/5` |
| Worker composition readiness | `NOT_READY`; semantic closure 뒤에만 in-process fallback을 사용할 수 있다. |
| Production/Test changes | `0` |
| Dependency/lockfile changes | `0` |
| Dependency audit | `NOT_RUN` — network approval이 없고 docs-only inventory에 필요하지 않다. |
| Independent review | `Critical 0 / Important 0 / Minor 0 — READY` |

## 9. 알려진 제한

- 이 보고서는 durable schema, worker, lease, scheduler, retry policy, handler, transport 또는 audit mapping을 승인하지 않는다.
- Phase 1 Core Transport는 HOLD를 유지하며 Phase 1의 API-017-dependent Core operation 세 개를 다시 열지 않는다.
- FEAT-022 advisory worker integration은 Phase 4에 남는다.
- REL-001은 `INCOMPLETE`를 유지하며 historical FEAT-024 candidate/report는 변경하지 않는다.

## 10. 다음 brief 사전 조건

Phase 3B는 위 open decision을 위한 AO-reviewed canonical decision closure로만 시작할 수 있다. Phase 3C Production/Test TDD는 Phase 3B 승인 뒤 별도 authorization이 필요하다. Phase 3A는 commit, main integration 또는 push를 승인하지 않는다.

## Phase 3A 최종 산출

| 지표 | 결과 |
|---|---|
| API-017 canonical operations | `5` |
| Lifecycle states found | AI `6`; Retention `6`, cross-type mapping은 미해결 |
| Transport-executable operations | `0/5` |
| Durable-ready operations | `0/5` |
| Audit mapping readiness | `0/9` |
| Persistence readiness | `0/5` |
| Worker composition readiness | `NOT_READY` |
| Phase 3B recommendation | `START_DOCUMENTATION_ONLY_CANONICAL_CLOSURE` |

Final Recommendation:

`APPROVE_REL001_PHASE3A_API017_CANONICAL_INVENTORY`

## Phase 3A 연계 문서

- [Runtime Inventory Gap Matrix](../implementation/REL001_PHASE3_API017_RUNTIME_INVENTORY_GAP_MATRIX.md)
- [Lifecycle and Authority Matrix](../implementation/REL001_PHASE3_API017_LIFECYCLE_AUTHORITY_MATRIX.md)
- [Persistence Readiness Matrix](../implementation/REL001_PHASE3_API017_PERSISTENCE_READINESS_MATRIX.md)
- [Conditional Implementation Plan](../implementation/REL001_PHASE3_API017_IMPLEMENTATION_PLAN.md)
