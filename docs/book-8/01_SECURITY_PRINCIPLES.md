# Security Principles

| 항목 | 값 |
|---|---|
| Document ID | DOC-SEC-002 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security/Privacy Reviewer |
| 기준일 | 2026-07-14 |

## Security objectives

| Objective | Required outcome |
|---|---|
| Confidentiality | personal, source, client, credential와 security evidence는 authorized purpose/scope에서만 노출 |
| Integrity | canonical state, approval, provenance, audit와 publication representation의 unauthorized alteration 방지 |
| Availability | authorized 업무와 recovery가 통제된 방식으로 지속되며 security bypass로 가용성을 얻지 않음 |
| Accountability | principal, session, action, object/version, reason, decision과 outcome 추적 |
| Privacy | lawful/approved purpose에 필요한 최소 데이터만 사용·보존·공개 |
| Safety | AI/connector/failure가 human authority 또는 public exposure를 확대하지 않음 |

## Zero Trust principles

Network/location/device/previous success만 신뢰 근거로 사용하지 않는다. API-002는 매 request/action마다 principal, role, team, resource, purpose, current workflow state, assignment와 risk context를 평가한다. Internal service도 service identity, narrow scope, expiry와 workload provenance가 필요하다.

## Least privilege and need-to-know

Grant는 default deny이며 직무에 필요한 action/resource/field/purpose/time 범위로 제한한다. View, reveal, export, verify, approve, publish와 administer는 별도 capability다. Dashboard visibility나 data possession은 다른 action permission을 부여하지 않는다.

## Defense in depth

Authentication, authorization, workflow guard, validation, classification, encryption, masking, audit, monitoring와 recovery를 중첩한다. 하나의 UI/API/network control 실패가 publication, restricted export 또는 approval로 이어지지 않아야 한다.

## Privacy by design/default

Collection 전 purpose/classification/retention을 정의하고 최소 field, masked display, bounded retention와 deletion/legal hold path를 사용한다. 새로운 use, AI provider 또는 connector는 기존 consent/permission을 암묵 재사용하지 않는다.

## Fail-closed and recoverable control

Identity, authorization, classification, key, approval 또는 external reconciliation이 불명확하면 privileged action을 거절한다. 실패는 [Security Event Model](10_SECURITY_EVENT_MODEL.md)과 [Incident Response](13_INCIDENT_RESPONSE.md)에 연결하되 raw secret/personal payload를 log에 남기지 않는다.

## Ownership

Security Owner는 control baseline과 exception을, Privacy Owner는 purpose/handling을, Business Owner는 업무 authority를, Architecture Owner는 cross-phase consistency를 관리한다. Control exception은 named owner, bounded scope/expiry, compensating control, risk acceptance와 audit evidence가 필요하다.

