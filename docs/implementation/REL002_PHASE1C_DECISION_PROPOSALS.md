# REL-002 Phase 1C Decision Proposals and Ratification

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-286 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-18 |
| Baseline | `42d65b9533eecb4cc579859c17bb91ba4f44e70e` |

## 1. DEC-165 ratified decision

| Field | Proposed value |
|---|---|
| Decision ID | DEC-165 |
| Title | Canonical Production SERVICE/WORKLOAD Identity Authority |
| Status | `APPROVED` |
| Recommendation | `IDENTITY_OWNED_REGISTERED_SERVICE_WORKLOAD_AUTHORITY` |
| Owner | Architecture Owner / Security-Identity Owner |
| Scope | Production SERVICE/WORKLOAD registration, identity proof, tenant binding, assurance and lifecycle |
| Excluded authority | RBAC, scope/capability assignment, approval, business lifecycle, credential storage |
| Dependency | DEC-164; existing principal/session/authorization vocabulary |

### Proposed decision

Identity domain이 `RegisteredServiceWorkload` authority를 소유한다. Existing live `AuthorizationService`와 administration-backed `RoleAssignment`가 role/capability/scope를 계속 소유한다. Credential secret value는 저장하지 않는다. `RoleAssignment`와 `DurableSessionUnitOfWork`는 identity registry로 확장하지 않는다.

### Consequences

- Logical persistent registration entity: required.
- Repository-local table/schema: `DEFERRED`; not selected or authorized by this decision.
- New public API, role/capability, auth protocol or parallel RBAC: none.
- Missing/unavailable/mismatched registration: fail closed.

## 2. DEC-166 ratified decision

| Field | Proposed value |
|---|---|
| Decision ID | DEC-166 |
| Title | Canonical Production Composition Root / Bootstrap Ownership |
| Status | `APPROVED` |
| Recommendation | `SHARED_BOOTSTRAP_MULTI_ROOT` |
| Owner | Architecture/Operations Owner |
| Scope | Production startup ordering, child-root construction and shutdown ownership |
| Dependencies | DEC-164; DEC-165; existing bounded Production factories |

### Proposed decision

`ProductionBootstrap`은 다음 순서를 소유한다.

```text
ProductionRuntimeConfiguration
→ service and human identity authority availability
→ secret-reference validation/resolution
→ ProductionStartupValidationGate
→ DurableSessionUnitOfWork creation
→ API-014/API-015/API-018/API-019/FEAT-022 child roots
→ listeners/workers
→ separately authorized provider-capable execution paths
```

Bootstrap은 PASS 전 child root, Session UoW, DB mutation, listener, worker 및 provider-capable runtime을 시작하지 않는다. Shutdown과 partial-start unwind도 bootstrap이 소유한다. Existing Staging roots는 승격·rename·fallback하지 않는다.

### Consequences

- Composition choice: shared bootstrap governing bounded roots.
- Production Session UoW owner: `ProductionBootstrap`.
- New composition framework per child: none.
- Production provider/network authority: none.

## 3. Gap impact

| Gap | Current state | Proposal impact | Close status |
|---|---|---|---|
| REL002-GAP-004 | `PARTIAL`, blocking | DEC-166 defines central startup ownership | remains `BLOCKING` |
| REL002-GAP-005 | `PARTIAL`, blocking | DEC-166 orders secret-reference validation/resolution | remains `BLOCKING` |
| REL002-GAP-006 | `STAGING_ONLY`, blocking | DEC-165 defines Production service/workload authority; DEC-166 defines Production composition | remains `BLOCKING` |

Ratification alone does not close a gap. Implementation, tests and Production-bound evidence are required.

## 4. Ratification result

The Architecture Owner reviewed the complete Phase 1C documentation set and independent review evidence and ratified DEC-165 and DEC-166 as `APPROVED` on 2026-09-18. This ratification authorizes neither Production/Test implementation nor physical table/schema, migration, credential use, provider/network call or infrastructure mutation.
