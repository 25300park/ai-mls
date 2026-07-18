# Disaster Recovery

| 항목 | 값 |
|---|---|
| Document ID | DOC-OPS-009 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Disaster Recovery Owner / Operations Owner |
| 기준일 | 2026-07-14 |

## Disaster scenarios

Primary data/storage loss or corruption, extended runtime/site outage, credential/key compromise, ransomware/malicious change, regional/provider dependency outage, identity/AI/connector/publication prolonged failure, backup failure와 simultaneous personnel/communication disruption을 고려한다.

## Recovery priorities

1. People/security/incident coordination and access control.
2. Identity, authorization, audit/logging와 configuration/key availability.
3. Tier 0 authority/audit data와 core read/write safety.
4. Tier 1 intake/listing/client/verification workflow.
5. publication reconciliation와 external integration.
6. AI, reporting, search/projection와 noncritical capabilities.

AI/search availability보다 human authority, provenance와 audit integrity를 우선한다.

## Activation criteria

Incident Owner와 DR Owner가 expected outage/data/integrity/security impact가 normal recovery threshold를 초과한다고 판단하고 Business/Security/Data owner가 activation을 승인한다. Immediate containment은 가능하지만 broad restore/cutover는 dual authorization을 요구한다. Exact threshold는 `OPEN DECISION`이다.

## Recovery workflow

1. Declare incident/DR, scope, command roles와 communication channel.
2. Contain compromise/external effects and preserve evidence.
3. Select known-good environment/recovery point and validate key/access.
4. Restore Tier 0 then Tier 1 consistency sets in isolated boundary.
5. Validate security, data, workflow, audit and application health.
6. Enable limited internal service; monitor/reconcile backlog.
7. Reconcile publication/connector/external state before normal delivery.
8. Complete cutover/failback decision, stakeholder communication and observation.
9. Close only after temporary access/data cleanup and post-recovery review.

## Communication

Audience별 internal staff, leadership, security/privacy/legal, client/partner/provider와 public message를 분리한다. Confirmed scope, service impact, workaround, next update와 minimum sensitive detail을 제공한다. Communication owner/time/approval와 delivery evidence를 기록한다.

## Post-recovery validation

Identity/role/session/key, configuration/version, data/object/audit completeness, job/queue duplication, expiry/revocation, publication external state, connector checkpoint, monitoring/alerts, RPO/RTO와 residual risk를 검증한다. False success/duplicate external effect가 없음을 확인한다.

## Failback

Original environment로의 복귀는 별도 approved change/release이며 data divergence, security root cause, integration endpoint, rollback와 observation을 검증한다. DR activation 종료가 incident/postmortem을 생략하지 않는다.

