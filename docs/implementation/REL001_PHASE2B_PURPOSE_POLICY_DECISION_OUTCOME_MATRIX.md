# REL-001 Phase 2B Purpose / Policy / Decision / Outcome Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-118 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Audit Owner / Security/Governance Owner / Domain Owners |
| 기준 commit | `e5a2cfc9a17cdb20c0c3db1e79e3184e7a09052f` |

## 1. Field rules

- `purpose`: `REQUIRED_FROM_SOURCE` for every mapped operation because current canonical services authorize and audit using trusted mutation purpose. Source Registry uses canonical `SOURCE_GOVERNANCE`; other sources capture the trusted operation context.
- `policyVersion`: `REQUIRED` for every mapped operation because each existing service binds the AuthorizationService policy version. It must be captured at mutation time; no processing-time substitution is allowed.
- `decision`: `REQUIRED_FROM_SOURCE`. The mapped committed path records the exact authorization result already used by the operation. `ALLOW` is valid only when explicitly captured, never inferred from transaction commit. `DENY` does not create a mutation intent. `NOT_APPLICABLE` is reserved for an existing event whose canonical meaning has no decision.
- `outcome`: `REQUIRED_FROM_SOURCE`. It records domain truth, not storage success.

## 2. Source matrix

| Source/event category | Purpose | policyVersion | decision | outcome |
|---|---|---|---|---|
| Source Registry proposal | required; `SOURCE_GOVERNANCE` | required from trusted policy context | captured authorization result | `ACCEPTED` |
| Intake command accepted | required from Intake/source provenance | required | captured authorization result | `ACCEPTED` |
| Intake state change | required from Intake | required | captured authorization result | `COMPLETED` |
| Intake evidence append | required from Intake | required | captured authorization result | `COMPLETED` |
| Property proposal | required from trusted operation | required | captured authorization result | `COMPLETED` as existing canonical event behavior |
| Property decision/state change | required from trusted operation | required | captured authorization result; business decision stays in domain evidence | `COMPLETED` |
| Listing create/proposal | required from trusted operation | required | captured authorization result | `COMPLETED` as existing canonical event behavior |
| Listing revision/disposition | required from trusted operation | required | captured authorization result; business disposition stays in domain evidence | `COMPLETED` |
| Contact create/state change | required from trusted operation | required | captured authorization result | `COMPLETED` |
| Contact communication evidence | required from Contact Case/operation | required | captured authorization result | `COMPLETED`; communication outcome remains domain evidence |
| Client / Requirement create/change | required from trusted operation | required | captured authorization result | `COMPLETED` |
| Matching create/change | required from trusted operation | required | captured authorization result | `COMPLETED`; review result remains domain evidence |

## 3. Rejection and unknown outcomes

Authorization denial or validation rejection before a durable mutation produces no Phase 1G intent and stays on the existing direct audit path. A later operation with genuinely unknown domain outcome must capture existing `UNKNOWN`; it must not be converted to `COMPLETED`. No mapped Phase 1G committed operation currently requires that case.

## 4. Status

Purpose, policyVersion, decision and outcome contracts are `RESOLVED` for v2. They remain absent from v1 and may not be reconstructed.
