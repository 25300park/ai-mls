# REL-001 Phase 1A Staging Session Ingress Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-053 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security Owner / Architecture Owner |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Related decision | `DEC-124` (`UNDER_REVIEW`) |

## 1. Bounded decision

이미 발급된 Session을 소비하는 Core request는 existing API-014/015 pattern과 동일하게 HTTP header `x-session-id`만 locator로 사용한다. Header는 authority가 아니며 injected read-only Session resolver가 current `SessionContext`를 반환한 뒤에만 actor가 성립한다.

```text
Staging ingress
  -> x-session-id locator
  -> read-only current Session resolver
  -> ACTIVE/fresh/assurance-consistent Session
  -> live AuthorizationService
  -> owning Application operation
```

## 2. Trust and request rules

| Concern | Rule |
|---|---|
| Authentication termination | Session을 생성한 approved authentication adapter boundary. 현재 exact provider/protocol은 정의되지 않았으므로 Staging bootstrap에 연결할 수 없음 |
| Session locator | `x-session-id` exactly one non-empty bounded value; cookie, bearer token, query/body session ID는 미지원 |
| Actor | resolved `SessionContext.principalId` only |
| Tenant/team | resolved Session과 current assignment/resource가 결정; caller tenant/team은 filter/request constraint일 뿐 authority가 아님 |
| Scope/purpose | current Session/assignment/resource와 requested purpose를 `AuthorizationService`가 매 request 평가 |
| Freshness | resolver가 state, expiry, absolute expiry, revocation family 및 assurance consistency를 현재 시각에 검증 |
| MFA | `assurance === MFA && isMfaVerified === true`; contradictory assurance fail closed |
| SoD | owning application/domain의 existing live transaction SoD를 재사용; Host가 duplicate rule을 만들지 않음 |
| Body authority fields | `actorId`, roles, capabilities, approval, MFA/session claims는 unknown field로 reject |

## 3. Failure behavior

| Condition | Safe outcome |
|---|---|
| missing/blank/multiple locator | `AUTHENTICATION_REQUIRED`, HTTP 401 |
| missing resolver or resolver unavailable | `AUTHENTICATION_REQUIRED` or safe `DEPENDENCY_UNAVAILABLE`; no operation/mutation |
| expired/revoked/inactive Session | `AUTHENTICATION_REQUIRED`; internal reason may be audited, public detail minimized |
| contradictory MFA assurance | `AUTHENTICATION_REQUIRED` |
| stale/revoked role assignment | live authorization deny; no cached allow |
| tenant/scope visibility failure | concealed `NOT_FOUND` where resource existence is sensitive |
| body actor/role/capability elevation | schema rejection before application execution |

Authentication failure precedes repository write, idempotency creation, domain mutation and success audit.

## 4. API-001 creation and refresh blocker

Frozen Authentication API states that exact authentication protocol/provider and token format are `OPEN DECISION`. Current `AuthenticationEvidence` contains only `credentialReference` and `requestedScope`, and current response includes `refreshReference`; neither is an approved Staging wire credential contract.

Therefore:

- `Create Session` = `NOT_TRANSPORT_READY`.
- `Refresh Session` = `NOT_TRANSPORT_READY`.
- no development Session adapter, fabricated user, cookie, JWT, OAuth, bearer token or new identity provider is introduced.
- pre-seeding Sessions in memory is not a Staging production-style solution.

## 5. Status and required amendment

`Existing Session consumption = CONTRACT_DEFINED`; `Staging Session lifecycle ingress = BLOCKED_OPEN_DECISION`.

AO/Security Owner must separately approve the exact Staging authentication adapter, credential-reference transport/protection, Session/refresh delivery and durable Session store. Until then the Core Host must not advertise readiness or bind protected Core routes.

## 6. Phase 1B repository resolution

| Required item | Existing mechanism | Result |
|---|---|---|
| trusted Session source | `SessionService.createSession()` consumes injected `AuthenticationAdapter`; non-test Production adapter not present | unresolved |
| ingress resolver | application façades accept injected `sessionReader`; API-014/015 use injected resolver contracts | resolved contract, no Staging implementation |
| transport carrier | API-014/015 HTTP adapters and Console client already use `x-session-id` | resolved |
| freshness/revocation | `SessionService.readSession()` checks current state/expiry/revocation and assurance consistency | resolved behavior |
| tenant/scope derivation | resolved Session plus live assignment/resource evaluation | resolved behavior |
| unauthenticated failure | missing header/resolver/current Session fails closed before operation | resolved behavior |

No repository Production composition creates a trusted Core Session resolver or durable Session store. Existing development/test adapters cannot be promoted to Staging. Consequently:

```text
Authentication model: EXISTING_MODEL_REUSED
Session ingress: BLOCKED_SESSION_PERSISTENCE_BOUNDARY
```

The narrower AO amendment confirmed the carrier and resolver rules but did not identify an existing durable/trusted Session persistence implementation. Repository inspection found only `SessionService` process-local maps and injected resolver interfaces; no non-test Production Staging resolver/store can materialize `x-session-id` after restart.

Per the approved amendment stop rule:

```text
Session ingress: BLOCKED_SESSION_PERSISTENCE_BOUNDARY
Final stop: BLOCK_REL001_PHASE1_STAGING_SESSION_PERSISTENCE_BOUNDARY
```

A further AO amendment is required before designing or implementing a Session persistence adapter. It must preserve the existing Session model and may not create a new authentication provider or token protocol.
