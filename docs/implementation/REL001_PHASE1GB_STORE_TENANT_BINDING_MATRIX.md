# REL-001 Phase 1G-B Store Tenant Binding Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-075 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Security Owner / Domain Owners |

| Store | Candidate authoritative chain inspected | Supported scope constraint | Tenant classification | Persist/derive decision | Cross-tenant protection status |
|---|---|---|---|---|---|
| Source Registry | Source owner, policy and capture-time version | method/purpose/policy version | `UNRESOLVED_BINDING` | neither direct persistence nor derivation authorized | cannot specify fail-closed tenant lookup |
| Intake | Raw Source and intake context | source/version/purpose | `UNRESOLVED_BINDING` | parent reference does not prove tenant | cannot prove cross-tenant isolation |
| Property | hierarchy parent and source lineage | hierarchy/lineage only | `UNRESOLVED_BINDING` | property parent is not tenant authority | cannot prove cross-tenant isolation |
| Listing | Intake, Property and Source references | provenance and subject version | `UNRESOLVED_BINDING` | parent references do not prove tenant | cannot prove cross-tenant isolation |
| Contact | team, purpose and channel use-scope | `teamId`, purpose, use-scope | `UNRESOLVED_BINDING` | team remains an independent scope | team checks do not prove tenant isolation |
| Client / Requirement | team, agent, client and source refs | `teamId`, assigned agent, client/purpose | `UNRESOLVED_BINDING` | team/client chain does not prove tenant | cannot prove cross-tenant isolation |
| Matching | team and exact input versions | `teamId`, Requirement/Candidate/Offer refs | `UNRESOLVED_BINDING` | input binding does not prove tenant | cannot prove cross-tenant isolation |

## Counts

| Classification | Count |
|---|---:|
| `DIRECT_TENANT_BOUND` | 0 |
| `DERIVED_TENANT_BOUND` | 0 |
| `ORGANIZATION_BOUND` | 0 |
| `SYSTEM_BOUND` | 0 |
| `UNRESOLVED_BINDING` | 7 |

## Phase 1G-C disposition

위 표는 Phase 1G-B 당시 판정이다. [DOC-DEV-079](REL001_PHASE1GC_TENANT_ORGANIZATION_CANONICAL_DECISION.md)의 후속 승인으로 current classification은 Source/Contact/Client direct, Intake/Listing/Matching derived, Property system-bound이며 Requirement는 Client에서 derived된다. Ownership resolved `7/7`; unresolved `0`이다.
