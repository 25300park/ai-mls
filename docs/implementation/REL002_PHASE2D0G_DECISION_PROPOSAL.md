# REL-002 Phase 2D-0G Decision Proposal

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-344 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준 Main | `aff2b1a1377faba75b30e78faede913a130266ba` |

## DEC-188 — Canonical Production Same-Listener HTTP Composition Contract

| 필드 | 값 |
|---|---|
| 상태 | `APPROVED` |
| Proposed disposition | `ONE_RAILWAY_SERVICE_ONE_LISTENER_SEPARATE_API_AUTHORITIES` |
| Dependencies | DEC-166, DEC-168, DEC-170, DEC-177, DEC-183, DEC-184 |

### Decision proposal

1. Railway `ai-mls-api` Production runtime은 정확히 하나의 Node HTTP listener와 하나의 PORT bind를 소유한다.
2. 같은 listener에 API-014 Publication, API-015 Administration 및 operational `/readyz`를 closed route table로 mount한다.
3. API-014/API-015 child roots는 Production port를 독립 bind하지 않고 handler와 application/persistence lifecycle만 제공한다.
4. Listener 공유는 business authority 공유를 의미하지 않는다. 각 API의 existing Session, AuthorizationService, roles/scopes/capabilities, MFA/SoD 및 audit semantics를 유지한다.
5. `ProductionBootstrap` gate와 required root construction 전 listener bind는 금지한다. Ratified Phase 2D-0H 순서는 route composition과 listener bind 후 child runtime/worker activation이며, business route는 external readiness가 `READY`가 될 때까지 503으로 fail closed한다.
6. Shutdown은 `NOT_READY -> listener -> workers/roots -> Session/identity/pool` 역순이며 기존 30초 bound를 유지한다.
7. duplicate method/path 또는 duplicate listener는 startup 전에 fail closed한다.

### Consequences

- 2D-0F executable, readiness state, configuration parser, executable signal/30초 terminal shutdown envelope 및 role artifacts를 재사용한다. Bootstrap listener lifecycle ordering은 listener-first target에 맞게 수정한다.
- API-014/API-015 Production composition은 server-owning root에서 handler-owning prepared root로 최소 분리해야 한다.
- 새 API ID, business semantics, auth authority, persistence 또는 dependency는 없다.

### Ratification

Architecture Owner가 Phase 2D-0H 시작 승인에서 `DEC-188 = APPROVED`로 ratify했다. Repository-side 구현과 검증은 [Phase 2D-0H Completion Report](../reviews/REL002_PHASE2D0H_COMPLETION_REPORT.md)에 기록한다.

## 관련 문서

- [Same-Listener Design](REL002_PHASE2D0G_SAME_LISTENER_COMPOSITION_DESIGN.md)
- [Authorization Boundary](REL002_PHASE2D0G_AUTHORIZATION_BOUNDARY.md)
