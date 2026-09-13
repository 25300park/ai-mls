# REL-001 Phase 1G-B Tenant / Organization Ownership Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-074 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Security Owner / Data Owner |
| 기준 commit | `e2ef82655b3dc8f1ebadbdc2512f9e8492ea0059` |

## Decision

`ORGANIZATION_TENANT_RELATIONSHIP_UNRESOLVED`

Current canonical evidence does not establish Tenant and Organization as equivalent, either concept as a property of the other, or Organization as optional tenant metadata. The frozen Data Domain Model open decision remains authoritative.

## Consequences

- `Team != Tenant`.
- No generic `tenantId` is added or recommended.
- No Organization hierarchy or ownership edge is created.
- Caller-authored tenant binding remains `NOT_AUTHORITATIVE`.
- A known team, purpose, parent or provenance relationship may constrain scope but cannot prove tenant ownership.
- Each of the seven stores remains `UNRESOLVED_BINDING` and `NOT_IMPLEMENTATION_READY`.

Related: [Phase 1G-A Binding Matrix](REL001_PHASE1GA_TENANT_SCOPE_BINDING_MATRIX.md), [Phase 1G-B Binding Matrix](REL001_PHASE1GB_STORE_TENANT_BINDING_MATRIX.md).

## Phase 1G-C disposition

이 문서의 unresolved 판정은 Phase 1G-B 당시 evidence를 보존한다. 후속 [DEC-139 / DOC-DEV-079](REL001_PHASE1GC_TENANT_ORGANIZATION_CANONICAL_DECISION.md)가 `OPTION B — SEPARATE TENANT ENTITY`와 seven-store binding을 승인하여 current blocker를 해소했다.
