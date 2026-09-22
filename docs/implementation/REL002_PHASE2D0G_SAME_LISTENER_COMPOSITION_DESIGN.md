# REL-002 Phase 2D-0G Same-Listener Composition Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-339 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준 Main | `aff2b1a1377faba75b30e78faede913a130266ba` |
| Decision | DEC-188 (`PROPOSED`) |

## 1. 목적

API-014 Publication, API-015 Administration 및 operational `/readyz`를 Railway의 단일 Production listener에 합성하는 최소 canonical contract를 정의한다. 이 설계는 listener만 공유하며 각 API의 business authority, Session 해석, AuthorizationService, MFA/SoD 및 audit semantics는 합치지 않는다.

## 2. Actual HTTP root inventory

| 항목 | API-014 Publication | API-015 Administration |
|---|---|---|
| Composition factory | `composeProductionPublicationApi014NodeHttpServer()` | `composeProductionAdministrationApi015NodeHttpServer()` |
| HTTP adapter | `createPublicationApi014HttpRequestHandler()` | `createAdministrationHttpRequestHandler()` |
| Route pattern | `POST /api/publication/commands`, `POST /api/publication/queries` | `POST /administration/commands`, `GET /administration/queries` |
| Listener ownership | factory가 독립 `PublicationNodeHttpServer`를 생성하고 caller가 `start()` | factory가 독립 `PublicationNodeHttpServer`를 생성하고 caller가 `start()` |
| Auth ownership | Publication canonical host가 Session/live authorization을 소유 | Administration application과 administration-backed live authorization이 소유 |
| Startup | host는 deferred activation 가능; server listen은 별도 | application/UoW 구성 후 server listen은 별도 |
| Shutdown | server → host → Publication UoW | server → Administration UoW |
| Production proof | `ProductionBootstrapContext` 필수 | `ProductionBootstrapContext` 필수 |
| 독립 server 생성 | YES | YES |

`PublicationNodeHttpServer`는 공용 request parsing, bounded body, response writer, lifecycle 및 graceful close를 제공한다. 두 adapter 모두 fallback chaining을 지원한다. 그러나 하나의 Production host가 두 handler를 받아 단일 server를 소유하는 canonical composition은 아직 없다. 따라서 existing shared infrastructure는 `PARTIAL`이다.

## 3. Canonical target

```text
ProductionBootstrap
  -> construct API-014 root (handler + lifecycle, no listener)
  -> construct API-015 root (handler + lifecycle, no listener)
  -> compose ProductionHttpHost
       /readyz
       /api/publication/* -> API-014 handler
       /administration/*  -> API-015 handler
       otherwise          -> safe 404
  -> bind exactly one PORT listener
  -> start workers
  -> READY
```

`ProductionHttpHost`가 HTTP server 생성, PORT bind, route registration, listener start/close를 단독 소유한다. Child root는 handler와 자체 application/persistence lifecycle만 제공한다. `ProductionBootstrapContext`는 construction proof일 뿐 API 권한이 아니다.

## 4. Minimum implementation boundary

1. API-014/015 Production composition을 `handler + activate/close` 형태의 prepared root로 분리한다.
2. 기존 lower-environment Node server factories는 test/Staging 호환을 위해 유지한다.
3. exact route multiplexer를 하나 추가하고 `PublicationNodeHttpServer`의 bounded request parsing/response/lifecycle 동작을 재사용한다. Current server-owning class를 별도 listener로 시작하지 않는다.
4. Railway bind host `0.0.0.0`과 exact parsed `PORT`는 Production-only configuration으로 전달한다.
5. root registry에서 API-014/015 `listener`를 제거하고 single `startListeners()`가 composed host 하나만 시작한다.
6. readiness는 listener bind와 required root activation 완료 전까지 `NOT_READY`다.

새 API ID, business route, authorization path, persistence, dependency 또는 listener를 추가하지 않는다.

## 5. Phase 2D-0F salvage

| Artifact | Disposition | 이유 |
|---|---|---|
| `production-main.ts` | REUSE | canonical executable와 signal lifecycle 유지 |
| `production-readiness-http.ts` | MODIFY | 독립 listener가 아니라 shared host의 exact `/readyz` handler/state로 분리 |
| `production-runtime-configuration.ts` | REUSE | exact PORT/pool/TLS contract 유지 |
| PostgreSQL role SQL | REUSE | transport composition과 독립 |
| bootstrap listener lifecycle ordering | MODIFY | verified bind-before-worker behavior는 보존하고, 현재 nonconforming workers-first shutdown은 listener-first로 변경 |
| API-014/015 child `listener` exposure | REMOVE | child listener ownership이 duplicate listener blocker |

## 6. 범위 제한

- Production connection/write, migration/role execution, Railway deploy, secret use는 모두 `0`이다.
- `SECRET_BACKEND_EXECUTION = BLOCKED`를 유지한다.
- API-018/API-019/FEAT-022 transport를 이번 same-listener에 추가하지 않는다.
- `/livez`는 DEC-184에 예약된 후속 operational route이며 이번 구현 범위에서 새로 주장하지 않는다.

## 7. 관련 문서

- [Route Ownership](REL002_PHASE2D0G_API014_API015_ROUTE_OWNERSHIP.md)
- [HTTP Listener Lifecycle](REL002_PHASE2D0G_HTTP_LISTENER_LIFECYCLE.md)
- [Authorization Boundary](REL002_PHASE2D0G_AUTHORIZATION_BOUNDARY.md)
- [Phase 2D-0F Resume Plan](REL002_PHASE2D0G_PHASE2D0F_RESUME_PLAN.md)
- [Decision Proposal](REL002_PHASE2D0G_DECISION_PROPOSAL.md)
