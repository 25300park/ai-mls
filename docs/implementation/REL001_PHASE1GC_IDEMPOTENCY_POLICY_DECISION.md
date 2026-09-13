# REL-001 Phase 1G-C Idempotency Policy Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-080 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Data Owner / Domain Owners |
| 기준 commit | `e2ef82655b3dc8f1ebadbdc2512f9e8492ea0059` |

## 1. Canonical decision

`MIXED DOMAIN-OWNED IDEMPOTENCY`를 채택한다. universal idempotency mechanism과 generic Core idempotency table은 금지한다. `requestId`는 `CORRELATION_ONLY`이며 replay authority가 아니다.

## 2. Shared semantics

- `COMMAND_ID_BASED`: same `commandId` + same canonical input은 prior logical result를 replay하고, same `commandId` + different canonical input은 conflict이다.
- `VERSION_ONLY`: current aggregate version과 exact expected version으로 stale mutation을 거부하며 logical replay를 발명하지 않는다.
- `APPEND_DEDUP`: domain-owned stable evidence/history identity로 duplicate append를 방지하고 기존 append-only record를 변경하지 않는다.
- 각 key/fingerprint와 replay 결과는 해당 domain store가 소유한다.

## 3. Store policies

| Store | Create/proposal | Update/decision | Evidence/history |
|---|---|---|---|
| Source Registry | `COMMAND_ID_BASED` | existing version semantics | domain history |
| Intake | create `COMMAND_ID_BASED` | `VERSION_ONLY` | `APPEND_DEDUP` |
| Property | proposal/alias `COMMAND_ID_BASED` | `VERSION_ONLY` | immutable lineage/history |
| Listing | create `COMMAND_ID_BASED` | revision/decision `VERSION_ONLY` | immutable provenance/history |
| Contact | create `COMMAND_ID_BASED` | `VERSION_ONLY` | communication/evidence `APPEND_DEDUP` |
| Client / Requirement | both creates `COMMAND_ID_BASED` | authoritative updates `VERSION_ONLY` | history/evidence `APPEND_DEDUP` |
| Matching | existing canonical request idempotency key | review/stale mutation `VERSION_ONLY` | history/evidence `APPEND_DEDUP` |

## 4. Restrictions

- no universal `requestId` semantics.
- no second Matching replay mechanism.
- no implicit Contact Case creation.
- idempotency does not grant authorization, tenant access or lifecycle authority.

Related: [Phase 1G-A Concurrency / Idempotency Matrix](REL001_PHASE1GA_CONCURRENCY_IDEMPOTENCY_MATRIX.md), [Phase 1G-B Idempotency Closure](REL001_PHASE1GB_IDEMPOTENCY_CLOSURE_MATRIX.md), [Store Policy Mapping](REL001_PHASE1GC_STORE_POLICY_MAPPING.md).
