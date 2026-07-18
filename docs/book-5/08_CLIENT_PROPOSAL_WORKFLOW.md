# Client Proposal Workflow

| 항목 | 값 |
|---|---|
| Document ID | DOC-WF-009 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner / Senior Agent |
| 기준일 | 2026-07-14 |
| Workflow ID | WF-008 |

## Purpose

검토된 매칭 결과를 특정 고객에게만 공유할 수 있는 제안서로 만들고, 사람의 검토·승인·공유·피드백·개정을 추적한다. 고객 제안은 공개 게시가 아니며 `CLIENT_SHARING` 권한을 `PUBLIC_PUBLICATION` 권한으로 확대하지 않는다.

## Entry conditions

- 활성 Requirement와 현재 버전의 `MATCH.ACCEPTED` 결과가 존재한다.
- 제안 시점에 Candidate/Offer, Verification, Permission의 유효성을 다시 확인한다.
- Permission의 audience/scope가 해당 고객 공유를 허용한다.
- 공유할 표현 버전과 출처, 가격·가용성 기준 시점이 식별된다.

## Workflow

1. Agent가 수락된 매치에서 표현 버전을 선택해 `PROPOSAL.DRAFT`를 만든다.
2. 시스템은 Verification/Permission/Requirement 적합성, 민감정보 노출, 최신성을 검사한다.
3. Senior Agent가 사실 정확성, 고객 적합성, 연락처 마스킹, 면책·만료 표시를 검토한다.
4. 승인하면 `APPROVED_TO_SHARE`, 거절 또는 보완이면 `REVISION_REQUIRED`가 된다.
5. 승인된 동일 버전만 지정 고객·채널에 공유하고 `SHARED` 이벤트를 남긴다.
6. 고객 피드백은 원문과 해석을 분리해 기록하며 Requirement 갱신, 재검증 또는 제안 개정을 유발할 수 있다.
7. 변경된 표현은 새 버전으로 다시 검토하며 이전 승인을 승계하지 않는다.

## States and authority

`PROPOSAL.DRAFT → REVIEW_PENDING → APPROVED_TO_SHARE → SHARED → FEEDBACK_RECEIVED`

`REVIEW_PENDING → REVISION_REQUIRED → DRAFT`, 또는 어느 유효 상태에서든 권한·최신성 상실 시 `EXPIRED`/`WITHDRAWN`으로 전환한다. Author는 초안과 개정을, Senior Agent는 공유 승인을, Agent는 승인 버전의 실제 공유를 수행한다.

## Audit and exceptions

Proposal ID/version, Requirement·Match·Candidate·Offer 참조, 검사 결과, 승인자와 사유, 공유 대상/채널/시각, 피드백, 철회·만료를 보존한다. 권한 충돌, 검증 만료, 고객 오지정 또는 전송 상태 불명은 공유를 중단하고 [Exception and Recovery](12_EXCEPTION_AND_RECOVERY_WORKFLOW.md)로 보낸다. 이미 공유된 오류는 삭제로 숨기지 않고 정정 통지와 새 버전으로 회복한다.

## Related documents

- [Matching Workflow](06_MATCHING_WORKFLOW.md)
- [Contact and Verification Workflow](07_CONTACT_AND_VERIFICATION_WORKFLOW.md)
- [Status Dictionary](13_STATUS_DICTIONARY.md)
- [State Transition Rules](14_STATE_TRANSITION_RULES.md)

