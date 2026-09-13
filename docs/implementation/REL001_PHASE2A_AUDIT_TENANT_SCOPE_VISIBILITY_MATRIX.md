# REL-001 Phase 2A Audit Tenant / Scope Visibility Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-111 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security/Governance Owner / Audit Owner / Domain Owners |
| 기준 commit | `e5a2cfc9a17cdb20c0c3db1e79e3184e7a09052f` |

## 1. Visibility rule

Final events preserve source ownership. Tenant is the top-level isolation identity; Organization and Team are not Tenant. Query authorization and tenant/scope concealment are evaluated before event disclosure. Request filters cannot manufacture visibility.

## 2. Matrix

| Source | Tenant binding | Scope binding | Final read visibility | Failure behavior |
|---|---|---|---|---|
| Source Registry | direct trusted `tenantId` | intent `scopeRef` | exact tenant plus authorized scope | conceal |
| Intake | authoritative Source-derived `tenantId` | intent `scopeRef` | exact derived tenant plus authorized scope | conceal |
| Property | no tenant ownership (`SYSTEM_BOUND`) | `system:property-master` | separately authorized system-scope view; never caller-tenant ownership | conceal |
| Listing | Intake/Source-derived `tenantId` | intent `scopeRef` | exact derived tenant plus authorized scope | conceal |
| Contact | direct trusted `tenantId` | intent `scopeRef` | exact tenant plus authorized scope/purpose | conceal |
| Client / Requirement | direct Client or Client-derived Requirement tenant | intent `scopeRef` | exact bound tenant plus authorized scope/purpose | conceal |
| Matching | Requirement/Candidate-derived `tenantId` | intent `scopeRef` | exact derived tenant plus authorized scope | conceal |

## 3. Durable representation

The API-016-owned final event must store an immutable visibility binding distinct from public query filters. For tenant-bound events this includes exact `tenantId` and `scopeRef`; for Property it includes explicit `SYSTEM_BOUND` ownership and system scope without fabricated tenant ID.

## 4. Status

Tenant/scope visibility semantics are `RESOLVED`. Implementation remains blocked until the final event schema has the bounded visibility representation and the event mapping/provenance blockers are closed.
