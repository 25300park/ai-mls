# REL-001 Phase 2A Audit Identity / Chronology Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-112 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Audit Owner / Database Owner |
| 기준 commit | `e5a2cfc9a17cdb20c0c3db1e79e3184e7a09052f` |

## 1. Logical identity

- `auditIntentId` is the immutable source-to-final linkage.
- The final event stores the source domain, aggregate identity, mutation identity and `auditIntentId` as bounded provenance.
- Final logical event identity is deterministically bound to source domain plus `auditIntentId`; generated random identity is prohibited for materialization.
- Exact replay returns the same logical event and appends nothing.
- Same identity with a conflicting canonical payload fingerprint fails closed and preserves prior state.

## 2. Fingerprint boundary

The canonical fingerprint includes all immutable final event fields and source linkage except processing provenance `materializedAt`. Field order and evidence-reference order are normalized. Raw intent serialization is not the fingerprint contract.

## 3. Chronology

- `occurredAt` equals the authoritative source `committedAt`.
- `materializedAt` is trusted API-016 processing provenance and never replaces `occurredAt`.
- A missing or invalid source committed time blocks that intent.
- Ordering is deterministic by `occurredAt`, then source domain, then `auditIntentId`.

## 4. Final store invariant

API-016 owns one durable append-only final Audit Event store. Insert is atomic with identity/fingerprint registration. Update/delete are structurally rejected. Correction remains a new linked event. Materialization failure does not mutate or delete the Phase 1G intent.

## 5. Status

Intent identity binding and chronology are `RESOLVED`; final store implementation remains outside Phase 2A.
