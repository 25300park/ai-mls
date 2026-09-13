# REL-001 Phase 1F Core API Version / Route Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-065 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / API Owner |
| 적용 범위 | REL-001 / Staging API-001~010 |

## Decision

REL-001/Staging의 기존 Core API transport major는 `v1`이다. Book 6가 이미 정의한 `/v{major}` path에서 `{major}`만 `1`로 치환한다. 이 결정은 API ID, route name, operation, request/response meaning 또는 compatibility generation을 추가하지 않는다.

| Rule | Disposition |
|---|---|
| Existing API identity | `API-001~010`, unchanged |
| Version segment | `/v1` where canonical route contains `/v{major}` |
| Exact Book 6 route | Book 6 method/path wins; no alias or convenience route |
| Unsupported operation | no route, no placeholder, no stub success |
| Compatibility promise | current REL-001 contract only; no implied `v2` or future support |

## Closure

API major blocker는 `RESOLVED`. Numeric bounds, persistence, mapping and prerequisite gates remain independent.

Related: [Phase 1A Core Contract Matrix](REL001_PHASE1A_CORE_API_CLOSED_CONTRACT_MATRIX.md), [Phase 1F Eligibility](REL001_PHASE1F_TRANSPORT_ELIGIBILITY_MATRIX.md).
