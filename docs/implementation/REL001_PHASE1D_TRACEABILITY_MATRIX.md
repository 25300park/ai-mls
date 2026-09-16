# REL-001 Phase 1D Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-063 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Security Owner / Quality Owner |
| 기준 commit | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| 적용 범위 | REL-001 / Staging bounded durable Session implementation only |

## 1. Boundary

이 문서는 `DEC-124`, `DEC-128`, `DEC-129`, `DEC-130`의 Phase 1D 구현 증거만 연결한다. Login/session issuance transport, JWT/OAuth, 새 role/capability, 외부 persistence/service, Production 정책 활성화와 Phase 1 Core Runtime 완료는 범위 밖이다.

## 2. Requirement to implementation evidence

| Requirement | Production implementation | Direct assertion evidence | Verification | Status |
|---|---|---|---|---|
| Identity-owned durable Session record/UoW | `modules/identity/src/session-persistence.ts` — `DurableSessionRecord`, `SessionUnitOfWork`; `session-durable-persistence.ts` — `DurableSessionUnitOfWork` | `session-persistence.test.ts`: canonical version 1, strict record, immutable clone, CAS, immutable actor/binding; `session-durable-persistence.test.ts`: close/reopen survival | focused persistence tests `14/14 PASS` | VERIFIED |
| Atomic rollback and optimistic concurrency | `DurableSessionUnitOfWork.transaction()` and conditional version update | durable tests: whole-transaction rollback; stale access loses to concurrent revocation | durability loop `5/5 PASS` repeated five times | VERIFIED |
| Irreversible append-only revocation evidence | `identity_session_revocations` table plus no-update/no-delete triggers; `appendRevocation()` | in-memory and SQLite tests assert N→N+1, restart persistence and reactivation rejection | identity focused regression PASS | VERIFIED |
| Existing Session lifecycle uses durable authority | `SessionService` reads/writes through injected `SessionUnitOfWork` | Phase 1D lifecycle tests assert issued version 1, durable revoke, reconstruction and refresh-family replay | Phase 1D direct set included in `39/39 PASS` | VERIFIED |
| Exact idle/absolute/MFA freshness | `SessionAccessCoordinator.resolveAuthorized()`, `isFresh()`, `hasFreshMfa()` | 29m59s allow / 30m deny; 12h deny; MFA 15m allow / >15m deny | coordinator focused PASS | VERIFIED |
| Trusted actor/binding and live authorization | `TrustedSessionBindingResolver` then existing `AuthorizationService.evaluate()` | body actor/role/tenant/scope ignored; missing/failing binding denied; live assignment revocation denied; authorization exceptions concealed; shared context and audit use protected/pseudonymous Session references | authorization/identity affected regression `72/72 PASS` | VERIFIED |
| Denial/revocation/concurrency performs no access refresh | coordinator CAS occurs only after live allow and MFA; conflict maps fail closed | denial, revocation, missing binding and concurrent revoke assertions retain prior `lastAccessedAt` | coordinator focused PASS | VERIFIED |
| Staging durable-only fail-closed composition | `apps/api/src/staging-session-composition.ts` | missing path, non-Staging mode, injected in-memory/development resolver rejected; reopen shared truth; corrupt DB safe `NOT_READY`; closed, binding-unready and authorization-unready runtime reports `UNHEALTHY/NOT_READY` | Phase 1D direct set included in `39/39 PASS` | VERIFIED |
| Safe diagnostics | `SessionPersistenceError` safe public message; Staging/API/authorization dependency concealment; hashed Session audit reference and protected refresh projection | path/SQL/token/stack injection assertions; no raw Session/refresh diagnostic or audit exposure | Phase 1D direct `39/39 PASS`; Gitleaks 0 | VERIFIED |
| No false success audit / append-only bypass | Session lifecycle audit records accepted decision evidence before mutation without claiming `COMPLETED`; generic update rejects revocation/evidence creation or rewrite; transaction admits one N→N+1 mutation | persistence failure leaves completed audit evidence 0; in-memory/durable update bypass and double increment rejected | Phase 1D direct `39/39 PASS` | VERIFIED |
| No scope expansion | no new route/API/auth protocol/role/dependency/provider; in-memory adapter remains compatibility-only | composition closed option allowlist and affected architecture regression | full regression `1253/1253 PASS`; architecture immutable `153/153 PASS` | VERIFIED |

## 3. Execution path

```text
trusted session locator/context
-> Staging Session composition
-> DurableSessionUnitOfWork
-> SessionAccessCoordinator
-> TrustedSessionBindingResolver
-> AuthorizationService.evaluate
-> MFA freshness when obligated
-> CAS(lastAccessedAt, sessionVersion N+1)
-> immutable SessionContext
```

Failed authentication, invalid freshness, rejected authority, binding mismatch and stale CAS all terminate before a successful access refresh. The Staging composition does not expose a new HTTP route or login mechanism.

## 4. Verification disposition

`REL-001 Phase 1D = IMPLEMENTED_AND_VERIFIED` within the bounded Session foundation. This does not close REL-001 Phase 1 Core Runtime and does not authorize integration, commit, push or Production reuse.

Related completion evidence: [Phase 1D Completion Report](../reviews/REL001_PHASE1D_BOUNDED_DURABLE_SESSION_IMPLEMENTATION_REPORT.md).

## 5. Later REL-001 Blocker 1 transport reuse

Blocker 1B adds `resolveAuthorizedWithDecision()` as a backward-compatible projection of the same Phase 1D transaction. Existing `resolveAuthorized()` delegates to it and preserves the exact freshness, revocation, MFA, live-authority and CAS behavior. The returned decision is immutable and lets API-002 avoid a second authorization evaluation. No repository/UoW access moves into HTTP.

Evidence: [Blocker 1 Traceability](REL001_BLOCKER1_CORE_API001002_TRACEABILITY.md), `session-access-coordinator.test.ts`.
