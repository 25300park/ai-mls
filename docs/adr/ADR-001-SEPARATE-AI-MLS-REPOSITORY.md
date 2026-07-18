# ADR-001: Separate AI MLS Repository

| 항목 | 값 |
|---|---|
| Document ID | DOC-ADR-001 |
| Version | v1.0 |
| Status | FROZEN |
| Date | 2026-07-13 |
| Decision owner | Architecture Owner |
| Reviewers | Business Owner, Development Reviewer, Security Reviewer |
| Approval evidence | Phase 14 APPROVE recommendation; Phase 15 user authorization, 2026-07-15 |
| Supersedes | None |
| Superseded by | None |

## Context

AI MLS는 후보 발견·검증·matching·publication approval과 민감한 source/contact 처리를 포함한다. 기존 rbs-homes 등 외부 제품과 code ownership·release·credential·failure boundary가 섞이면 독립적인 governance와 rollback이 어려워진다.

## Decision

AI MLS application은 기존 제품 codebase와 분리된 repository를 기본 방향으로 제안한다. 통합은 명시적 versioned contract로 수행한다. 현재 workspace의 문서 구조가 실제 implementation repository 결정을 확정하지는 않는다.

## Alternatives Considered

| 대안 | 장점 | 단점 | 선택하지 않은 이유 |
|---|---|---|---|
| 기존 rbs-homes repository 내부 구현 | 초기 연결 단순 가능 | release, 권한, 장애, 소유권 결합 | AI MLS의 독립 governance와 failure isolation 약화 |
| monorepo 내 독립 workspace | 공통 tooling과 atomic change | 접근·배포 경계가 모호해질 수 있음 | 조직·CI 요건 미확인; 향후 재검토 가능 |
| 별도 repository | 명확한 ownership, access, release boundary | contract coordination과 중복 tooling 비용 | 제안안 |

## Consequences

### Positive

- AI MLS의 architecture, security review, release와 rollback 책임이 명확해진다.
- 외부 제품 credential과 dependency를 격리하기 쉽다.

### Negative / Trade-offs

- cross-repository contract/version 조정과 별도 CI·dependency 관리가 필요하다.

### Migration and Reversibility

- 구현 시작 전 repository owner와 integration contract를 승인한다. 운영 근거가 monorepo를 지지하면 새 ADR로 대체할 수 있다.

## Security Impact

- repository access와 secrets를 제품별 최소 권한으로 분리할 수 있다. 공급망·dependency review는 별도로 운영해야 한다.

## Privacy Impact

- contact/raw source 처리 code와 접근자를 격리할 수 있다. repository 분리 자체가 data isolation을 보장하지는 않는다.

## Operational and Cost Impact

- 별도 build, release, observability, on-call ownership 비용이 발생할 수 있다.

## Validation

- repository owner, CI/CD ownership, integration change workflow, secrets boundary, rollback 책임을 Architecture Review Board가 확인한다.

## Open Decisions

- **OPEN DECISION:** 실제 repository 위치, owner, branching/release 관계와 shared library 정책.

## Related Documents

- [System Overview](../book-2/01_SYSTEM_OVERVIEW.md)
- [Integration Architecture](../book-2/07_INTEGRATION_ARCHITECTURE.md)
- [Decision Register](../00_DECISION_REGISTER.md)

## Status History

| 날짜 | 이전 상태 | 새 상태 | 근거/승인자 |
|---|---|---|---|
| 2026-07-13 | — | DRAFT | A3 architecture proposal |

