# Workflow Status Dictionary

| 항목 | 값 |
|---|---|
| Document ID | DOC-WF-014 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Business Owner |
| 기준일 | 2026-07-14 |

## Purpose and notation

Book 5에서 사용하는 business workflow status의 canonical 의미를 정의한다. 모든 상태는 `AGGREGATE.STATUS`로 기록한다. Entry/Exit는 [State Transition Rules](14_STATE_TRANSITION_RULES.md)의 허용 전이와 함께 적용하며, Owner는 업무 책임, Authority는 해당 전이를 승인·실행할 수 있는 권한이다. 모든 행은 상태 진입 이벤트, actor/job, 이전 상태, 사유, 시간 및 evidence reference를 감사 기록으로 요구한다.

## Discovery and intake

| Status | Meaning | Entry condition | Exit condition | Owner | Authority | Audit requirement |
|---|---|---|---|---|---|---|
| `DISCOVERY.IDENTIFIED` | source가 발견됨 | source reference 확보 | 정책 검토 시작 | Collector | Collector | source/time |
| `DISCOVERY.POLICY_REVIEW` | 수집 허용성 검토 중 | reviewer 지정 | 적격 또는 거절 결정 | Collector Lead | Policy reviewer | policy/version/reason |
| `DISCOVERY.INTAKE_ELIGIBLE` | intake 가능 | 허용·최소 증거 충족 | 요청 생성 | Collector Lead | Policy reviewer | decision/evidence |
| `DISCOVERY.INTAKE_REQUESTED` | intake 인계됨 | idempotent request 생성 | 캡처/거절 확인 | Collector | Collector Lead | request/correlation |
| `DISCOVERY.CAPTURED` | intake가 source를 수락 | intake reference 연결 | terminal | Collector | Intake owner | linked intake |
| `DISCOVERY.REJECTED` | 수집 또는 intake 불가 | 사유 확정 | 재발견 시 새 record | Collector Lead | Policy reviewer | rejection reason |
| `INTAKE.DRAFT` | 원문 기반 초안 | author/source 존재 | 검증 수행 | Collector | Collector | provenance/version |
| `INTAKE.VALIDATION_FAILED` | 필수 검증 실패 | validation errors 존재 | 수정 또는 거절 | Collector | Validator | error set |
| `INTAKE.QUARANTINED` | 안전/정책 확인 필요 | 위험 신호 | 해제 또는 거절 | Collector Lead | Policy/Security reviewer | risk/decision |
| `INTAKE.VALIDATED` | 최소 intake 규칙 통과 | validator 성공 | AI 요청 또는 직접 검토 | Collector | Validator | rule results |
| `INTAKE.AI_REQUESTED` | AI job 요청됨 | validated input 고정 | job 접수/실패 | Collector | Authorized operator | job/input checksum |
| `INTAKE.REVIEW_REQUIRED` | 사람 검토 대기 | AI 결과 또는 수동 draft 준비 | 수정/수락/거절 | Agent | Assigned reviewer | assignment/reason |
| `INTAKE.CORRECTED` | 사람이 정정한 버전 | correction evidence | 재검증 | Agent | Assigned reviewer | before/after/reason |
| `INTAKE.CANDIDATE_REGISTERED` | candidate draft 등록 완료 | reviewed draft 승인 | terminal; downstream 재검사 | Agent | Senior Agent | candidate/version/approval |
| `INTAKE.REJECTED` | intake 종료 | 부적격 결정 | 새 source는 새 intake | Collector Lead | Reviewer | reason/evidence |

## AI processing and duplicate review

| Status | Meaning | Entry condition | Exit condition | Owner | Authority | Audit requirement |
|---|---|---|---|---|---|---|
| `AI_JOB.QUEUED` | 실행 대기 | immutable input/model config | worker claim/cancel/expire | AI Operator | Authorized system | job/config/correlation |
| `AI_JOB.RUNNING` | 실행 중 | lease 획득 | 성공/실패/만료 | AI Operator | Worker lease | lease/attempt |
| `AI_JOB.SUCCEEDED` | output 생성 완료 | output persisted | terminal | AI Operator | Worker | model/output/checksum |
| `AI_JOB.FAILED` | 확인된 실행 실패 | error persisted | terminal; retry는 successor | AI Operator | Worker/operator | error/attempt |
| `AI_JOB.CANCELLED` | 권한 있는 취소 | cancel accepted | terminal | AI Operator | Job owner | actor/reason |
| `AI_JOB.EXPIRED` | lease/deadline 만료 | expiry rule | terminal; reconcile | AI Operator | Scheduler | deadline/evidence |
| `AI_RESULT.RECEIVED` | advisory output 수신 | successful/late result captured | validate/reject | AI Reviewer | System | source job/model |
| `AI_RESULT.VALIDATED` | 구조·provenance 검증 통과 | automated validation | review/correction/supersede | AI Reviewer | Validator | validation results |
| `AI_RESULT.REJECTED` | 사용할 수 없는 output | invalid/unsafe decision | terminal | AI Reviewer | Human reviewer | reason |
| `AI_RESULT.CORRECTED` | 사람이 수정한 advisory result | evidence-backed correction | 재검증 | AI Reviewer | Human reviewer | diff/evidence |
| `AI_RESULT.SUPERSEDED` | 후속 result가 대체 | successor linked | terminal | AI Reviewer | Human reviewer/system rule | successor/reason |
| `AI_REVIEW.REVIEW_QUEUED` | AI 결과 검토 대기 | validated result | 검토 시작 | AI Reviewer | Review coordinator | assignment |
| `AI_REVIEW.IN_REVIEW` | 사람이 검토 중 | reviewer claim | disposition | AI Reviewer | Assigned reviewer | reviewer/start |
| `AI_REVIEW.ACCEPTED_AS_DRAFT` | 초안으로만 수락 | 근거 검토 완료 | downstream business review | Agent | Human reviewer | decision/evidence |
| `AI_REVIEW.CORRECTED` | 검토 중 정정 | correction recorded | 재검증 | AI Reviewer | Human reviewer | diff/reason |
| `AI_REVIEW.REJECTED` | 결과 거절 | disposition 확정 | terminal | AI Reviewer | Human reviewer | reason |
| `AI_REVIEW.NEEDS_EVIDENCE` | 추가 근거 필요 | gap identified | 검토 재개/거절 | Agent | Human reviewer | missing evidence |
| `AI_REVIEW.ESCALATED` | 상위 판단 필요 | authority/risk conflict | authorized disposition | Architecture Owner | Reviewer/owner | escalation/decision |
| `AI_REVIEW.REVALIDATED` | 정정본 재검증 완료 | validation passed | draft 수락/거절 | AI Reviewer | Human reviewer | checks/version |
| `DUPLICATE.SUGGESTED` | 중복 후보 관계 제안 | comparison evidence | 검토 시작 | Data Steward | System/Agent | scores/references |
| `DUPLICATE.IN_REVIEW` | 사람이 비교 중 | reviewer assigned | disposition/evidence 요청 | Data Steward | Assigned reviewer | reviewer/evidence |
| `DUPLICATE.NEEDS_EVIDENCE` | 결정 근거 부족 | unresolved conflict | 검토 재개 | Data Steward | Reviewer | gap |
| `DUPLICATE.RESOLVED_LINK` | 별도 records를 관계로 연결 | link decision | reopen 가능 | Data Steward | Authorized reviewer | decision/links |
| `DUPLICATE.RESOLVED_MERGE` | canonical record로 병합 | merge plan 승인 | reopen/compensate 가능 | Data Steward | Senior reviewer | field lineage/approval |
| `DUPLICATE.RESOLVED_SEPARATE` | 다른 대상을 확정 | separate decision | reopen 가능 | Data Steward | Authorized reviewer | evidence/reason |
| `DUPLICATE.REOPENED` | 이전 결정을 재검토 | new evidence/impact | review 시작 | Data Steward | Senior reviewer | prior/new evidence |

## Requirement, matching, contact and authority

| Status | Meaning | Entry condition | Exit condition | Owner | Authority | Audit requirement |
|---|---|---|---|---|---|---|
| `REQUIREMENT.DRAFT` | 고객 요구 초안 | client/provenance identified | activate/withdraw | Agent | Agent | source/version |
| `REQUIREMENT.ACTIVE` | matching 가능 | required fields and client confirmation | pause/fulfill/withdraw/expire | Agent | Agent/Senior Agent | activation/criteria |
| `REQUIREMENT.PAUSED` | 일시 matching 중단 | pause reason | reactivate/withdraw/expire | Agent | Agent/Senior Agent | reason/time |
| `REQUIREMENT.FULFILLED` | 목적 달성 | outcome confirmed | terminal; new need=new version | Agent | Senior Agent | outcome/evidence |
| `REQUIREMENT.WITHDRAWN` | 고객/업무상 철회 | authority confirmed | terminal | Agent | Agent/Senior Agent | actor/reason |
| `REQUIREMENT.EXPIRED` | 유효기간 경과 | policy/time rule | terminal; renewal=new version | Agent | Scheduler/Agent | rule/time |
| `MATCH.REQUESTED` | match 요청됨 | active requirement | running/cancel via exception | Agent | Agent/System | inputs/version |
| `MATCH.RUNNING` | 계산 중 | job claimed | review/failure | AI/Matching Owner | Worker | algorithm/config |
| `MATCH.REVIEW_REQUIRED` | 결과 사람 검토 대기 | ranked output stored | reviewed/rejected | Agent | System | output/version |
| `MATCH.REVIEWED` | 사람이 근거 검토 완료 | review complete | accept/reject | Agent | Assigned reviewer | notes/evidence |
| `MATCH.ACCEPTED` | shortlist 용도로 수락 | reviewer decision | stale/supersede | Agent | Human reviewer | decision/items |
| `MATCH.REJECTED` | 결과 부적합 | reviewer decision | terminal | Agent | Human reviewer | reason |
| `MATCH.STALE` | 입력/권한/상태 변경으로 구식 | dependency change | supersede | Agent | System/Human reviewer | change trigger |
| `MATCH.SUPERSEDED` | 새 match가 대체 | successor linked | terminal | Agent | Agent/System | successor |
| `CONTACT_CASE.PENDING` | 연락 시도 준비 | permitted contact purpose | attempt/disposition | Agent | Agent | purpose/channel |
| `CONTACT_CASE.CONTACTED` | 상대와 접촉 | attempt succeeded | complete/follow-up | Agent | Agent | time/outcome |
| `CONTACT_CASE.NO_RESPONSE` | 응답 없음 | attempt window ended | retry/complete | Agent | Agent | attempts |
| `CONTACT_CASE.INVALID_CHANNEL` | 연락 수단 무효 | delivery evidence | alternate/complete | Agent | Agent | evidence |
| `CONTACT_CASE.DO_NOT_CONTACT` | 연락 금지 | explicit request/policy | terminal until new lawful authority | Business Owner | Agent/Policy reviewer | source/scope |
| `CONTACT_CASE.COMPLETED` | 연락 목적 종결 | outcome recorded | terminal | Agent | Agent | outcome |
| `VERIFICATION.REQUESTED` | 검증 요청 | subject/source known | review | Senior Agent | Agent | scope/requester |
| `VERIFICATION.IN_REVIEW` | 증거 검토 중 | reviewer assigned | verified/rejected/insufficient | Senior Agent | Assigned reviewer | evidence/reviewer |
| `VERIFICATION.VERIFIED` | 범위·기간 한정 검증 완료 | human decision | expiring/expired/revoked | Senior Agent | Authorized verifier | scope/evidence/validity |
| `VERIFICATION.REJECTED` | 주장이 틀림/부적격 | decision | terminal/new request | Senior Agent | Authorized verifier | reason |
| `VERIFICATION.INSUFFICIENT` | 증거 부족 | gap confirmed | new evidence/reject | Senior Agent | Authorized verifier | missing evidence |
| `VERIFICATION.EXPIRING` | 만료 임박 | threshold reached | reverified/expired/revoked | Senior Agent | Scheduler | policy/time |
| `VERIFICATION.EXPIRED` | 유효기간 종료 | deadline reached | terminal; new verification | Senior Agent | Scheduler | time/rule |
| `VERIFICATION.REVOKED` | 유효성 철회 | contradictory evidence/authority | terminal; new verification | Senior Agent | Authorized verifier | reason/impact |
| `PERMISSION.DRAFT` | 권한 요청 초안 | grantor/scope known | review | Business Owner | Agent | grantor/scope |
| `PERMISSION.UNDER_REVIEW` | 권한 증거 검토 | reviewer assigned | active/reject | Business Owner | Authorized reviewer | evidence |
| `PERMISSION.ACTIVE` | 범위·기간 한정 권한 유효 | explicit grant validated | expire/revoke/supersede | Business Owner | Authorized reviewer | grant/scope/validity |
| `PERMISSION.REJECTED` | 권한 부여 안 됨 | decision | terminal/new request | Business Owner | Authorized reviewer | reason |
| `PERMISSION.EXPIRED` | 권한 기간 종료 | deadline reached | terminal/new permission | Business Owner | Scheduler | time/rule |
| `PERMISSION.REVOKED` | grantor/authority가 철회 | revocation verified | terminal/new permission | Business Owner | Authorized reviewer | source/time/impact |
| `PERMISSION.SUPERSEDED` | 새 권한 버전이 대체 | successor active | terminal | Business Owner | Authorized reviewer | successor |

## Proposal, publication and reverification

| Status | Meaning | Entry condition | Exit condition | Owner | Authority | Audit requirement |
|---|---|---|---|---|---|---|
| `PROPOSAL.DRAFT` | 고객 제안 초안 | accepted match/version selected | review | Agent | Agent | inputs/version |
| `PROPOSAL.REVIEW_PENDING` | 공유 전 검토 | prechecks passed | approve/revise/expire | Senior Agent | Agent | check results |
| `PROPOSAL.APPROVED_TO_SHARE` | 지정 고객 공유 승인 | human approval | shared/withdrawn/expired | Senior Agent | Senior Agent | approver/scope/version |
| `PROPOSAL.SHARED` | 승인본 공유 완료 | target/channel confirmation | feedback/withdraw/expire | Agent | Agent | audience/channel/time |
| `PROPOSAL.FEEDBACK_RECEIVED` | 고객 피드백 기록 | feedback captured | revise/close via withdrawal | Agent | Agent | original feedback |
| `PROPOSAL.REVISION_REQUIRED` | 수정 필요 | reviewer/feedback/dependency change | new draft | Agent | Senior Agent/Agent | reason/affected fields |
| `PROPOSAL.WITHDRAWN` | 제안 사용 중단 | withdrawal decision | terminal; new version | Agent | Senior Agent | reason/notice |
| `PROPOSAL.EXPIRED` | 제안 유효기간 종료 | time/dependency rule | terminal; new version | Agent | Scheduler | rule/time |
| `PUBLICATION_APPROVAL.REQUESTED` | 게시 승인 요청 | exact representation and prerequisites | review/reject | Business Owner | Requester | snapshot/scope |
| `PUBLICATION_APPROVAL.UNDER_REVIEW` | 독립 검토 중 | approver assigned | approve/reject | Business Owner | Assigned approver | reviewer/checks |
| `PUBLICATION_APPROVAL.APPROVED` | 버전·대상 한정 승인 | human decision | expire/revoke/use | Business Owner | Authorized approver | decision/scope |
| `PUBLICATION_APPROVAL.REJECTED` | 승인 거절 | decision | terminal/new request | Business Owner | Authorized approver | reason |
| `PUBLICATION_APPROVAL.REVOKED` | 승인이 철회됨 | authority/dependency change | terminal/new request | Business Owner | Authorized approver | reason/impact |
| `PUBLICATION_APPROVAL.EXPIRED` | 승인 유효기간 종료 | deadline reached | terminal/new request | Business Owner | Scheduler | time/rule |
| `PUBLICATION.DRAFT_REPRESENTATION` | 게시 표현 초안 | source/provenance fixed | approval pending | Publisher | Author | version/checksum |
| `PUBLICATION.APPROVAL_PENDING` | 승인 대기 | request linked | approved/revise | Publisher | Requester | approval request |
| `PUBLICATION.APPROVED` | delivery 가능 승인본 | approval current | delivery/correction/revocation | Publisher | Human approver | approval/version |
| `PUBLICATION.DELIVERY_PENDING` | 외부 전달/확인 중 | preflight passed | published/unknown/failed | Publisher | Authorized operator | operation/idempotency |
| `PUBLICATION.PUBLISHED` | 외부 exact version 확인 | provider/reconciliation evidence | suspend/correct/withdraw | Publisher | Connector + reconciler | external ID/evidence |
| `PUBLICATION.UNKNOWN` | 외부 결과 불명 | ambiguous outcome | published/failed after reconcile | Publisher | Reconciler | attempts/evidence |
| `PUBLICATION.FAILED` | 전달 실패 확인 | negative evidence | correction/new approved attempt | Publisher | Connector/reconciler | error/evidence |
| `PUBLICATION.SUSPENDED` | 노출/작업을 보수적으로 hold | policy/freshness/safety trigger | correct/withdraw/new approval | Business Owner | Authorized reviewer | trigger/external caveat |
| `PUBLICATION.CORRECTION_PENDING` | 정정본 준비 필요 | issue confirmed | new draft | Publisher | Business Owner | issue/affected audience |
| `PUBLICATION.WITHDRAWAL_PENDING` | 외부 철회 확인 중 | approved withdrawal | withdrawn/unknown/failed | Publisher | Authorized operator | operation/approval |
| `PUBLICATION.WITHDRAWN` | 외부 제거 확인 | provider/reconciliation evidence | terminal; republish=new cycle | Publisher | Reconciler | external evidence |
| `REVERIFICATION.SCHEDULED` | 재검증 예정 | expiry policy | reminder/cancel | Senior Agent | Scheduler | subject/due |
| `REVERIFICATION.REMINDER_DUE` | 알림 기한 도래 | due time | sent/failed | Senior Agent | Scheduler | due/recipient |
| `REVERIFICATION.REMINDER_SENT` | 알림 발송됨 | channel accepted | in progress/fail/cancel | Senior Agent | Scheduler/Agent | channel/time |
| `REVERIFICATION.IN_PROGRESS` | 사람이 재검증 중 | owner claim | complete/fail/cancel | Senior Agent | Assigned verifier | evidence/actions |
| `REVERIFICATION.COMPLETED` | 새 검증 결과 생성 | new record decision | terminal | Senior Agent | Authorized verifier | successor record |
| `REVERIFICATION.FAILED` | 알림/검증 실패 | failure evidence | terminal; successor task | Senior Agent | Agent/System | error/reason |
| `REVERIFICATION.CANCELLED` | 작업 불필요/취소 | authority and reason | terminal | Senior Agent | Task owner | actor/reason |

## Exceptions

| Status | Meaning | Entry condition | Exit condition | Owner | Authority | Audit requirement |
|---|---|---|---|---|---|---|
| `EXCEPTION.OPEN` | 실패가 격리되어 열림 | failure/conflict detected | triage | Workflow Owner | Detector/system | source/evidence |
| `EXCEPTION.TRIAGED` | 영향·소유자·경로 분류 | triage complete | retry/manual/escalate | Workflow Owner | Triage owner | severity/owner |
| `EXCEPTION.RETRY_SCHEDULED` | 안전한 재시도 예정 | retryability proven | recovered/manual action | Technical Owner | Authorized operator | policy/attempt/key |
| `EXCEPTION.MANUAL_ACTION_REQUIRED` | 사람 판단/조치 필요 | automation unsafe | recovered/escalated | Business Owner | Triage owner | assignment/action |
| `EXCEPTION.ESCALATED` | 상위 권한 판단 필요 | impact/conflict threshold | recovered/accepted risk | Architecture Owner | Workflow owner | escalation chain |
| `EXCEPTION.RECOVERED` | 의도 상태 회복 확인 | canonical/external verification | close | Workflow Owner | Authorized verifier | recovery evidence |
| `EXCEPTION.ACCEPTED_RISK` | 잔여 위험을 권한자가 수락 | no safe full recovery | close/reopen at review | Architecture Owner | Named authority | rationale/scope/expiry |
| `EXCEPTION.CLOSED` | 영향 검토 후 종결 | recovery/risk evidence complete | archive/reopen if new evidence | Workflow Owner | Workflow owner | closure review |
| `EXCEPTION.ARCHIVED` | 보존 정책에 따라 비활성 보관 | closed and retention eligible | terminal | Governance Owner | Records custodian | archive reference |

## Audit evidence lifecycle

| Status | Meaning | Entry condition | Exit condition | Owner | Authority | Audit requirement |
|---|---|---|---|---|---|---|
| `AUDIT_EVENT.APPENDED` | 원본 audit evidence가 append됨 | important action/outcome captured | correction annotation/archive/policy disposition | Security/Governance Owner | Authorized audit writer | event/actor/action/target/time/outcome/trace |
| `AUDIT_EVENT.CORRECTED` | 원본을 보존한 correction successor/annotation | correction reason and original event link | archive/policy disposition | Security/Governance Owner | Authorized audit custodian | original/correction/reason/actor |
| `AUDIT_EVENT.ARCHIVED` | active query tier에서 governed archive로 이동 | retention/archive rule and integrity evidence | policy disposition only | Security/Governance Owner | Records custodian | archive manifest/location/checksum |
| `AUDIT_EVENT.DELETED_BY_POLICY` | approved retention/privacy disposition 완료 | policy, legal-hold check and disposition evidence | terminal | Data/Privacy Owner | Authorized retention executor | policy/version/approver/job/outcome |

Audit correction은 원본 event를 덮어쓰지 않는다. `DELETED_BY_POLICY`는 일반 API delete가 아니라 approved retention workflow의 terminal evidence다.

## Global rules

- Terminal은 이력 삭제를 뜻하지 않는다. 새 증거는 successor record 또는 명시적 reopen 전이를 사용한다.
- 자동 상태 변경은 시간·정책처럼 사전에 승인된 제한 전이에만 허용되며 authority를 생성·연장하지 않는다.
- 같은 단어라도 aggregate가 다르면 의미와 권한이 다르다. 문맥 없는 `APPROVED`, `FAILED`, `EXPIRED` 사용은 금지한다.
- 상태와 display label을 분리한다. 번역이나 UI 문구는 canonical status를 변경하지 않는다.

## Authority and eligibility terms that are not statuses

| Term | Canonical meaning | Status relationship |
|---|---|---|
| `CANDIDATE` | Candidate Listing/Offer의 검증 전 internal authority class | 독립 workflow status가 아니며 Candidate entity lifecycle과 provenance로 판단 |
| `VERIFIED` | exact subject/scope/version에 유효한 human verification authority class | `VERIFICATION.VERIFIED`가 현재 유효할 때만 성립 |
| `CLIENT_SHAREABLE` | valid Verification + active `CLIENT_SHARING` Permission + audience/scope checks를 모두 만족하는 derived eligibility predicate | persisted status가 아니며 share 시점에 재계산 |
| `PUBLISHED` | exact representation이 외부 target에서 확인된 exposure class | `PUBLICATION.PUBLISHED`만 해당; Verification/Approval/delivery acceptance와 다름 |
| `AI requestedResultClass=INTERNAL_CANDIDATE` | AI-006 search intent의 requested result filter | `CANDIDATE` authority를 부여하지 않으며 API가 canonical eligibility를 검사 |
| `AI requestedResultClass=CLIENT_ELIGIBLE` | AI-006이 요청한 client-use candidate result class | `CLIENT_SHAREABLE`의 synonym status가 아니며 API/workflow가 derived eligibility를 재검사 |
| `AI requestedResultClass=PUBLISHED` | AI-006이 요청한 published search projection | AI가 publication state를 결정하지 않으며 `PUBLICATION.PUBLISHED`를 canonical 조회 |

따라서 `CANDIDATE`, `VERIFIED`, `CLIENT_SHAREABLE`, `PUBLISHED`는 서로 대체 가능한 상태가 아니며, bare term을 state transition value로 저장하지 않는다.
