# REL-001 Phase 1G-A Tenant / Scope Binding Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-071 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Security Owner / Data Owner |
| 기준 commit | `e2ef82655b3dc8f1ebadbdc2512f9e8492ea0059` |

## 1. Binding rule

Frozen Data Domain Model의 “organization/tenant boundary를 MVP부터 포함할지 여부” Open Decision을 보존한다. `Team != Tenant`; caller-supplied tenant/scope와 generic `tenantId`는 authority가 아니다.

## 2. Evidence-backed classification

| Store | Direct tenant ownership | Existing scope relationship | Classification | Concealment implication | Eligibility |
|---|---|---|---|---|---|
| Source Registry | none proven | source policy, allowed purpose/method and capture-time version; no tenant owner | `UNRESOLVED_BINDING` | tenant-safe lookup cannot be specified | `NOT_IMPLEMENTATION_READY` |
| Intake | none proven | raw-source/version and purpose parent references | `SCOPE_BOUND` + `UNRESOLVED_BINDING` | source/purpose filtering does not prove tenant isolation | `NOT_IMPLEMENTATION_READY` |
| Property | none proven | hierarchy/lineage references are not an authorization scope | `UNRESOLVED_BINDING` | hierarchy cannot substitute for tenant visibility | `NOT_IMPLEMENTATION_READY` |
| Listing | none proven | source/intake/property provenance refs; no canonical tenant owner | `UNRESOLVED_BINDING` | provenance filtering cannot substitute for tenant isolation | `NOT_IMPLEMENTATION_READY` |
| Contact | none proven | canonical team, purpose and channel use-scope relationships | `SCOPE_BOUND` + `UNRESOLVED_BINDING` | team/purpose checks remain required but do not establish tenant | `NOT_IMPLEMENTATION_READY` |
| Client / Requirement | none proven | canonical team, assigned-agent, client and purpose relationships | `SCOPE_BOUND` + `UNRESOLVED_BINDING` | team/agent visibility remains narrower than unresolved tenant ownership | `NOT_IMPLEMENTATION_READY` |
| Matching | none proven | team and exact Requirement/Candidate/Offer version references | `SCOPE_BOUND` + `UNRESOLVED_BINDING` | input binding does not establish tenant ownership | `NOT_IMPLEMENTATION_READY` |

## 3. Result

| Classification | Count |
|---|---:|
| Direct `TENANT_BOUND` | 0 |
| Evidence-backed `SCOPE_BOUND` | 4 |
| `SYSTEM_BOUND` | 0 |
| `UNRESOLVED_BINDING` | 7 |

All seven stores are blocked by the tenant/organization ownership prerequisite. No Team→Tenant equivalence or Organization hierarchy is proposed.

## 4. Phase 1G-C reconciliation

[DOC-DEV-079](REL001_PHASE1GC_TENANT_ORGANIZATION_CANONICAL_DECISION.md)이 별도 Tenant entity와 store별 binding을 승인했다. 본 절 이전의 수치는 Phase 1G-A 당시 판정으로 보존한다. Current disposition은 direct-bound store group `3`, derived-bound store group `3`, system-bound store `1`, unresolved `0`, ownership resolved `7/7`이다. Client / Requirement store는 Client direct binding과 Requirement derived binding을 함께 소유한다.
