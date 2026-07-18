# Architecture Decisions

| 항목 | 값 |
|---|---|
| Document ID | DOC-ARCH-011 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

이 문서는 Book 2의 결정 요약이다. 아래 항목은 Architecture Review Board와 사용자 승인을 완료하지 않았으므로 모두 `DRAFT` 또는 `UNDER_REVIEW`이며 구현 의무가 아니다. 정식 상태는 [Decision Register](../00_DECISION_REGISTER.md)가 관리한다.

## ADR-backed decisions

| Decision | Reason | Impact | Status | Future review trigger |
|---|---|---|---|---|
| [ADR-001 Separate AI MLS Repository](../adr/ADR-001-SEPARATE-AI-MLS-REPOSITORY.md) | platform boundary와 release/ownership을 기존 제품에서 분리 | 별도 repository를 선호하되 integration contract 필요 | DRAFT / DEC-011 UNDER_REVIEW | repository ownership·CI·integration 방식 승인 |
| [ADR-002 Modular Monolith MVP](../adr/ADR-002-MODULAR-MONOLITH-MVP.md) | 초기 복잡도와 transaction boundary를 관리하면서 module discipline 유지 | core는 하나의 논리 application, worker 책임은 분리 가능 | DRAFT / DEC-012 UNDER_REVIEW | 독립 scale/failure/team 근거 발생 |
| [ADR-003 PostgreSQL Preferred](../adr/ADR-003-POSTGRESQL-PREFERRED.md) | transactional relational capability와 성숙한 운영 생태계 선호 | data architecture의 기본 후보이나 schema·provider 미확정 | DRAFT / DEC-013 UNDER_REVIEW | Phase 4 data requirements와 운영 제약 확인 |
| [ADR-004 Human Approval for Publication](../adr/ADR-004-HUMAN-APPROVAL-FOR-PUBLICATION.md) | 신뢰·privacy·책임과 Constitution의 human authority 보장 | AI/worker/connector가 publication을 직접 승인할 수 없음 | DRAFT / DEC-014 UNDER_REVIEW | 법률·사업 정책 변경; 완화는 Constitution 변경 필요 |
| [ADR-005 Connector Isolation](../adr/ADR-005-CONNECTOR-ISOLATION.md) | 외부 source·credential·rate·장애를 core와 격리 | scoped intake만 허용, 독립 disable/recovery 요구 | DRAFT / DEC-015 UNDER_REVIEW | connector 착수 또는 source policy 변경 |
| [ADR-006 Provider-independent AI Layer](../adr/ADR-006-PROVIDER-INDEPENDENT-AI-LAYER.md) | vendor lock-in·privacy·failure를 통제하고 AI authority 제한 | provider-neutral intent/result와 validation boundary 요구 | DRAFT / DEC-016 UNDER_REVIEW | 모델/provider 추가, data policy 변경 |

## Book 2 proposals awaiting dedicated ADR if materialized

| Proposal | Reason | Expected impact | Status | ADR trigger |
|---|---|---|---|---|
| Background jobs use durable logical queue semantics | 긴 작업과 retry를 요청 흐름에서 분리 | idempotency, recovery, observability 필요 | DRAFT | queue product/guarantee 선택 전 |
| Audit-first state transitions | 책임성과 재현성 보장 | 고위험 변경은 audit 불확실 시 fail closed | DRAFT | transaction/outbox 전략 결정 전 |
| One authoritative structured record path | 후보·검증·게시 의미 혼동 방지 | 외부·검색 view는 reconcile 가능한 파생 상태 | DRAFT | Book 3 data ownership 설계 시 |
| Service extraction is evidence-driven | 조기 분산 복잡도 회피 | scale/failure/security/team criteria를 충족해야 분리 | DRAFT | 최초 service extraction 제안 시 |

## Consequence summary

제안 구조는 수동 입력과 사람 검토를 항상 가능한 안전 경로로 남기고, AI와 외부 integration 실패를 core 기록에서 격리한다. 반면 승인 단계와 audit 의무는 처리 단계를 늘리며, 명확한 역할·운영 책임과 recovery tooling을 요구한다.

## Unresolved decisions

- 실제 repository 경계, 소유 team, release relationship
- Phase 4에서 확정할 data ownership, entity/state model, transaction boundary
- queue·scheduler의 요구 수준과 제품 선택
- rbs-homes 계약 존재 여부와 publication reconciliation 능력
- identity provider와 authorization policy 모델
- workload baseline, performance objective, recovery objective

이 항목들은 승인 없이 구체화하지 않으며 관련 Brief와 CR/ADR로 추적한다.
