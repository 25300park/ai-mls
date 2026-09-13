# REL-001 Phase 1C Staging Session Persistence / Resolution Gap Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-057 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Security Owner / Architecture Owner |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Related decisions | `DEC-124`, `DEC-128`, `DEC-129`, `DEC-130` |

## 1. Objective

`x-session-id`를 기존 canonical Session으로 해석하는 production-style Staging boundary의 현재 증거와 결손을 분리한다. 이 문서는 구현 승인이 아니며 새 authentication protocol, provider, role, capability 또는 persistence subsystem을 만들지 않는다.

## 2. Gap Matrix

| Dimension | Canonical source | Current implementation | Missing durable behavior | Exact owner | Reuse | AO amendment |
|---|---|---|---|---|---|---|
| Session contract/type | DOC-SEC-010; `SessionContext`; Phase 1C Amendments | principal, roles/team, state, assurance, MFA, authentication/expiry, family, refresh reference | implementation absent; durable `sessionVersion`, tenant binding origin, revocation and freshness metadata approved | Identity / Authorization boundary | contract reusable | NO |
| Session creation | DOC-API-003 Create Session; DOC-SEC-003 | `IdentityApi.createSession()` → `SessionService.createSession()` → injected `AuthenticationAdapter` | production adapter, atomic durable write and Staging transport absent | Security Owner | logical path and approved durable boundary | NO for repository design |
| Session lookup | DEC-124; DOC-DEV-053; Phase 1C Amendment | injected `sessionReader`/resolver and process-local `Map` lookup | implementation absent; restart-safe zero-or-one contract approved | Identity / Authorization boundary | resolver contract reusable | NO |
| Freshness | DOC-SEC-010; Session Freshness Bounds Amendment | access and absolute timestamps checked on read | implementation absent; idle `30m`, absolute `12h`, MFA `15m` and boundary behavior approved | Security Owner | validation shape reusable | NO |
| Expiry | DOC-API-003; DOC-SEC-010; Session Freshness Bounds Amendment | `expiresAt` and `absoluteExpiresAt`; read marks expired in memory | durable implementation absent; exact Staging bound approved | Security Owner | semantics reusable | NO |
| Revocation | DOC-API-003; DOC-SEC-010; Phase 1C Amendment | individual revoke and refresh-replay family revoke | implementation absent; durable append-preserving metadata/version transaction approved | Identity / Authorization boundary | semantics reusable | NO |
| Actor binding | DOC-SEC-003; DEC-124; Phase 1C Amendment | `principalId`/`principalType` from verified adapter | implementation absent; immutable actor binding approved | Identity / Authorization boundary | fields reusable | NO |
| Tenant binding | DOC-SEC-004; Phase 1C Amendment | Session has no authoritative caller tenant | actor → live assignment lookup derives tenant; optional binding reference checks consistency | Security Owner + Administration Owner | live assignments reusable | NO |
| Scope binding | DOC-SEC-004; DOC-SEC-010; Phase 1C Amendment | Session has optional `teamId`; live assignments evaluate scope | unsupported dimensions fail closed; no flattened scope | Security Owner + Administration Owner | live assignments reusable | NO |
| MFA binding | DOC-SEC-003/010; Phase 1C Amendment | `assurance` + `isMfaVerified`; consistency helpers | durable safe linkage implementation absent; no secret persisted | Security Owner | semantics reusable | NO |
| Live authorization | DOC-SEC-004; API-002 | `AuthorizationService` supports live assignment resolver and per-request evaluation | durable Session resolver must feed it without cached grants | Security Owner / Administration Owner | YES | NO for sequence |
| In-memory fixtures | current tests/dev Console adapter | maps and deterministic development Session | not authoritative after restart; forbidden in Staging | Test/Development only | NO in Staging | NO |
| Admin Console consumption | Phase 0 topology; current `ConsoleReadAdapter` | injected Session resolver and live authorization | shared production durable resolver absent | Console consumer / Security owner provider | consumer reusable | YES |
| Core API consumption | current API façades/composition | `sessionReader` delegates to `SessionService.readSession()` | production durable resolver/composition absent | Platform Host consumer / Security owner provider | consumer reusable | YES |
| Persistence pattern | Phase 1C Amendment; durable repository adapters | repository contains fail-closed `node:sqlite` patterns | one bounded Identity-owned repository/UoW implementation absent | Identity / Authorization boundary | technology/pattern reusable; database ownership isolated | NO |
| Concealment | DOC-SEC-004/010; API Error Standard | authorization and adapters use safe deny/concealment | Session persistence failures need normalized mapping | Security Owner | YES | NO for policy |
| Safe errors | DOC-API-015 | canonical auth errors exist | no durable lookup error mapper | API/Security Owner | vocabulary reusable | YES for mapping contract |
| Restart durability | Phase 0 lifecycle; Phase 1C Amendment | none for Session | contract now defined; implementation/tests absent | Identity / Authorization boundary | durable pattern reusable | NO |

## 3. Findings

- `x-session-id` is reusable only as an opaque locator.
- API-001 and Security Owner establish logical creation/revocation ownership.
- One bounded Identity/Authorization-owned Session repository/UoW is now approved; implementation remains absent.
- Actor → live assignment lookup is the authoritative tenant/scope source; stored binding references are consistency checks only.
- Version, append-preserving revocation, bounded audit reference and restart behavior are resolved.
- REL-001/Staging bounds are now canonical: idle `30m`, absolute `12h`, MFA freshness `15m` for already-privileged actions.
- Durable `lastAccessedAt` and `lastMfaVerifiedAt` linkage are approved; no process-local timer is authoritative.

## 4. Gate

```text
Existing canonical Session creation path: RESOLVED_LOGICALLY_NOT_EXECUTABLE
Durable Session persistence design authority: RESOLVED
Exact expiry/freshness: RESOLVED
Trusted tenant/scope binding: RESOLVED
Production-style Staging Session ingress: RESOLVED
Production implementation authorization: YES_FOR_SESSION_BOUNDARY_ONLY
```

## 5. Related documents

- [Canonical Session Record Contract](REL001_PHASE1C_CANONICAL_SESSION_RECORD_CONTRACT.md)
- [Creation / Revocation Ownership](REL001_PHASE1C_SESSION_CREATION_REVOCATION_OWNERSHIP.md)
- [Session Resolution Flow](REL001_PHASE1C_SESSION_RESOLUTION_FLOW.md)
- [Security / Readiness Matrix](REL001_PHASE1C_SESSION_SECURITY_READINESS_MATRIX.md)
- [Completion Report](../reviews/REL001_PHASE1C_COMPLETION_REPORT.md)
