# REL-001 Blocker 1 — Core API-001 / API-002 Traceability

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-253 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | API Owner / Security Owner / Quality Owner |
| 기준 commit | `f5d322f2793ffbeaaac765126c7937835c9b501f` |

| Requirement | Implementation | Test evidence | Status |
|---|---|---|---|
| API-001 exact route | `core-identity-authorization-http.ts` `GET /v1/me` | focused handler + real Node HTTP E2E | VERIFIED |
| API-002 exact route | same adapter `POST /v1/authorization-decisions` | focused request/response test | VERIFIED |
| Phase 1D ingress | `SessionAccessCoordinator.resolveAuthorizedWithDecision()` | coordinator and architecture assertions | VERIFIED |
| live Current Principal | live assignments → unique roles and tenant/team scopes | stale Session role negative test | VERIFIED |
| exact bounds | constants and recursive request metrics | boundary/overflow tests; silent truncation 0 | VERIFIED |
| safe immutable DTO | explicit Current Principal and decision reconstruction | protected Session field exclusion and immutable arrays | VERIFIED |
| tenant/scope | trusted tenant injection plus live authorization | cross-tenant concealment test | VERIFIED |
| readiness/errors | injected readiness and safe error mapper | 503/404/401/400/500 assertions | VERIFIED |
| no repository bypass | transport depends only on application ports | source architecture assertion | VERIFIED |
| no unrelated Core route | exact route resolver only | `/v1/sources` 404 | VERIFIED |
| raw body bound | Node server configuration requires exactly 16 KiB | composition assertion | VERIFIED |
| exact candidate integrity | Production byte change invalidates prior Phase 7 hard-coded manifest identity | full regression `1490/1491`; exact-candidate test correctly rejected stale fingerprint | EXPECTED_PRE_REBUILD |

## Scope result

- New API IDs: `0`
- API-003~010 routes: `0`
- New persistence/Audit vocabulary: `0/0`
- Pagination: `0`
- Dependency/lockfile changes: `0`
- UI-006 activation: `NOT_STARTED` (Blocker 2)

## Blocker 2 downstream activation overlay

API-001 `GET /v1/me`는 [UI-006 Runtime Traceability](REL001_BLOCKER2_UI006_RUNTIME_TRACEABILITY.md)에 따라 전용 `CoreIdentityConsoleReadAdapter`를 통해 UI-006의 4-field presentation DTO로 연결됐다. API-002 transport는 유지되지만 UI-006 ingress가 기존 `SessionAccessCoordinator`의 `resource.view`를 authoritative gate로 사용하므로 추가 호출은 `0`이다. API-003~010 exposure와 direct persistence access는 `0`이다.

## Completion disposition

Focused and affected execution evidence is GREEN. The bounded transport closeout is approved with the exact-candidate failure explicitly accepted as the pre-rebuild result. The historical Phase 7 identity remains immutable; a later candidate rebuild/re-evaluation must use this implementation commit rather than rewrite prior evidence.

Related: [Gap Matrix](REL001_BLOCKER1_CORE_API001002_TRANSPORT_GAP_MATRIX.md), [Completion Report](../reviews/REL001_BLOCKER1_COMPLETION_REPORT.md).
