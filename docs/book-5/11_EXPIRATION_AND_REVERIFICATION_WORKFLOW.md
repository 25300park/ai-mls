# Expiration and Reverification Workflow

| 항목 | 값 |
|---|---|
| Document ID | DOC-WF-012 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner / Senior Agent |
| 기준일 | 2026-07-14 |
| Workflow ID | WF-011 |

## Purpose

시간·정책·증거 변경에 따라 Verification, Permission, Proposal 및 Publication의 적격성을 제한하고, 알림과 사람 재검증을 통해 안전하게 회복한다.

## Expiration detection

스케줄 또는 이벤트 기반 검사는 canonical `valid_from`, `valid_until`, revocation, source change와 정책을 평가한다. 임박 시 `VERIFICATION.EXPIRING`과 `REVERIFICATION.REMINDER_DUE`, 기한 경과 시 `VERIFICATION.EXPIRED` 또는 `PERMISSION.EXPIRED`를 기록한다. 자동화는 상태를 제한하고 작업을 생성할 수 있지만 유효기간 연장, 승인, 게시 또는 철회 완료를 대신할 수 없다.

## Reminder and reverification

1. `REVERIFICATION.SCHEDULED`에서 담당자와 due time을 지정한다.
2. due 시 알림을 보내 `REMINDER_SENT`; 실패하면 `FAILED`와 Exception을 연다.
3. 담당자가 최신 source/contact를 확인하면 `IN_PROGRESS`다.
4. 새 증거로 새 Verification과 필요한 새 Permission을 검토한다.
5. 성공 시 reverification은 `COMPLETED`; 기존 만료 레코드는 그대로 보존한다.
6. 증거 부족/거절은 `FAILED`, 대상 소멸 또는 중복 작업은 사유와 함께 `CANCELLED`다.

## Automatic downstream action

만료·취소 신호는 새 Match/Proposal/Approval/Delivery 적격성을 즉시 차단하고 진행 중 항목을 stale, expired, suspended 또는 withdrawal review 대상으로 보낸다. 이미 외부 공개된 항목은 삭제되었다고 가정하지 않고 [Publication Workflow](10_PUBLICATION_WORKFLOW.md)에서 확인 가능한 철회를 수행한다.

## Manual recovery

Agent가 source freshness, availability, owner authority와 permission scope를 다시 확인한다. 성공은 새 검증/권한 버전을 만들고 영향받은 downstream artifact를 재검토할 수 있게 할 뿐, 이전 Proposal/Approval/Publication을 자동 활성화하지 않는다. 실패 후 재시작은 새 또는 명시적 successor reverification task로 추적한다.

## Audit and exceptions

대상, 정책 버전, 계산 시각, 알림 수신자/채널, 시도·실패, 증거, reviewer, 새 레코드 계보, downstream impact와 수동 override를 기록한다. clock 오류, 알림 실패, 동시 갱신, source 상충은 [Exception and Recovery](12_EXCEPTION_AND_RECOVERY_WORKFLOW.md)로 보낸다.

## Related documents

- [Contact and Verification](07_CONTACT_AND_VERIFICATION_WORKFLOW.md)
- [Publication Workflow](10_PUBLICATION_WORKFLOW.md)
- [Status Dictionary](13_STATUS_DICTIONARY.md)
- [State Transition Rules](14_STATE_TRANSITION_RULES.md)

