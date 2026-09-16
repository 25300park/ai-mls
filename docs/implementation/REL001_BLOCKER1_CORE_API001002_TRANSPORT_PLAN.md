# REL-001 Blocker 1 — Core API-001 / API-002 Transport Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-252 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | API Owner / Security Owner / Quality Owner |
| 기준 commit | `f5d322f2793ffbeaaac765126c7937835c9b501f` |

## 1. Bounded design

```text
Node HTTP server (16 KiB raw cap)
-> exact route adapter
-> CoreIdentityAuthorizationApplication
-> SessionAccessCoordinator.resolveAuthorizedWithDecision
-> durable Session + trusted binding + live AuthorizationService
-> bounded immutable DTO
```

API-001 current-principal projection은 authorized Session identity와 동일 live assignment source를 사용한다. Session의 compatibility role snapshot, caller role/scope/tenant 또는 HTTP-layer persistence lookup은 authority가 아니다.

## 2. TDD sequence

1. RED: missing module/routes and missing `resolveAuthorizedWithDecision` boundary.
2. GREEN: two-route adapter, bounded application, safe DTO/error mapping.
3. RED/GREEN: role/scope/decision collection overflow, header/string/identifier/body/key/depth limits.
4. GREEN: existing Node HTTP host composition with exact raw body cap.
5. Regression: Phase 1D Session/auth, affected API/Console/Phase 5/6, then full suite once.

## 3. Error mapping

| Condition | HTTP result |
|---|---|
| missing/malformed Session locator | `401` safe authentication error |
| malformed schema/bounds/method | `400` or `405` safe validation error |
| tenant/scope/authority concealment | `404` |
| authoritative dependency/readiness or output bound failure | `503` |
| unexpected exception | `500 INTERNAL_ERROR` without diagnostic detail |
| unrelated route | `404` |

## 4. Exclusions

API-003~010, UI-006 live-data wiring, Session issuance/token changes, new persistence/Audit vocabulary, pagination, external network and dependencies remain excluded.

Related: [Gap Matrix](REL001_BLOCKER1_CORE_API001002_TRANSPORT_GAP_MATRIX.md), [Traceability](REL001_BLOCKER1_CORE_API001002_TRACEABILITY.md).
