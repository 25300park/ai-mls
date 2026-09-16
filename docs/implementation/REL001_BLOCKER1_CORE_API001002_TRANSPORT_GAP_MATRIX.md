# REL-001 Blocker 1 — Core API-001 / API-002 Transport Gap Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-251 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | API Owner / Security Owner |
| 기준 commit | `f5d322f2793ffbeaaac765126c7937835c9b501f` |
| 범위 | REL-001 / Staging, `GET /v1/me`, `POST /v1/authorization-decisions` only |

## 1. Exact acceptance operations

| API | Operation | Method / route | Request | Safe response | Result before Blocker 1B |
|---|---|---|---|---|---|
| API-001 | Read Current Principal | `GET /v1/me` | no query/path/body; bounded Session/correlation/request headers | `principalId`, `principalType`, live unique `roles`, live unique tenant/team `scopes`, `expiresAt` | Application/HTTP `MISSING`; Phase 1D durability reusable |
| API-002 | Evaluate Capability | `POST /v1/authorization-decisions` | strict canonical action/resource/purpose/reason body | canonical effect/reason/policy/obligations/assignment IDs/optional expiry | Application `PARTIAL`; direct `SessionService` path and HTTP `MISSING` |

Create/Refresh/Revoke Session과 API-003~010은 이 acceptance blocker에 포함하지 않는다. Pagination은 두 operation 모두 `NOT_APPLICABLE`이다.

## 2. Boundary inventory

| Boundary | API-001 | API-002 | Blocker 1B disposition |
|---|---|---|---|
| Domain/Application | `MISSING` | `PARTIAL` | bounded application service 추가 |
| Durable Session | `IMPLEMENTED` | `IMPLEMENTED` | Phase 1D UoW 재사용; transport 직접 접근 0 |
| Live authority | `PARTIAL` | `IMPLEMENTED` | `SessionAccessCoordinator`와 same live-assignment boundary 사용 |
| Session ingress | `IMPLEMENTED` internal | `PARTIAL` | `x-session-id` only; direct `SessionService` 제거 |
| In-process composition | `MISSING` | `MISSING` | 기존 Node HTTP server에 exact handler 주입 |
| HTTP route | `MISSING` | `MISSING` | 두 route만 등록 |
| Safe DTO/error | `MISSING` | `PARTIAL` | immutable allowlist와 safe status mapping |
| Readiness | `MISSING` | `MISSING` | injected readiness가 아니면 `NOT_READY`/503 |

## 3. Approved bounds

| Surface | Bound | Enforcement |
|---|---:|---|
| `x-session-id` | 512 characters inclusive | malformed/missing authentication fail-closed |
| `x-correlation-id`, `x-request-id` | 128 characters inclusive | 400; no truncation |
| semantic request string | 128 characters inclusive | 400; no truncation |
| resource identifier | 512 characters inclusive | 400; no truncation |
| JSON body | 16 KiB inclusive | raw Node reader and adapter validation |
| body keys / depth | 32 / 6 inclusive | recursive deterministic validation |
| roles / scopes | 64 / 128 inclusive | authoritative projection overflow → 503 |
| obligations / assignment IDs | 64 / 256 inclusive | authoritative decision overflow → 503 |

## 4. Preserved ownership

- HTTP adapter는 repository/UoW에 접근하지 않는다.
- `SessionAccessCoordinator`가 durability, freshness, revocation, live authorization, MFA와 CAS access refresh를 소유한다.
- current-principal roles/scopes는 persisted Session role snapshot이 아니라 live assignments에서 재구성한다.
- body `tenantId`는 target context일 뿐 grant가 아니며 trusted Staging tenant와 다르면 concealment한다.
- 새 Audit event, persistence subsystem, API ID 또는 pagination contract를 만들지 않는다.

Related: [Implementation Plan](REL001_BLOCKER1_CORE_API001002_TRANSPORT_PLAN.md), [Traceability](REL001_BLOCKER1_CORE_API001002_TRACEABILITY.md).
