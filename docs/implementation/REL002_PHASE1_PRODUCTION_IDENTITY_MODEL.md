# REL-002 Phase 1 Production Identity Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-279 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security Owner |
| 기준일 | 2026-09-17 |
| Decision | DEC-164 |

## 1. Authority rule

Production identity reuses `SessionService`, `DurableSessionUnitOfWork`, `SessionAccessCoordinator`, `AuthorizationService` and administration-backed live assignments. Configuration identifies adapters and registered identities; it cannot create identity, role, capability, tenant membership or business authority.

## 2. Identity boundary matrix

| Boundary | Canonical representation | Trust derivation | Authorization | Production rule |
|---|---|---|---|---|
| Human principal | `SessionContext.principalType = HUMAN` | approved authentication adapter → durable Session → trusted binding | live `AuthorizationService`; MFA where required | caller actor/tenant/scope fields ignored |
| Service principal | `principalType = SERVICE`, `assurance = WORKLOAD` | registered service identity adapter | live exact-purpose/scope assignment | `SVC` label alone is insufficient |
| Job/background actor | service principal plus durable Job identity/provenance | API-017 registered worker/control identity | existing job authorization and CAS | no scheduler/worker authority created by config |
| Audit actor | `AuditPrincipalProvenance` trusted snapshot or immutable reference | captured at mutation time | API-016 materialization preserves provenance | no processing-time Session reconstruction |
| Admin Console actor | human Session resolved server-side | trusted Production Session ingress | existing Console/API authorization and MFA | development Session and principal override rejected |
| External provider identity | registered adapter consumer plus secret reference | Production composition and resolver binding | technical call only | no human/business/RBAC authority |

## 3. Tenant and scope

- Tenant/team and scope originate from trusted Session binding or registered workload identity, never request configuration.
- Every access revalidates current live authority.
- Cross-tenant, cross-scope and mismatched environment bindings fail closed using existing concealment semantics.
- A credential reference does not imply tenant, scope, purpose or authority.

## 4. Production identity composition

The future Production composition supplies:

1. durable Session UoW;
2. approved authentication adapter;
3. trusted Session binding resolver;
4. live administration-backed authorization resolver;
5. registered service identity resolver;
6. API-016 audit sink.

All must report ready before the startup gate succeeds. No process-local or static-test authority is accepted.

## 5. MFA and SoD

Existing action-specific MFA freshness and separation-of-duties checks remain authoritative. Configuration cannot lower MFA, merge producer/approver/executor identities or introduce an emergency bypass. Break-glass remains governed by existing security/incident policy and is not implemented here.

## 6. Safe evidence

Audit and telemetry may contain principal/service reference, principal type, safe role codes, tenant/scope reference, configuration version and correlation ID. They must not contain authentication evidence, refresh material, secret values, raw credentials or mutable authority snapshots used as current permission.

## 7. Architecture result

New identity authority, API, role, capability and lifecycle state are all `NO`. Only a Production composition adapter around existing authority is required.
