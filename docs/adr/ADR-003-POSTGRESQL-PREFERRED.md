# ADR-003: PostgreSQL Preferred

| 항목 | 값 |
|---|---|
| Document ID | DOC-ADR-003 |
| Version | v0.1 |
| Status | IN REVIEW |
| Date | 2026-07-13 |
| Decision owner | Architecture Owner |
| Reviewers | Database Reviewer, Development Reviewer, Security Reviewer |
| Review evidence | Phase 14 KEEP OPEN; provider/operations evidence required |
| Supersedes | None |
| Superseded by | None |

## Context

AI MLS는 후보·검증·승인·audit 관계와 일관된 상태 전이를 필요로 한다. Book 2는 transactional relational capability가 적합하다고 보지만 Book 3 data architecture와 운영 환경은 아직 확정되지 않았다.

## Decision

Primary structured data store로 PostgreSQL을 우선 평가하는 기본 후보로 제안한다. 이는 제품·managed provider·extension·schema·topology 선택을 승인하는 결정이 아니다. Phase 4 요구사항과 proof of suitability를 통과해야 한다.

## Alternatives Considered

| 대안 | 장점 | 단점 | 선택하지 않은 이유 |
|---|---|---|---|
| PostgreSQL | 성숙한 transaction·constraint·query 생태계 | 전문 운영과 tuning 필요 | 제안안 |
| 다른 relational database | 기존 조직 역량 활용 가능 | 실제 제약·비용 미확인 | 운영 환경 확인 후 재평가 가능 |
| document/NoSQL primary | 유연한 shape와 일부 scale 특성 | 관계·상태 일관성 모델 부담 | 현재 authoritative workflow 우선순위와 부합 근거 부족 |

## Consequences

### Positive

- relational integrity, transaction, audit linkage 요구를 평가할 구체적 기준이 생긴다.

### Negative / Trade-offs

- PostgreSQL 역량과 운영 책임이 필요하며 특정 workload에 별도 read/search capability가 필요할 수 있다.

### Migration and Reversibility

- schema 구현 전에 Phase 4 capability matrix로 검증한다. 부적합하면 implementation data 없이 ADR을 대체할 수 있다.

## Security Impact

- role, encryption, backup access, audit configuration을 검토해야 하며 provider 기본값을 신뢰하지 않는다.

## Privacy Impact

- contact/raw reference의 접근, retention, deletion, export 통제가 data design에 반영되어야 한다.

## Operational and Cost Impact

- backup, recovery, upgrade, capacity, monitoring과 managed/self-managed 비용 비교가 필요하다.

## Validation

- Phase 4에서 integrity, transaction, provenance, search, retention, migration, recovery 요구를 평가하고 Database Reviewer 승인을 받는다.

## Open Decisions

- **OPEN DECISION:** hosting model, version, extension, high availability, backup/recovery objectives, data location.

## Related Documents

- [Container Architecture](../book-2/03_CONTAINER_ARCHITECTURE.md)
- [Scalability Strategy](../book-2/09_SCALABILITY_STRATEGY.md)
- [Book 1 Scope](../book-1/08_PRODUCT_SCOPE_AND_NON_GOALS.md)

## Status History

| 날짜 | 이전 상태 | 새 상태 | 근거/승인자 |
|---|---|---|---|
| 2026-07-13 | — | DRAFT | A3 preferred technology proposal |
