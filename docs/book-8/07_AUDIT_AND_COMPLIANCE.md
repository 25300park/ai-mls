# Audit and Compliance

| 항목 | 값 |
|---|---|
| Document ID | DOC-SEC-008 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security/Governance Owner / Privacy Owner |
| 기준일 | 2026-07-14 |

## Audit scope

Authentication/session, allow/deny, restricted reveal, create/change/disposition, AI review, Verification, Permission, approval, publication, export, administration, connector/job, exception, incident, backup/recovery와 audit access를 포함한다.

## Minimum audit event

| Field | Requirement |
|---|---|
| Identity | human/service principal, active role/team/assignment |
| Session/request | session reference, request/correlation/idempotency where applicable |
| Action/target | action, entity ID/type, exact version/field scope |
| Context | purpose, policy/control version, classification, source channel/device risk where allowed |
| Decision | allow/deny, prerequisite result, reason, approver/authority type |
| Outcome | accepted/completed/failed/unknown/reconciled; before/after status reference |
| Time | trusted event/ingest time and ordering context |
| Evidence | related WF/API/UI/AI/SEC IDs and immutable evidence reference |

## Compliance principles

Compliance는 checklist claim이 아니라 requirement → control → evidence → owner → review → exception/remediation trace다. Applicable law, contract, policy와 regulator scope는 legal review로 결정하며 Phase 9는 특정 jurisdiction compliance를 주장하지 않는다.

## Evidence and integrity

Audit Event와 history는 append-oriented이며 correction/supersession을 새 record로 남긴다. Access, export, retention, legal hold와 deletion도 audit 대상이다. Evidence integrity는 ordered write, restricted mutation, integrity verification, protected time/source와 backup/recovery control을 사용하며 exact mechanism은 구현 범위 밖이다.

## Traceability

Security Registry의 `SEC-*`는 WF/Entity/API/UI/AI와 owner/status를 연결한다. Privileged action은 applied control/policy version을 기록하고 future Book 10 test evidence와 연결한다. Orphan control, evidence 없는 exception 또는 unowned finding은 release blocking finding이다.

## Review and reporting

Security/Privacy Owner는 privileged access, export, failed authentication, publication, permission change, incident와 recovery evidence를 risk-based 주기로 검토한다. Reviewer가 자신의 privileged action만 단독 검토하지 않으며 metrics는 denominator/time window/data gaps를 표시한다.

## Compliance exception

Exception은 requirement, scope, data class, owner, rationale, risk, compensating control, approval, expiry와 remediation target을 가진다. Publication approval/no-bypass/credential protection 같은 constitutional control은 exception으로 우회할 수 없다.

