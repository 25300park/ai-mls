# REL-001 Phase 1G-C Audit Atomicity Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-081 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Audit Owner / Data Owner / Domain Owners |
| 기준 commit | `e2ef82655b3dc8f1ebadbdc2512f9e8492ea0059` |

## 1. Canonical decision

`OPTION B — DOMAIN COMMIT + DURABLE OUTBOX / EVIDENCE INTENT`를 채택한다.

다음 항목은 owner-local SQLite transaction 하나에서 함께 commit되어야 한다.

1. authoritative domain mutation;
2. domain history/idempotency state;
3. immutable audit/evidence intent.

audit intent 저장이 실패하면 전체 domain mutation을 rollback한다. authoritative mutation이 mandatory audit intent 없이 성공하는 경로는 `0`이다.

## 2. Ownership boundary

Core/domain store는 `AUDIT_INTENT` 또는 `EVIDENCE_INTENT`만 소유한다. API-016은 final Audit Event vocabulary, lifecycle 및 append/materialization authority를 계속 소유한다. Core는 final Audit Event를 만들거나 API-016 semantics를 복제하지 않는다.

## 3. Minimum audit-intent contract

| Field | Rule |
|---|---|
| `intentId` | stable, immutable, domain-owned dedup identity |
| domain owner | canonical owner identifier |
| aggregate identity | exact governed aggregate binding |
| mutation/command identity | exact logical mutation linkage |
| actor/system provenance | trusted safe provenance only |
| event classification/reference | safe domain classification/reference; not final API-016 vocabulary |
| `occurredAt` / `committedAt` | immutable occurrence/commit provenance |
| tenant/scope binding | required where the governed store is tenant-bound |
| evidence refs | bounded safe references only |

Materialization status/reference는 later API-016 design에서 요구될 때만 추가할 수 있으며 Phase 1G-C가 발명하지 않는다.

## 4. Materialization and failure semantics

- Later API-016 runtime은 stable `intentId`를 사용해 append-only canonical Audit Event를 idempotently materialize한다.
- duplicate materialization은 `0`이어야 한다.
- materialization은 source domain record를 rewrite하지 않는다.
- API-016 unavailability는 committed audit intent를 지우거나 domain mutation을 재실행하게 하지 않는다.
- distributed transaction과 cross-process two-phase commit은 금지한다.

Related: [Phase 1G-A Transaction / Evidence Matrix](REL001_PHASE1GA_TRANSACTION_EVIDENCE_BOUNDARY_MATRIX.md), [Phase 1G-B Audit Dependency Matrix](REL001_PHASE1GB_AUDIT_DEPENDENCY_MATRIX.md), [Store Policy Mapping](REL001_PHASE1GC_STORE_POLICY_MAPPING.md).
