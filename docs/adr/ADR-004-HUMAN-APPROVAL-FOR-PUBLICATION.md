# ADR-004: Human Approval for Publication

| 항목 | 값 |
|---|---|
| Document ID | DOC-ADR-004 |
| Version | v1.0 |
| Status | FROZEN |
| Date | 2026-07-13 |
| Decision owner | Business Owner |
| Reviewers | Architecture Owner, Security Reviewer, AI Reviewer |
| Approval evidence | Phase 14 APPROVE recommendation; Phase 15 user authorization, 2026-07-15 |
| Supersedes | None |
| Superseded by | None |

## Context

외부 게시와 고객 공유는 부정확한 매물, 만료 정보, 민감한 연락처 노출과 사업상 책임을 발생시킬 수 있다. Constitution은 AI가 추천할 수 있지만 사람의 검증과 permission 없이 외부 사용을 승인할 수 없다고 규정한다.

## Decision

외부 publication은 권한 있는 사람이 검증된 기록과 대상 scope를 명시적으로 승인해야 한다. Client-scoped sharing과 public publication은 서로 다른 permission으로 취급한다. AI, worker, connector, integration adapter는 승인자가 될 수 없다.

## Alternatives Considered

| 대안 | 장점 | 단점 | 선택하지 않은 이유 |
|---|---|---|---|
| 완전 자동 게시 | 처리 속도 | 오류·privacy·책임 위험 | Constitution 위반 |
| confidence threshold 자동 게시 | 일부 효율 | confidence가 사실·권한을 보장하지 않음 | human authority 대체 불가 |
| 명시적 사람 승인 | 책임·추적·scope 통제 | 추가 단계와 reviewer workload | 제안안 |

## Consequences

### Positive

- publication 책임, evidence, scope와 승인자를 추적할 수 있다.
- AI 오류나 connector 오염이 외부 게시로 곧바로 전파되지 않는다.

### Negative / Trade-offs

- 승인 queue와 역할 운영이 필요하며 처리 시간이 늘 수 있다.

### Migration and Reversibility

- 승인 gate는 모든 publication adapter 앞에 둔다. 완화는 Constitution 변경, security/business review와 새 ADR 없이는 불가하다.

## Security Impact

- approver role, separation of duties, revoked access, replay 방지와 immutable approval evidence가 필요하다.

## Privacy Impact

- 승인 화면은 대상별 노출 field와 contact consent를 보여주고 최소 공개를 기본으로 해야 한다.

## Operational and Cost Impact

- reviewer staffing, escalation, expiration/reverification, pending queue 관측 비용이 발생한다.

## Validation

- unauthorized actor, stale verification, revoked approval, duplicate delivery, channel scope mismatch가 모두 차단되는지 후속 test로 검증한다.

## Open Decisions

- **OPEN DECISION:** 역할별 approver 범위, two-person approval 필요 조건, 승인 유효기간과 긴급 절차.

## Related Documents

- [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md)
- [Data Flow Architecture](../book-2/05_DATA_FLOW_ARCHITECTURE.md)
- [Failure Isolation](../book-2/08_FAILURE_ISOLATION.md)

## Status History

| 날짜 | 이전 상태 | 새 상태 | 근거/승인자 |
|---|---|---|---|
| 2026-07-13 | — | DRAFT | DEC-002 mandate를 A3 architecture로 구체화; formal review pending |

