# REL-002 Phase 2D-0G API-014 / API-015 Route Ownership

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-340 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준 Main | `aff2b1a1377faba75b30e78faede913a130266ba` |

## 1. Exact ownership

| 우선순위 | Method | Path | Owner | 비고 |
|---:|---|---|---|---|
| 1 | `GET`, `HEAD` | `/readyz` | Production operational host | business API가 아니며 fixed safe body만 반환 |
| 1 | other | `/readyz` | Production operational host | `405`; application fallback 금지 |
| 2 | `POST` | `/api/publication/commands` | API-014 | existing canonical command validation/authority 유지 |
| 2 | `POST` | `/api/publication/queries` | API-014 | existing canonical query validation/authority 유지 |
| 3 | `POST` | `/administration/commands` | API-015 | existing RBAC/MFA/SoD 유지 |
| 3 | `GET` | `/administration/queries` | API-015 | existing live authorization 유지 |
| 4 | any | all other paths | Production host | bounded safe `404` |

Query string은 path ownership을 바꾸지 않는다. `/readyz?…`는 exact operational route가 아니며 safe `404`로 처리한다. Route family가 일치하고 method만 틀리면 해당 owner가 `405`를 반환한다.

## 2. Collision analysis

- API-014 namespace: `/api/publication/*`
- API-015 namespace: `/administration/*`
- Operational namespace: exact `/readyz`
- Existing health endpoints found in implementation: `/readyz` only
- DEC-184의 `/livez`: approved design vocabulary이나 현재 구현/route ownership 없음

Exact method/path tuple과 namespace가 겹치지 않으므로 `Route collision = NO`다. Prefix-only dispatch가 다른 owner의 route를 삼키지 않도록 exact route table 또는 closed predicate를 사용한다. 등록 시 duplicate method/path를 검출하면 listener bind 전에 fail closed한다.

## 3. Fallback contract

1. `/readyz`는 application handler보다 먼저 exact match한다.
2. API-014와 API-015는 자기 namespace 밖 요청을 처리하거나 권한 검사하지 않는다.
3. 최종 fallback만 safe `404`를 생성한다.
4. malformed request, oversized body, unsafe diagnostics는 existing bounded transport mapper를 통과한다.
5. 어떤 handler도 다른 API의 business error vocabulary를 재해석하지 않는다.

## 4. 금지 사항

- route alias, redirect, version prefix 변경, new public endpoint
- silent override 또는 last-registration-wins
- `/readyz`에서 database, tenant, Session, stack/path/SQL detail 노출
- API-014/015 handler가 listener 또는 PORT를 직접 소유하는 Production 경로

## 5. 관련 문서

- [Same-Listener Design](REL002_PHASE2D0G_SAME_LISTENER_COMPOSITION_DESIGN.md)
- [Authorization Boundary](REL002_PHASE2D0G_AUTHORIZATION_BOUNDARY.md)
