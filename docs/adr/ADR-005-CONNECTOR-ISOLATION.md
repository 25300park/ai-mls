# ADR-005: Connector Isolation

| 항목 | 값 |
|---|---|
| Document ID | DOC-ADR-005 |
| Version | v1.0 |
| Status | FROZEN |
| Date | 2026-07-13 |
| Decision owner | Architecture Owner |
| Reviewers | Security Reviewer, Development Reviewer, Business Owner |
| Approval evidence | Phase 14 APPROVE recommendation; Phase 15 user authorization, 2026-07-15 |
| Supersedes | None |
| Superseded by | None |

## Context

Future connector는 외부 source 정책, credential, rate limit, 변동하는 content와 장애에 노출된다. 이를 core 또는 publication control과 결합하면 source 하나의 문제로 전체 시스템과 민감정보가 위험해진다.

## Decision

Connector는 core와 논리적·운영적 failure boundary를 갖고 scoped intake contract만 사용한다. connector별 credential, policy, checkpoint, health와 disable control을 분리하며 core store, private module, verification/publication state에 직접 접근하지 못한다.

## Alternatives Considered

| 대안 | 장점 | 단점 | 선택하지 않은 이유 |
|---|---|---|---|
| core 내부 직접 수집 | 초기 코드 경로 단순 | credential·장애·정책 결합 | core trust boundary 침식 |
| connector의 DB 직접 쓰기 | 높은 처리량 가능 | validation·audit·state gate 우회 | 금지된 authority escalation |
| isolated connector + intake | 독립 disable/retry와 provenance | contract·운영 관리 필요 | 제안안 |

## Consequences

### Positive

- source별 장애·정책 위반·credential 노출을 격리한다.
- 모든 입력이 동일한 candidate/verification 경로를 따른다.

### Negative / Trade-offs

- connector 운영, checkpoint, contract version과 reconciliation 복잡도가 증가한다.

### Migration and Reversibility

- MVP에서는 autonomous connector를 제외한다. POST-MVP 착수 전 source-specific CR와 security/legal review를 수행한다.

## Security Impact

- connector별 최소 권한 secret, egress 제한, rotation, abuse/rate control과 kill switch가 필요하다.

## Privacy Impact

- 허용되지 않은 personal/contact data 수집을 방지하고 provenance·retention·deletion 정책을 source별로 적용해야 한다.

## Operational and Cost Impact

- connector별 monitoring, maintenance, source change 대응과 격리 runtime 비용이 발생할 수 있다.

## Validation

- connector 비활성화 시 core 기능 유지, direct-write 차단, credential scope, duplicate intake와 checkpoint recovery를 검증한다.

## Open Decisions

- **OPEN DECISION:** 최초 허용 source, 법률/약관 review owner, connector hosting과 checkpoint contract.

## Related Documents

- [Context Architecture](../book-2/02_CONTEXT_ARCHITECTURE.md)
- [Integration Architecture](../book-2/07_INTEGRATION_ARCHITECTURE.md)
- [Failure Isolation](../book-2/08_FAILURE_ISOLATION.md)

## Status History

| 날짜 | 이전 상태 | 새 상태 | 근거/승인자 |
|---|---|---|---|
| 2026-07-13 | — | DRAFT | DEC-005 mandate를 A3 architecture로 구체화; formal review pending |

