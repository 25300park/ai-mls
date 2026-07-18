# ADR-006: Provider-independent AI Layer

| 항목 | 값 |
|---|---|
| Document ID | DOC-ADR-006 |
| Version | v1.0 |
| Status | FROZEN |
| Date | 2026-07-13 |
| Decision owner | Architecture Owner |
| Reviewers | AI Reviewer, Security Reviewer, Development Reviewer |
| Approval evidence | Phase 14 APPROVE recommendation; Phase 15 user authorization, 2026-07-15 |
| Supersedes | None |
| Superseded by | None |

## Context

AI parsing은 provider 기능·형식·정책·가격·가용성 변화에 노출되며 결과는 비결정적일 수 있다. provider SDK와 output을 core domain에 직접 결합하면 전환, 검증, privacy 통제가 어렵다.

## Decision

Core module은 provider-neutral AI intent와 validated advisory result boundary만 사용한다. provider adapter가 외부 형식을 변환하고 timeout, policy, usage, observability를 격리한다. AI 결과는 authoritative decision이나 publication approval이 아니다.

## Alternatives Considered

| 대안 | 장점 | 단점 | 선택하지 않은 이유 |
|---|---|---|---|
| provider SDK 직접 사용 | 초기 개발 단순 | lock-in, validation·privacy 분산 | core 결합이 큼 |
| 범용 abstraction만 사용 | provider 교체 용이 가능 | domain intent와 safety가 약할 수 있음 | business validation이 부족 |
| provider-neutral domain boundary + adapters | policy·검증·교체 통제 | adapter와 compatibility test 비용 | 제안안 |

## Consequences

### Positive

- provider 변경과 fallback을 domain 변경에서 분리한다.
- confidence, provenance, validation, usage와 privacy policy를 일관되게 적용한다.

### Negative / Trade-offs

- provider 고유 기능의 최소 공통분모화와 adapter 유지 비용이 생긴다.
- 동일 입력의 provider 간 결과 동등성은 보장되지 않는다.

### Migration and Reversibility

- provider별 adapter를 독립 교체하며 stored provenance에 provider/model/policy 맥락을 보존한다. 특정 기능이 필수면 별도 capability와 ADR로 확장한다.

## Security Impact

- secret 격리, egress control, prompt injection 대응, output validation, usage abuse 탐지가 필요하다.

## Privacy Impact

- 전송 최소화, masking, consent/retention, provider data-use 조건과 regional processing을 검토해야 한다.

## Operational and Cost Impact

- provider별 health, latency, error, quality, token/usage와 비용 관측이 필요하다. fallback은 비용과 결과 변화 위험이 있다.

## Validation

- contract tests, malformed/unsafe output rejection, timeout, provider swap, manual fallback과 no-direct-authority 규칙을 검증한다.

## Open Decisions

- **OPEN DECISION:** 초기 provider/model, quality baseline, allowed data classes, fallback policy, budget controls.

## Related Documents

- [System Overview](../book-2/01_SYSTEM_OVERVIEW.md)
- [Event and Job Architecture](../book-2/06_EVENT_AND_JOB_ARCHITECTURE.md)
- [AI Principles](../book-0/03_AI_PRINCIPLES.md)

## Status History

| 날짜 | 이전 상태 | 새 상태 | 근거/승인자 |
|---|---|---|---|
| 2026-07-13 | — | DRAFT | A3 architecture proposal |

