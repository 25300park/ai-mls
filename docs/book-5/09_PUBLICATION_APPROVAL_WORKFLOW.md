# Publication Approval Workflow

| 항목 | 값 |
|---|---|
| Document ID | DOC-WF-010 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Business Owner |
| 기준일 | 2026-07-14 |
| Workflow ID | WF-009 |

## Purpose

외부 게시 대상, 표현 버전 및 권한 범위를 고정하고 명시적 사람 승인 후에만 게시 명령을 허용한다. 승인은 게시 성공을 의미하지 않으며 AI 검토, Verification 또는 Permission으로 대체할 수 없다.

## Approval request

요청은 Publication Approval ID, 정확한 representation version, target/channel, 공개 필드, Candidate/Offer, 유효한 `VERIFICATION.VERIFIED`, 활성 `PUBLIC_PUBLICATION` Permission, provenance, 개인정보 검사 결과를 포함한다. 누락 또는 상충이 있으면 요청 자체를 승인 대기열에 올리지 않는다.

## Review and decision

1. Requester가 `PUBLICATION_APPROVAL.REQUESTED`를 제출한다.
2. 지정 Approver가 독립적으로 검토를 인수해 `UNDER_REVIEW`로 전환한다.
3. Approver는 사실·최신성·권한·대상·표현 버전·민감정보·정책 적합성을 확인한다.
4. 모든 조건 충족 시 정확한 버전과 대상에 한해 `APPROVED`; 그렇지 않으면 이유와 함께 `REJECTED`한다.
5. 승인 후 representation, target, Permission 또는 Verification이 바뀌면 승인은 `REVOKED` 또는 `EXPIRED`되고 새 요청이 필요하다.

## Authority and no bypass

Requester/Author는 요청할 수 있지만 승인 권한은 별도 Approver에게 있다. 자기 승인 금지와 2인 승인 적용 범위는 governance에서 확정될 **OPEN DECISION**이며, 확정 전에는 Architecture Owner가 지정한 독립 Approver를 사용한다. Connector, worker, AI 및 Administrator의 기술 권한은 business approval 권한이 아니다.

## Rejection and rollback

거절 요청은 수정된 새 representation version으로 재제출한다. 승인 철회는 이력 삭제가 아니라 후속 delivery 차단, 진행 중 작업 취소 요청 및 이미 게시된 대상의 정정/철회 시작을 의미한다. `APPROVED`에서 `PUBLISHED`로 직접 전이하지 않으며 [Publication Workflow](10_PUBLICATION_WORKFLOW.md)의 delivery와 reconciliation이 필요하다.

## Audit

요청자, 검토자, 결정자, 역할/위임 근거, 입력 스냅샷, 검사 결과, 결정·사유·시각, 승인 범위, 만료, 철회와 후속 작업을 기록한다.

## Related documents

- [Approval Workflow](../00_APPROVAL_WORKFLOW.md)
- [Contact and Verification Workflow](07_CONTACT_AND_VERIFICATION_WORKFLOW.md)
- [Publication Workflow](10_PUBLICATION_WORKFLOW.md)
- [State Transition Rules](14_STATE_TRANSITION_RULES.md)

