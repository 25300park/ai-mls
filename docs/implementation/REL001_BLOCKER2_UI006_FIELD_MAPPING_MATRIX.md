# REL-001 Blocker 2 UI-006 Field Mapping Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-260 |
| 문서 버전 | v1.0 |
| 상태 | APPROVED |
| 소유 역할 | UI Owner / API Owner / Security Owner |
| 기준일 | 2026-09-16 |

## 1. 표시 allowlist

| Presentation field | Source API / canonical field | 목적 | 민감도 | UI-006 위치 | Authorization dependency | 실패 처리 |
|---|---|---|---|---|---|---|
| `principalId` | API-001 `/v1/me` `principalId` | 현재 live principal 식별 | INTERNAL | Current Principal | Session ingress `resource.view` | Core section `NOT_AVAILABLE` |
| `tenantId` | server-trusted Console tenant + API-001 scope binding | 현재 tenant 경계 표시 | INTERNAL | Current Principal | Session tenant binding | mismatch 시 `NOT_READY` |
| `roles` | API-001 `/v1/me` live `roles` | 현재 live role 식별자 표시 | RESTRICTED_SECURITY | Current Principal | live assignment resolution | malformed/overflow 시 `NOT_READY` |
| `scopes` | API-001 `/v1/me` live `scopes` | 현재 tenant/team scope 식별자 표시 | RESTRICTED_SECURITY | Current Principal | live assignment resolution + configured scope match | mismatch 시 `NOT_READY` |

표시 field는 정확히 4개다. Transport가 반환하는 `principalType`과 `expiresAt`은 검증 입력일 뿐 presentation DTO에 포함하지 않는다.

## 2. Default deny

다음 값은 DTO와 renderer에서 거부한다: `sessionId`, `principalType`, `expiresAt`, raw assignment, assignment ID, policy/obligation internals, credentials/tokens, arbitrary metadata, unknown nested field, raw backend diagnostic.

## 3. API-002 결정

UI-006 browser 요청은 기존 Staging Session ingress에서 `resource.view`를 live revalidation한다. UI-006이 추가 capability semantics를 요구한다는 RED 증거가 없으므로 `POST /v1/authorization-decisions` 호출은 `0`이다. 권한을 role text 또는 browser condition으로 추론하지 않는다.

## 4. Bound와 binding

- roles: maximum `64`, silent truncation `0`
- scopes: maximum `128`, silent truncation `0`
- identifier: existing API-001 bounded identifier 규칙 재사용
- 모든 scope `tenantId`는 configured tenant와 일치
- 최소 한 scope `teamId`는 configured `scopeRef`와 일치
