# REL-002 Phase 0 Production Gap Register

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-275 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-16 |
| Baseline | `78c19b2498286a98ebb872345a46450e37028773` |

## 1. Register rules

Severity는 Production 안전·복구·운영 영향으로 판정한다. `Blocking`은 Production authorization 전에 닫혀야 함을 뜻하며, Phase 0 자체가 구현 승인을 부여하지 않는다. 관련 현재 상태는 [Production Readiness Inventory](REL002_PHASE0_PRODUCTION_READINESS_INVENTORY.md)를 따른다.

## 2. Canonical gaps

| Gap ID | Production area | Current classification | Current evidence | Required Production state | Severity | Blocking | Dependency | Proposed REL-002 owning phase |
|---|---|---|---|---|---|---|---|---|
| REL002-GAP-001 | A/Q — Runtime/Console | `STAGING_ONLY` | REL-001 Phase 5/6 Staging graph | Production host lifecycle, isolation, startup/drain and safe Console composition | HIGH | YES | configuration, identity, data | Phase 3 |
| REL002-GAP-002 | B — Persistence | `PARTIAL` | Bounded durable SQLite authorities | Approved Production datastore topology, HA, encryption, capacity and lifecycle | CRITICAL | YES | configuration, backup | Phase 2 |
| REL002-GAP-003 | C — Migrations | `NOT_IMPLEMENTED` | Book 9 compatibility policy only | Versioned migration, locking, compatibility, recovery and rehearsal | CRITICAL | YES | Production datastore | Phase 2 |
| REL002-GAP-004 | D — Configuration | `PARTIAL` | Frozen ownership plus Staging values | Typed Production inventory, delivery, drift and rollback proof | HIGH | YES | deployment platform | Phase 1 |
| REL002-GAP-005 | E — Secrets | `PARTIAL` | Secret-reference/no-leak boundary | Production secret injection, workload identity, rotation and revocation | CRITICAL | YES | external/account owners | Phase 1 |
| REL002-GAP-006 | F — AuthN/AuthZ | `STAGING_ONLY` | Durable Staging Session and live authorization | Production identity ingress, service identity and access operations | CRITICAL | YES | config/secrets | Phase 1 |
| REL002-GAP-007 | G — Audit | `STAGING_ONLY` | Durable API-016 Staging runtime | Production retention/archive, availability, access and export | CRITICAL | YES | datastore, retention | Phase 3 |
| REL002-GAP-008 | H — Jobs | `STAGING_ONLY` | Explicit one-shot API-017 runtime | Production worker supervision/dispatch and capacity | HIGH | YES | deployment, observability | Phase 3 |
| REL002-GAP-009 | I — Recovery/retry | `PARTIAL` | Governed F19 decisions and ambiguity containment | Production recovery operation, operator procedure and rehearsal | HIGH | YES | jobs, incident, backup | Phase 5 |
| REL002-GAP-010 | J — Observability | `PARTIAL` | Local durable telemetry evidence | Production metrics/log collection, retention and availability | HIGH | YES | platform/config | Phase 4 |
| REL002-GAP-011 | K — Monitoring/alerts | `PARTIAL` | Local durable alert projection | Notification, escalation, on-call and blind-spot detection | HIGH | YES | observability, incident | Phase 4 |
| REL002-GAP-012 | L — Backup/restore | `NOT_IMPLEMENTED` | Readiness contract; execution `0` | Actual backup, immutable copy, integrity and restore validation | CRITICAL | YES | datastore, secrets | Phase 5 |
| REL002-GAP-013 | M — DR | `NOT_IMPLEMENTED` | Frozen policy only | Concrete DR topology, activation, RPO/RTO and exercise | CRITICAL | YES | backup, deployment | Phase 5 |
| REL002-GAP-014 | N — Deployment | `NOT_IMPLEMENTED` | Evidence contract; execution `0` | CI/CD, immutable promotion, executor/approval and rehearsal | CRITICAL | YES | phases 1-5 | Phase 6 |
| REL002-GAP-015 | O — Rollback | `NOT_IMPLEMENTED` | Readiness projection; execution `0` | Target-bound rollback/forward recovery and rehearsal | CRITICAL | YES | migration, backup, deployment | Phase 5 |
| REL002-GAP-016 | P — Health/readiness | `PARTIAL` | Internal projections and Console | Production probes, dependency semantics and fresh observations | HIGH | YES | runtime, observability | Phase 3 |
| REL002-GAP-017 | R — Security | `PARTIAL` | FEAT-023 verified bounded controls | Production hardening, recertification, service identity and evidence | CRITICAL | YES | identity, secrets, platform | Phase 7 |
| REL002-GAP-018 | S/T — Retention/privacy | `PARTIAL` | Policies and bounded controls | Retention/deletion/legal-hold/privacy operation and owner evidence | HIGH | YES | datastore, provider terms | Phase 2/7 |
| REL002-GAP-019 | V — Capacity | `NOT_IMPLEMENTED` | Architecture objectives only | Load tests, sizing, thresholds, forecast and scaling plan | HIGH | YES | representative runtime | Phase 6 |
| REL002-GAP-020 | W — Runbook | `PARTIAL` | Generic frozen runbook | Exact Production services, commands, contacts and escalation | HIGH | YES | phases 1-6 | Phase 6 |
| REL002-GAP-021 | X — Incident response | `PARTIAL` | Policy plus alert evidence | Executable incident process, roster, paging and exercise | HIGH | YES | monitoring, runbook | Phase 4 |
| REL002-GAP-022 | Y — Release/promotion | `PARTIAL` | Acceptance framework; result `INCOMPLETE` | Exact Production candidate accepted with governed handoff | CRITICAL | YES | all blocking gaps | Phase 8 |
| REL002-GAP-023 | Z — External services | `EXTERNAL_DEPENDENCY` | DEC-162/163 external hold | Approved account controls and separately authorized validation | CRITICAL | YES | external owner | Phase 7 hold lane |
| REL002-GAP-024 | U — Dependency audit | `PRODUCTION_READY` | Production findings `0`; accepted dev High `5` | Exact-candidate audit freshness at final acceptance gate | MEDIUM | NO | exact candidate | Phase 8 |
| REL002-GAP-025 | All — Integrated acceptance | Mixed | No exact Production integrated evidence | Fresh regression, architecture/security/privacy and operational acceptance | CRITICAL | YES | phases 1-7 | Phase 8 |

## 3. Totals and disposition

| Metric | Count |
|---|---:|
| Total gaps | 25 |
| Blocking | 24 |
| Non-blocking | 1 |
| Critical | 13 |
| High | 11 |
| Medium | 1 |

The sole non-blocking gap is the exact-candidate dependency audit refresh at the final acceptance gate. The external provider gap remains separate from repository work. Closing repository gaps must not bypass DEC-162/163 or change REL-001's frozen state.

## 4. Phase 1 design disposition

DEC-164 approves the bounded design for `REL002-GAP-004`, `REL002-GAP-005` and `REL002-GAP-006`. The approved boundary centralizes closed typed Production configuration, provider-neutral secret references and startup validation while reusing existing durable Session and authorization authority.

This design disposition does not close the gaps. Their classifications remain `PARTIAL`, `PARTIAL` and `STAGING_ONLY`; all three remain blocking until separately authorized implementation and Production-bound evidence pass. Infrastructure selection, credential values and live provider activation remain outside Phase 1 design scope.

## 5. Phase 1C proposed amendment impact

Phase 1B implementation inspection identified that a canonical Production SERVICE/WORKLOAD registration authority and shared Production bootstrap are absent. DEC-165 and DEC-166 approve the corresponding design amendments; implementation remains separately gated.

| Gap | Proposed design impact | Current status |
|---|---|---|
| REL002-GAP-004 | DEC-166 assigns ordered validation and lifecycle ownership to `ProductionBootstrap` | `PARTIAL`, `BLOCKING` |
| REL002-GAP-005 | DEC-166 places exact-consumer secret-reference validation/resolution before aggregate PASS | `PARTIAL`, `BLOCKING` |
| REL002-GAP-006 | DEC-165 defines Identity-owned `RegisteredServiceWorkload`; DEC-166 defines explicit Production Session/composition ownership | `STAGING_ONLY`, `BLOCKING` |

The approved decisions do not close or reclassify any gap. Implementation and fresh Production-bound verification remain required; physical table/schema selection remains `DEFERRED`.

## 6. Phase 1D implementation-design impact

Phase 1D-approved DEC-167 and DEC-168 close the remaining physical-design questions without closing the Production gaps.

| Gap | Phase 1D design impact | Current status |
|---|---|---|
| REL002-GAP-004 | DEC-168 approves non-forgeable bootstrap construction context, exact startup ordering and aggregate readiness ownership | `PARTIAL`, `BLOCKING` |
| REL002-GAP-005 | Bootstrap validates mandatory references, resolves secrets only for exact consumers and stores no credential values | `PARTIAL`, `BLOCKING` |
| REL002-GAP-006 | DEC-167 approves Identity-owned durable registration table/store and `registrationId`-only resolver; live authz remains existing authority | `STAGING_ONLY`, `BLOCKING` |

Phase 1D does not reclassify a gap. Separately authorized implementation, Phase 2 migration readiness and fresh Production-bound verification are still required.

## 7. Phase 1F authority/root-governance design impact

Phase 1E review proved four concrete design gaps. Phase 1F records bounded proposals without reclassifying Production readiness.

| Gap | Phase 1F design impact | Current status |
|---|---|---|
| REL002-GAP-004 | DEC-170 approves one closed registry governing the five actual Production roots; synthetic slots are insufficient | `PARTIAL`, `BLOCKING` |
| REL002-GAP-005 | Existing exact-consumer secret boundary is preserved; no new secret or provider path is introduced | `PARTIAL`, `BLOCKING` |
| REL002-GAP-006 | DEC-169 approves immutable Identity/API-016 evidence binding and a non-Session workload subject for the existing live policy engine; DEC-171 approves exact schema authority | `STAGING_ONLY`, `BLOCKING` |

DEC-169/170/171 are `APPROVED`. Their approval does not close any gap, authorize Phase 1E implementation or alter the Phase 0 counts (`24` blocking, `1` non-blocking).

## 8. Phase 1G salvage implementation impact

Phase 1G implements the bounded DEC-169/170/171 contracts without Production migration, secret backend, infrastructure or provider activation.

| Gap | Phase 1G evidence | Current status |
|---|---|---|
| REL002-GAP-004 | canonical startup ordering and actual root registry are implemented | `PARTIAL`, `BLOCKING` |
| REL002-GAP-005 | mandatory reference ordering and provider hold are preserved; concrete backend/rotation is absent | `PARTIAL`, `BLOCKING` |
| REL002-GAP-006 | evidence-bound workload subject, live policy evaluation and strict schema checker are implemented | `STAGING_ONLY`, `BLOCKING` |

`IMPLEMENTATION_COMPLETE` does not mean `PRODUCTION_SCHEMA_READY`. Phase 2 migration/provisioning and exact Production-bound evidence remain required. Counts remain `24` blocking and `1` non-blocking.

## 9. Phase 2A migration/schema-readiness design impact

Phase 2A maps the Phase 1G exact code contract to an approved versioned migration design, internal readiness states, non-destructive rollback and separate identity registration policy. DEC-172/173/174 are `APPROVED`; no migration, Production database access or identity initialization occurred.

| Gap | Phase 2A design evidence | Current status |
|---|---|---|
| REL002-GAP-004 | exact schema readiness results and `startProductionRuntime()` fail-closed mapping defined; Production-bound execution evidence absent | `PARTIAL`, `BLOCKING` |
| REL002-GAP-005 | migration stores no credentials and changes no secret boundary; concrete Production secret backend/rotation absent | `PARTIAL`, `BLOCKING` |
| REL002-GAP-006 | exact v1 migration/schema and separate evidence-bound registration process designed; schema/rows not provisioned | `STAGING_ONLY`, `BLOCKING` |

Phase 2A design does not reclassify a gap or change the Phase 0 counts (`24` blocking, `1` non-blocking).

## 10. Phase 2B migration/schema implementation impact

Phase 2B implements the approved explicit v1 artifact, immutable artifact checksum binding, append-only execution-ledger contract, read-only runtime classifier and migration verification tests. Execution occurred only against disposable test databases; Production migration execution and Production DB writes remain `0`.

| Gap | Phase 2B implementation evidence | Current status |
|---|---|---|
| REL002-GAP-004 | exact readiness classifier is implemented, but no Production-bound controlled execution evidence exists | `PARTIAL`, `BLOCKING` |
| REL002-GAP-005 | migration contains no credential and changes no secret boundary; Production secret injection/rotation remains absent | `PARTIAL`, `BLOCKING` |
| REL002-GAP-006 | exact Identity schema artifact and compatibility validation are implemented; Production schema and registrations are not provisioned | `STAGING_ONLY`, `BLOCKING` |

Phase 2B does not reclassify these gaps or change the Phase 0 counts (`24` blocking, `1` non-blocking). Production schema readiness is `NOT_READY_UNTIL_CONTROLLED_EXECUTION`.

## 11. Phase 2C controlled execution readiness impact

Phase 2C defines the controlled Production migration gate without executing it. The logical target is the existing Identity-owned Production Identity/Session database boundary and the environment is exactly `PRODUCTION`. The exact physical database binding, named operator execution evidence and current exact-target backup/restore evidence are not present and remain blocking.

| Gap | Phase 2C readiness evidence | Current status |
|---|---|---|
| REL002-GAP-004 | execution packet must bind an exact opaque Production database/configuration reference; current physical binding is absent | `PARTIAL`, `BLOCKING` |
| REL002-GAP-005 | migration stores no credential; concrete Production secret injection/rotation remains absent | `PARTIAL`, `BLOCKING` |
| REL002-GAP-006 | migration/verification/Bootstrap transition are defined, but Production schema, registrations and operator execution evidence are not provisioned | `STAGING_ONLY`, `BLOCKING` |

Phase 2C does not reclassify these gaps or change the Phase 0 counts (`24` blocking, `1` non-blocking). Migration execution, Production DB writes, identity seed and runtime schema auto-create remain `0`; Production schema remains `NOT_READY_UNTIL_CONTROLLED_EXECUTION`.

## 12. Phase 2D-0A infrastructure binding amendment impact

Phase 2D-0A ratifies Vercel delivery, Railway runtime and Supabase PostgreSQL persistence through approved DEC-175~178. The decisions do not approve infrastructure mutation or execute a migration. The previous SQLite Production execution path is `RETIRED_FOR_PRODUCTION`; existing canonical local/test use and historical Phase 2B evidence remain immutable. PostgreSQL-specific migration, store adapters, compatibility validation, physical binding and exact backup/restore evidence do not yet exist.

| Gap | Phase 2D-0A evidence | Current status |
|---|---|---|
| REL002-GAP-004 | provider/engine/environment are proposed, but Supabase project/database/region/connection mode and PostgreSQL schema are unbound | `PARTIAL`, `BLOCKING` |
| REL002-GAP-005 | provider-neutral `IDENTITY_DATABASE_CONNECTION_REF` boundary is defined; actual secret backend/reference/rotation binding is absent | `PARTIAL`, `BLOCKING` |
| REL002-GAP-006 | Identity authority is preserved, but PostgreSQL migration/compatibility adapter, Production schema and registrations are absent | `STAGING_ONLY`, `BLOCKING` |

Phase 0 counts remain `24` blocking and `1` non-blocking. `PHYSICAL_DB_BINDING = UNBOUND`, operator/backup/restore remain `BLOCKED`, and migration execution/Production DB writes/deployment remain `0`.

## 13. Phase 2D-0B PostgreSQL transition design impact

Phase 2D-0B defines the bounded async PostgreSQL adapter, `app_identity` physical contract, per-Railway-process pool/transaction ownership, read-only `pg_catalog` validator, separate PostgreSQL migration artifact and Railway/Supabase binding design. DEC-179~182 are `APPROVED`; `pg` is approved for the next separately authorized implementation and `@types/pg` only if compilation requires it. This documentation closeout changes no dependency, code, infrastructure, credential or database.

| Gap | Phase 2D-0B design evidence | Current status |
|---|---|---|
| REL002-GAP-004 | Supabase PostgreSQL configuration/reference/pool/TLS contract is defined, but exact project/database/region/connection mode and secret values remain unbound | `PARTIAL`, `BLOCKING` |
| REL002-GAP-005 | Railway-only provider-neutral secret references and Vercel exclusion are defined, but exact secret backend/reference/rotation evidence is absent | `PARTIAL`, `BLOCKING` |
| REL002-GAP-006 | PostgreSQL schema/migration/adapter/validator contracts are designed, but no implementation, schema execution or Production identity exists | `STAGING_ONLY`, `BLOCKING` |

Phase 0 counts remain `24` blocking and `1` non-blocking. Physical binding remains `UNBOUND`; migration execution, Production DB writes, identity seed, deployment and provider/network actions remain `0`.

## 14. Phase 2D-0C PostgreSQL implementation impact

Phase 2D-0C implements the approved `pg` pool, async Session UoW, read-only RegisteredServiceWorkload store, exact catalog validator, explicit PostgreSQL Up/Verify artifact and async Production bootstrap boundary. Production Identity composition now rejects SQLite; existing SQLite local/test/historical adapters remain unchanged. No Supabase project, connection, migration execution, Production DB write, identity seed or deployment occurred.

| Gap | Phase 2D-0C evidence | Current status |
|---|---|---|
| REL002-GAP-004 | async PostgreSQL startup and pool lifecycle are implemented; exact Supabase project/database/region/connection mode remains unbound | `PARTIAL`, `BLOCKING` |
| REL002-GAP-005 | TLS and provider-neutral secret-reference consumption boundary are implemented; exact secret backend/reference/rotation evidence remains absent | `PARTIAL`, `BLOCKING` |
| REL002-GAP-006 | PostgreSQL adapters, validator and migration artifacts are implemented; controlled migration, compatible Production schema and authoritative registrations remain absent | `STAGING_ONLY`, `BLOCKING` |

Phase 0 counts remain `24` blocking and `1` non-blocking. `PHYSICAL_DB_BINDING = UNBOUND`; migration execution, Production DB writes, identity seed, deployment and provider/network actions remain `0`.

## 15. Phase 2D-0D physical binding contract impact

Phase 2D-0D identifies the exact Supabase project/region/direct PostgreSQL endpoint and Railway `ai-mls-api` service without connecting, deploying or mutating infrastructure. It binds one canonical `IDENTITY_DATABASE_CONNECTION_REF` and exact non-secret target assertions. The repository still lacks a physical secret backend/reference, approved exact pool values, Production executable/start command and Railway-reachable readiness endpoint.

| Gap | Phase 2D-0D evidence | Current status |
|---|---|---|
| REL002-GAP-004 | exact physical DB target is identified; least-privilege runtime role, controlled migration/schema execution and Production executable/readiness path are absent | `PARTIAL`, `BLOCKING` |
| REL002-GAP-005 | single canonical reference and consumer boundary are defined; backend/reference/rotation evidence remains absent | `PARTIAL`, `BLOCKING` |
| REL002-GAP-006 | runtime target is identified but variable mapping implementation, schema, registrations and Production-bound authority evidence are not provisioned | `STAGING_ONLY`, `BLOCKING` |

Phase 0 counts remain `24` blocking and `1` non-blocking. Migration execution, Production connection/writes, identity seed, deployment and infrastructure mutation remain `0`.

## 16. Phase 2D-0E executable / secret / role design impact

Phase 2D-0E approves the exact Railway Production executable/start lifecycle, safe `/livez` and `/readyz` operational projections, least-privilege runtime/migration PostgreSQL role split, Railway reference-only delivery plus runtime-only secret backend requirement, and initial bounded pool/TLS values. `DEC-183~187 = APPROVED`; no code, role, variable, connection, deployment or migration action occurred. Physical secret-value backend remains `OTHER_REQUIRED / BLOCKED` and `SECRET_BACKEND_EXECUTION = BLOCKED`.

| Gap | Phase 2D-0E design evidence | Current status |
|---|---|---|
| REL002-GAP-004 | exact executable, start command and readiness lifecycle are designed; executable/route/platform configuration and deployment evidence remain absent | `PARTIAL`, `BLOCKING` |
| REL002-GAP-005 | Railway build-time variable exposure is identified; exact references are designed but runtime-only value backend, resolver/platform configuration and rotation evidence remain absent | `PARTIAL`, `BLOCKING` |
| REL002-GAP-006 | exact runtime/migration roles and pool/TLS bounds are designed; roles/schema/registrations and Production-bound authority evidence are not provisioned | `STAGING_ONLY`, `BLOCKING` |

Phase 0 counts remain `24` blocking and `1` non-blocking. Migration execution, Production connection/writes, identity seed, role execution, deployment, credential use and infrastructure mutation remain `0`.
