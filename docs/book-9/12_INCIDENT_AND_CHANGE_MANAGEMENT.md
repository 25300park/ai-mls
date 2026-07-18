# Incident and Change Management

| 항목 | 값 |
|---|---|
| Document ID | DOC-OPS-013 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Incident Owner / Change Owner |
| 기준일 | 2026-07-14 |

## Incident lifecycle

`Detect → Acknowledge/Triage → Classify → Contain → Diagnose/Recover → Validate/Communicate → Close → Post-incident Review`

Security/privacy incident는 [Incident Response](../book-8/13_INCIDENT_RESPONSE.md)를 함께 적용한다. Incident record는 owner, severity, impact/scope, timeline, correlation, action/decision, communication, recovery/validation와 follow-up을 가진다.

## Severity and provisional response targets

| Severity | Definition | Acknowledge | Incident command | Update cadence |
|---|---|---:|---:|---:|
| SEV-1 | safety/security/publication/integrity or broad critical outage | 15 min | 30 min | 30 min |
| SEV-2 | major workflow/dependency degradation, no safe workaround for key users | 30 min | 60 min | 60 min |
| SEV-3 | limited impact with workaround, contained job/integration issue | 4 business hours | as needed | daily |
| SEV-4 | low-impact defect/request, no active service risk | 1 business day | not required | planned |

수치는 `ASSUMPTION`; on-call staffing/business hours와 approval 후 확정한다. Security impact가 불명확하면 높은 severity로 시작할 수 있다.

## Escalation

Operations, Domain/Business, Security/Privacy, Data, AI/Integration, Release/Architecture와 leadership/legal communication을 impact에 따라 호출한다. Unacknowledged, growing, RPO/RTO/SLO breach, suspected restricted exposure 또는 publication ambiguity는 즉시 상향한다.

## Change lifecycle

`Request → Classify/Risk Assess → Review/Approve → Schedule → Implement → Verify/Observe → Close/Rollback`

Change record는 scope/reason, owner, affected environment/service/WF/API/UI/SEC/OPS, data/config/dependency, risk, verification, backup/recovery/rollback, communication와 evidence를 포함한다.

## Change classes and approval

| Class | Example | Approval |
|---|---|---|
| Standard | 반복 검증된 low-risk bounded operation | pre-approved procedure + each execution audit |
| Normal | release/config/capacity/integration/policy change | Change Owner + affected Operations/Domain; security/data/AI review as applicable |
| High risk | authority/security/privacy/data migration/recovery/publication path | independent Business/Security/Data/Architecture approval |
| Emergency | active incident containment/recovery | Incident/Change Owner + minimum required Security/Business authority; retrospective review |

## Emergency change

Emergency도 identity/MFA, scope, reason, minimum verification, backup/rollback, monitoring, audit와 explicit approver를 요구한다. No approval, no audit, direct production credential sharing 또는 publication gate bypass는 허용하지 않는다. Temporary access/flag/config는 automatic expiry와 사후 제거 evidence가 필요하다.

## Post-incident/problem review

SEV-1/2, repeated SEV-3, RPO/RTO/SLO breach, change failure와 security/privacy event는 blameless evidence-based review를 요구한다. Root/contributing cause, detection/response/recovery gap, corrective action/owner/date, risk/Decision/CR와 effectiveness test를 기록한다.

## Metrics

Incident count/impact, MTTD/MTTA/containment/recovery, repeat rate, change success/failure/rollback, emergency change rate, unauthorized drift, overdue corrective action와 communication timeliness를 측정한다.

