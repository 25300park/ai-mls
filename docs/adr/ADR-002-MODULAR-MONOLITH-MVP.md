# ADR-002: Modular Monolith MVP

| 항목 | 값 |
|---|---|
| Document ID | DOC-ADR-002 |
| Version | v1.0 |
| Status | FROZEN |
| Date | 2026-07-13 |
| Decision owner | Architecture Owner |
| Reviewers | Development Reviewer, Database Reviewer, Security Reviewer |
| Approval evidence | Phase 14 APPROVE recommendation; Phase 15 user authorization, 2026-07-15 |
| Supersedes | None |
| Superseded by | None |

## Context

MVP는 internal workflow의 정확성, audit, 검증·게시 승인 경계를 먼저 입증해야 한다. 초기부터 다수 서비스를 운영하면 분산 consistency와 관측·배포 부담이 커지지만, 하나의 비구조적 application은 미래 분리를 어렵게 한다.

## Decision

Core Backend는 책임과 의존성이 명확한 modular monolith를 MVP 기본안으로 제안한다. 장시간 작업은 같은 application 규칙을 사용하는 분리 가능한 Background Worker 책임으로 처리한다. 물리 process 수와 deployment topology는 확정하지 않는다.

## Alternatives Considered

| 대안 | 장점 | 단점 | 선택하지 않은 이유 |
|---|---|---|---|
| 비구조적 monolith | 빠른 초기 작성 가능 | boundary 침식, 변경 영향 확대 | governance와 추출 가능성 부족 |
| microservices from start | 독립 scale/deploy 가능 | 분산 transaction, 운영·비용 복잡도 | 검증된 scale/team 경계 없음 |
| modular monolith | 단순한 transaction과 명시적 module 경계 | 규율과 architecture tests 필요 | 제안안 |

## Consequences

### Positive

- 일관된 authorization, audit, transaction 검토가 쉽고 초기 운영 surface가 작다.
- 실제 근거에 따라 module을 추출할 수 있다.

### Negative / Trade-offs

- module boundary를 지속적으로 검증하지 않으면 결합된 monolith로 퇴화할 수 있다.
- 일부 workload는 application 전체와 release cadence를 공유한다.

### Migration and Reversibility

- 공개 application boundary와 module ownership을 유지한다. 독립 scale·failure·security·team 근거가 생기면 ADR로 service extraction을 검토한다.

## Security Impact

- 중앙 authorization과 audit에 유리하지만 내부 module 우회 방지 규칙이 필요하다.

## Privacy Impact

- 민감정보 접근을 module policy로 일관되게 통제한다. 분리 부족으로 접근 surface가 넓어지지 않도록 최소 권한 검증이 필요하다.

## Operational and Cost Impact

- 초기 배포·관측 복잡도를 낮추지만 worker backlog와 module-level health 관측은 필요하다.

## Validation

- module dependency, publication gate bypass, worker의 application-rule 재사용을 architecture review와 후속 test로 검증한다.

## Open Decisions

- **OPEN DECISION:** Backend/Worker 물리 topology, module enforcement 방식, 최초 extraction threshold.

## Related Documents

- [Container Architecture](../book-2/03_CONTAINER_ARCHITECTURE.md)
- [Module Architecture](../book-2/04_MODULE_ARCHITECTURE.md)
- [Scalability Strategy](../book-2/09_SCALABILITY_STRATEGY.md)

## Status History

| 날짜 | 이전 상태 | 새 상태 | 근거/승인자 |
|---|---|---|---|
| 2026-07-13 | — | DRAFT | A3 architecture proposal |

