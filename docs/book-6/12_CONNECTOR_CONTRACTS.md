# Connector Contracts

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-013 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Security Reviewer |
| 기준일 | 2026-07-14 |
| API Capability | API-018 |

## Purpose

Connector가 core authority를 우회하지 않고 source intake 또는 approved outbound integration을 수행하기 위한 logical ingress/egress contract를 정의한다.

## Contract inventory

| Connector | Classification | Direction | Allowed purpose | Current contract decision |
|---|---|---|---|---|
| Manual Intake | **CURRENT** | inbound | authorized staff evidence capture | same Source/Intake API; human principal |
| CSV | **CURRENT** | inbound | reviewed batch intake | same intake gates; exact file profile/operational readiness 미확정 |
| Browser Extension | **PLANNED** | inbound | user-directed capture at approved source | autonomous scraping prohibited |
| Website Connector | **PLANNED** | inbound | approved website source capture | source permission/robots/contract required |
| AI Memory Gateway | **ASSUMPTION** | bidirectional | approved context mediation | privacy/consent/retention/tenant isolation 미결정 |
| CRM | **ASSUMPTION** | bidirectional | selected client/activity sync | system of record/conflict policy 미결정 |
| Accounting | **ASSUMPTION** | limited bidirectional | authorized transaction/reference sync | financial authority/data scope 미결정 |
| Marketing | **ASSUMPTION** | outbound/status inbound | approved campaign/listing communication | consent/withdrawal/channel policy required |
| rbs-homes | **ASSUMPTION** | outbound/status inbound | approved publication and reconciliation | actual API/auth/capabilities unverified |

## Logical Endpoints

Inbound: `RegisterConnectorInstance`, `SubmitCaptureBatch`, `ReadBatchStatus`, `AdvanceCheckpoint`. Outbound: `LeaseApprovedDelivery`, `ReportDeliveryAttempt`, `SubmitExternalObservation`, `ReportHealth`. These are logical operations; connector-specific routes/schema are not defined.

## Request Model

Connector identity/version, approved instance/source/target policy, credential reference, batch/operation/idempotency key, checkpoint, item provenance, observed time, payload checksum/data classification와 trace context를 요구한다. Outbound operation references exact approved representation and never accepts connector-created approval.

## Response Model

Accepted/rejected item counts with item-safe error refs, batch/operation ID, next checkpoint, allowed retry time, policy/version and reconciliation instruction을 반환한다. Acceptance means intake/delivery processing accepted, not candidate verified or publication confirmed.

## Business Rules

Connector는 scoped public boundary만 호출하고 database/private module에 접근하지 않는다. Inbound item은 manual intake와 같은 validation/human gates를 거친다. Outbound connector는 exact approved command만 전달한다. Checkpoint는 evidence이지 source completeness 보장이 아니다. Kill switch/revoke는 새 work를 즉시 차단한다.

## Authority

Connector service principal은 instance/source/target/action scope만 가진다. Source Policy Owner와 Integration Owner가 policy를, human verifier/approver가 business authority를 가진다. Connector가 role/permission/verification/approval을 생성하지 못한다.

## Validation

instance status/version, source/target policy, credential scope, item provenance/schema/size, replay/idempotency, checkpoint monotonicity where applicable, rate, privacy class, approval/representation checksum와 current authority를 검사한다.

## Audit

instance activation/revoke, credential reference use, batch/operation, item dispositions, checkpoint, request/response checksum, retry, rate/policy denial, external observation, health와 kill-switch action을 기록한다.

## Error Conditions

`CONNECTOR_NOT_APPROVED`, `CONNECTOR_REVOKED`, `SOURCE_NOT_ALLOWED`, `TARGET_NOT_ALLOWED`, `BATCH_PARTIALLY_REJECTED`, `CHECKPOINT_CONFLICT`, `PAYLOAD_NOT_ALLOWED`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`, `RECONCILIATION_REQUIRED`.

## Related Workflow

Inbound: `WF-001`–`004`; outbound: `WF-009`–`012`.

## Related Entity

Collector, Source Registry, Raw Source, Raw Attachment, Source Provenance, Publication Target, Publication, AI Job, System Error, Audit Event.

## Related AI Capability

Inbound may trigger `AI-001`–`003`, `AI-007` only after core acceptance. AI Memory Gateway is **ASSUMPTION** and grants no authority.
