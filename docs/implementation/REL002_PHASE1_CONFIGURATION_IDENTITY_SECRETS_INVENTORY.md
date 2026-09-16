# REL-002 Phase 1 Configuration, Identity and Secrets Inventory

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-277 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-17 |
| Baseline | `5f66e617f0030339b3c85bed2ab798981e4539a1` |

## 1. Objective

REL-002 Phase 0의 `REL002-GAP-004/005/006`만 대상으로 기존 configuration, identity, authorization 및 credential-reference 경계를 재사용 가능한 Production 설계 요소로 식별한다. 이 inventory는 Production 실행 또는 credential 사용을 승인하지 않는다.

## 2. Existing implementation and reuse targets

| Concern | Existing canonical component | Current boundary | Production reuse decision |
|---|---|---|---|
| Environment/config parsing | `apps/admin-console/src/console-configuration.ts`; subsystem composition validators | Development/Test/Staging are explicit; Console rejects Production | Shared vocabulary only; subsystem parsers are not a Production configuration authority |
| Session durability | `DurableSessionUnitOfWork`, `SessionService` | durable session, revocation, expiry, CAS | Reuse unchanged |
| Request admission | `SessionAccessCoordinator` | trusted session binding plus live authorization | Reuse as mandatory human ingress |
| RBAC/scope | `AuthorizationService` and administration-backed live assignment resolver | current role/capability/scope authority | Reuse; no parallel RBAC |
| Human principal | `SessionContext` with `HUMAN`, tenant/team, assurance and MFA | actor derived from durable Session | Reuse; caller fields are never authoritative |
| Service/job principal | `SessionContext`/`AuditPrincipal` with `SERVICE`, `WORKLOAD`, `SVC` and live assignment checks | API-017 worker/control identities and workload evidence | Reuse; registration/configuration is required before Production |
| Audit actor | mutation-time `AuditPrincipalProvenance` | trusted snapshot or immutable evidence reference | Reuse; no processing-time reconstruction |
| Admin Console actor | Staging trusted Session ingress | no development session outside Development | Extend composition only; Production uses trusted Session resolution |
| Database configuration | bounded factories accepting explicit `databasePath` | file-backed SQLite and fail-closed local validation | Phase 2 selects Production datastore; Phase 1 defines reference/config boundary only |
| AI credential reference | `AdvisoryCredentialResolver` and `credentialRef` | Staging-only, provider-independent, live provider held | Generalize by adapter compatibility; DEC-162/163 remain unchanged |
| API/provider credentials | adapter-local references and safe telemetry | no raw credential DTO/audit contract | Preserve reference-only configuration |
| Operational evidence | FEAT-023 safe projections and sanitization | no external monitoring destination or credential | Phase 4 owns activation; Phase 1 defines optional reference class only |

## 3. Current gaps

| Gap | Current state | Exact design gap | Phase 1 disposition |
|---|---|---|---|
| REL002-GAP-004 | `PARTIAL` | no central typed Production configuration ownership or startup gate | bounded `ProductionRuntimeConfiguration` design |
| REL002-GAP-005 | `PARTIAL` | no provider-neutral Production secret-reference resolution boundary | bounded `SecretReferenceResolver` port design |
| REL002-GAP-006 | `STAGING_ONLY` | no Production composition for trusted identity dependencies | reuse-only Production identity dependency boundary |

All three gaps remain blocking until separately authorized implementation and verification complete.

## 4. Configuration ownership inventory

| Class | Owner | Validation owner | Rule |
|---|---|---|---|
| Build-time config | Build/Release Owner | build pipeline plus artifact manifest | contains no environment secret or mutable authority |
| Runtime non-secret config | Operations Owner | bounded Production configuration module | typed, versioned, explicit environment |
| Environment-specific config | Operations Owner with Security review | Production startup validator | no cross-environment fallback |
| Secret references | Security/Integration Owner | startup validator plus authorized resolver | opaque reference only |
| Resolved secret values | Secret system owner and exact runtime consumer | resolver adapter | transient; never serialized/logged/audited |
| Security/identity config | Security Owner | identity adapters plus live authorization | cannot grant role/capability through config |
| Provider config | AI/Integration Owner | provider adapter | disabled while DEC-162 external hold remains |

## 5. Identity boundaries identified

Six boundaries are identified: human principal, service principal, job/background actor, audit actor, Admin Console actor and external integration/provider identity. They all reuse existing principal types and authority evaluation. No new identity authority, API, role, capability or lifecycle state is required.

## 6. Secret classes identified

| Secret class | Current need | Phase owner | Phase 1 rule |
|---|---|---|---|
| Database credential | mandatory for a future Production datastore | Phase 2 | reference contract only |
| Authentication authority credential/signing material | conditional; current Session model does not define signing material | separate auth decision if needed | do not invent or require |
| External AI/provider credential | external hold | Phase 7 hold lane | reference remains unavailable; activation prohibited |
| Connector/external integration credential | conditional by approved connector | owning integration phase | reference only |
| Deployment/platform credential | required only for deployment execution | Phase 6 | excluded from application runtime |
| Monitoring/alerting credential | required only if external destination approved | Phase 4 | optional reference class; no destination selected |
| Backup encryption/key material | required when Production backup design is approved | Phase 5 | reference only |

## 7. Architecture disposition

| Item | Decision |
|---|---|
| Reuse/extension | Required |
| New bounded configuration module | YES — approved for design |
| New secret-reference adapter boundary | YES — approved for design |
| New identity boundary/authority | NO |
| New API | NO |
| New role/capability | NO |
| Infrastructure/provider selection | DEFERRED |
