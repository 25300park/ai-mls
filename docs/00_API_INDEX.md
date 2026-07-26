# AI-MLS API Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-045 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 기준일 | 2026-07-24 |

## API capability index

| API IDs | Classification | Boundary |
|---|---|---|
| API-001~003 | Security/Source | session, authorization decision, source policy |
| API-004~010 | Core Business | intake, property, candidate, contact, client, requirement, matching |
| API-011~014 | Restricted Authority | Verification, Permission, Approval, Publication external effect |
| API-015~016 | Governance | administration, audit/history/export |
| API-017 | Internal Operation | background job lifecycle; no business authority |
| API-018~019 | Integration | bounded connector and integration lifecycle; no business approval |

## Publication API boundary

| API | Owns | Must not own |
|---|---|---|
| API-013 | Proposal and Publication Approval | Publication execution/delivery/reconciliation |
| API-014 | Publication commands, canonical reads, Attempt/Reconciliation interpretation | Target/provider/credential administration |
| API-015 | governed Target/policy administration | Publication command execution |
| API-018 | connector execution and technical Evidence | Approval, Attempt creation, canonical state decision |
| API-019 | provider contract, external mapping and observations | Publication business authority |

## Command/query/internal index

- Command API: explicit business mutation, current authorization, expected version, idempotency, revalidation와 audit가 필요하다.
- Query API: read-only이며 Projection 사용 시 version/staleness를 표시하고 business state를 변경하지 않는다.
- Internal operation: API-017~019의 bounded job/connector/integration processing이며 public business authority가 아니다.
- Projection rebuild/drift governance는 [Canonical Projection Registry](00_PROJECTION_REGISTRY.md), Event identity/schema/order/replay binding은 [Canonical Event Registry](00_EVENT_REGISTRY.md)가 정의한다. Runtime implementation evidence는 별도다.

상세 19개 capability row, API-014 operation family와 contract/version 규칙은 [Canonical API Registry](00_API_REGISTRY.md)를 따른다.

## Cross-references

- [Canonical Projection Registry](00_PROJECTION_REGISTRY.md)
- [Canonical Security Registry](00_SECURITY_REGISTRY.md)
- [Book 6 API Registry](book-6/16_API_REGISTRY.md)
- [Workflow Registry](00_WORKFLOW_REGISTRY.md)
- [Publication Registry](00_PUBLICATION_REGISTRY.md)
- [Decision Trace Matrix](00_DECISION_TRACE_MATRIX.md)
- [Canonical RTM](00_CANONICAL_TRACEABILITY_MATRIX.md)
- [API Validation Report](reviews/PHASE11_5_API_VALIDATION.md)
- [API Coverage Report](reviews/PHASE11_5_API_COVERAGE.md)
