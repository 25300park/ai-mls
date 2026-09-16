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
