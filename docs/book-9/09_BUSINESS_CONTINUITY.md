# Business Continuity

| 항목 | 값 |
|---|---|
| Document ID | DOC-OPS-010 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Continuity Owner / Business Owner |
| 기준일 | 2026-07-14 |

## Critical services

| Priority | Capability | Continuity objective |
|---|---|---|
| C0 | identity/authorization, audit, authority/evidence protection, incident communication | preserve safety/accountability; unsafe write disabled |
| C1 | property/candidate/client/requirement read, manual intake, contact/verification task | continue bounded internal work with freshness markers |
| C2 | matching/AI/notifications/reporting | manual/deterministic fallback or delayed processing |
| C3 | new external connector/publication delivery | suspend unless exact approval/state/reconciliation available |

## Manual operation

Manual continuity record는 unique temporary ID, user/time, purpose, source/evidence, data class, intended workflow와 reconciliation owner를 가진다. Approved secure template/location만 사용하고 personal data를 consumer messaging/spreadsheet에 무분별하게 복제하지 않는다. Manual work는 Verification/Permission/Approval/Publication을 우회하지 않으며 system 복구 후 duplicate/version/audit reconciliation을 거친다.

## Service degradation modes

| Mode | Allowed | Prohibited |
|---|---|---|
| Read-only | current scoped data with freshness warning | canonical write/approval/publication |
| Intake-only | evidence capture to governed durable boundary | candidate verification/public exposure |
| Manual review queue | record pending decisions for later authorized application | offline decision을 system-approved로 표시 |
| AI unavailable | manual parse/search/matching review | fabricated score/result, automatic approval |
| Connector unavailable | core work and queued/suspended integration | direct core DB/external bypass |
| Publication unavailable/unknown | internal hold/reconciliation | retry without idempotency, false Published |

## Recovery priority

Safety/authority/audit → read access → high-value internal workflows → asynchronous processing → external delivery → optimization/reporting 순으로 복구한다. Priority는 business pressure로 privacy/security/publication gates를 낮추지 않는다.

## Continuity principles

- staff/contact tree, decision authority, alternate communication와 handover를 유지한다.
- manual capacity, critical dependency와 maximum tolerable disruption을 review한다.
- work backlog/freshness/client impact를 transparent하게 표시한다.
- continuity action/exception도 incident/change/audit evidence를 가진다.
- exercise finding은 runbook, capacity, training와 vendor/partner contract에 반영한다.

## Exercises

Tabletop은 최소 반기, cross-functional continuity/DR exercise는 최소 연 1회를 `ASSUMPTION`으로 한다. Critical organization/process change 또는 incident 후 추가 exercise가 필요하다. Exact cadence와 business maximum tolerable outage는 `OPEN DECISION`이다.

