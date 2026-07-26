# AI-MLS Event Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-051 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Data Owner |
| 기준일 | 2026-07-24 |
| Registry | [Canonical Event Registry](00_EVENT_REGISTRY.md) |

## Canonical event catalog

| Event ID | Event Name | Type | Primary Category | Source boundary |
|---|---|---|---|---|
| EVT-001 | Publication Requested | Business | Governance Event | Publication Approval request |
| EVT-002 | Publication Approved | Business | Governance Event | effective Publication Approval |
| EVT-003 | Publication Activated | Business | Lifecycle Event | confirmed Publication activation |
| EVT-004 | Publication Suspended | Business | Lifecycle Event | authorized Publication suspension |
| EVT-005 | Revalidation Completed | Business | Governance Event | qualified current-policy revalidation |
| EVT-006 | Reconciliation Resolved | Business | Recovery Event | evidence-backed reconciliation resolution |
| EVT-007 | Withdrawal Confirmed | Business | Lifecycle Event | confirmed Publication withdrawal |
| EVT-008 | Republish Confirmed | Business | Lifecycle Event | confirmed Publication republish |
| EVT-009 | Material Change Accepted | Business | Governance Event | authorized materiality disposition |
| EVT-010 | Projection Rebuild Requested | Technical | Projection / Operational Event | authorized rebuild operation |
| EVT-011 | Projection Rebuild Completed | Technical | Projection / Audit Event | validated rebuild completion |
| EVT-012 | Replay Completed | Technical | Recovery / Audit Event | validated replay completion |

## Lookup by category

| Category | Events |
|---|---|
| Lifecycle Event | EVT-003/004/007/008 |
| Governance Event | EVT-001/002/005/009 |
| Projection Event | EVT-010/011 |
| Recovery Event | EVT-006/012 |
| Audit Event | EVT-011/012 |
| Operational Event | EVT-010 |

## Lookup by aggregate

| Aggregate / operation boundary | Events |
|---|---|
| Publication Approval | EVT-001/002 |
| Publication | EVT-003/004/007/008/009 |
| Verification / Permission eligibility context | EVT-005 |
| Reconciliation Case | EVT-006 |
| Projection Operation | EVT-010/011 |
| Replay Operation | EVT-012 |

## Lookup by projection consumer

| Projection | Event coverage |
|---|---|
| PRJ-001 Search Projection | EVT-003/004/007/008; rebuild/replay EVT-010~012 |
| PRJ-002 Listing Projection | EVT-002~009; rebuild/replay EVT-010~012 |
| PRJ-003 Client Projection | EVT-005; rebuild/replay EVT-010~012 |
| PRJ-004 Dashboard Projection | EVT-001~012 |
| PRJ-005 Analytics Projection | EVT-003/006~009; rebuild/replay EVT-010~012 |
| PRJ-006 Notification Projection | EVT-001~009 for derived notification state; EVT-010~012 operation evidence only and never resend |
| PRJ-007 Integration Projection | EVT-003/004/006~008; rebuild/replay EVT-010~012 |
| PRJ-008 Cache Projection | EVT-003~012 |

## Governance lookup

- Identity and integrity: [Event Registry §4](00_EVENT_REGISTRY.md#4-event-identity-and-integrity-envelope)
- Classification: [Event Registry §5](00_EVENT_REGISTRY.md#5-event-classification)
- Ordering: [Event Registry §6](00_EVENT_REGISTRY.md#6-event-ordering)
- Version: [Event Registry §7](00_EVENT_REGISTRY.md#7-event-version)
- Security: [Event Registry §8](00_EVENT_REGISTRY.md#8-event-security)
- Replay: [Event Registry §9](00_EVENT_REGISTRY.md#9-replay-policy)
- Retention: [Event Registry §10](00_EVENT_REGISTRY.md#10-retention-policy)
- Registry mapping: [Event Registry §11](00_EVENT_REGISTRY.md#11-dependency-and-registry-mapping)
- Validation: [Event Registry §12](00_EVENT_REGISTRY.md#12-validation-and-error-rules)

## Scope boundary

이 Index와 Registry는 Event governance만 정의한다. Event Bus, Queue, Event Store, worker, broker/provider, physical payload schema, executable replay와 FEAT-015는 정의하거나 구현하지 않는다.
