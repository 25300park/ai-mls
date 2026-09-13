# REL-001 Phase 1C Session Resolution Flow

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-060 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Security Owner / API Owner |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Related decisions | `DEC-124`, `DEC-128`, `DEC-129`, `DEC-130` |

## 1. Canonical sequence

```text
x-session-id (opaque locator)
-> validate bounded locator shape
-> Identity-owned durable zero-or-one lookup
-> validate complete canonical Session record
-> reject revoked Session
-> reject absolute elapsed >= 12h
-> reject idle elapsed >= 30m
-> reject inconsistent assurance
-> derive authoritative tenant from actor + current trusted assignments
-> derive multidimensional team/resource/purpose scope from current assignments
-> reject persisted binding-reference disagreement
-> resolve current actor status and live assignments
-> AuthorizationService.evaluate(action, resource, purpose, reason)
-> if privileged, require trusted MFA elapsed <= 15m
-> atomically update lastAccessedAt and sessionVersion N -> N+1
-> owning operation
```

Only the locator is caller supplied. Actor, tenant, scope, role, capability and MFA claims from headers/body/query are ignored and cannot override trusted state.

## 2. Deterministic outcomes

| Condition | Safe result | Mutation |
|---|---|---|
| missing/malformed locator | `AUTHENTICATION_REQUIRED` | 0 |
| no Session | `AUTHENTICATION_REQUIRED` | 0 |
| revoked/expired Session | `AUTHENTICATION_REQUIRED` or existing normalized Session denial | no business mutation |
| inconsistent assurance/MFA | `REAUTHENTICATION_REQUIRED` or authentication denial | 0 |
| tenant/scope mismatch | `FORBIDDEN`/`SCOPE_DENIED` with concealment | 0 |
| live assignment revoked/stale | existing Authorization `DENY` | 0 |
| persistence unavailable/corrupt | safe unavailable/internal error; component `NOT_READY` | 0 |
| valid Session but operation denied | existing safe authorization error | 0 |
| idle elapsed `>= 30m` | authentication denial | 0 |
| absolute elapsed `>= 12h` | authentication denial | 0 |
| privileged MFA elapsed `> 15m` | `REAUTHENTICATION_REQUIRED` | 0 |
| concurrent revocation beats access update | conflict/fail closed | revocation preserved; access update 0 |

No outcome reveals Session existence, database path, SQL/SQLite detail, raw stack, assignment graph or protected resource existence.

## 3. Shared consumer boundary

Admin Console and Core API processes must consume the same canonical resolver contract and same authoritative store, while each request performs fresh lookup and live authorization. They may use separate process-local resolver instances, but not separate Session truth or incompatible schemas.

```text
Admin Console shared boundary: YES (design intent; implementation absent)
Core API shared boundary: YES (design intent; implementation absent)
```

Development Session composition is rejected in Staging. A resolver unavailable at startup makes the protected component `NOT_READY`; a lookup failure during operation fails closed.

## 4. Restart behavior

Required future proof:

1. create a valid Session through the already-owned API-001 application boundary;
2. commit Session/family/audit state;
3. close and reopen the process/store;
4. resolve the same opaque ID to the same trusted identity binding;
5. re-check expiry/revocation and live assignments;
6. deny if authority changed, even though Session identity persists.

The restart, trust-binding and freshness contract is resolved. Persisted `issuedAt`, `lastAccessedAt`, `lastMfaVerifiedAt`, `revokedAt` and `sessionVersion` remain authoritative across restart; process-local timers and stale grant caches never are.
