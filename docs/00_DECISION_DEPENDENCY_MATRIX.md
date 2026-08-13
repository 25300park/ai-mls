# Decision Dependency Matrix — Canonical Architecture Decisions

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-037 |
| 문서 버전 | v0.2 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-24 |
| Effective Version | Architecture v1.1 |

## Purpose

DEC-100–DEC-112와 DEC-114의 선행·후속 관계 및 scoped refinement를 정의하고 순환 의존성이 없는지 검증한다. Decision의 status와 내용은 [Decision Register](00_DECISION_REGISTER.md)가 authoritative source다.

## Dependency matrix

| Decision | Direct prerequisites | Transitive baseline | Direct consumers | Registry/API/Workflow impact | Supersession/refinement |
|---|---|---|---|---|---|
| DEC-100 | DEC-096–099 | DEC-096–099 | DEC-101–112 | Publication aggregate / API-014 / WF-010–012 | Refined by DEC-109/111; not superseded |
| DEC-101 | DEC-100 | DEC-100 | DEC-102–112 | Publication lifecycle / API-014 / WF-010–012 | Republish clause refined by DEC-111 |
| DEC-102 | DEC-100, DEC-101 | DEC-100–101 | DEC-103–112 | Publication Target / API-014/015/018/019 / WF-010–012 | None |
| DEC-103 | DEC-100–102 | DEC-100–102 | DEC-104–112 | Provider/Connector ownership / API-015/018/019 | None |
| DEC-104 | DEC-100–103 | DEC-100–103 | DEC-105–112 | API-014 / WF-010–012 | Correction/Republish clauses refined by DEC-109/111 |
| DEC-105 | DEC-100–104 | DEC-100–104 | DEC-106–112 | dispatch revalidation / API-013–015/018/019 | None |
| DEC-106 | DEC-100–105 | DEC-100–105 | DEC-107–112 | Security Registry / API-002/013–019 / WF-010–012 | None |
| DEC-107 | DEC-100–106 | DEC-100–106 | DEC-108–112 | command/Attempt/effect identity / API-014/018/019 | None |
| DEC-108 | DEC-100–107 | DEC-100–107 | DEC-109–112 | Reconciliation / API-014/018/019 / WF-012 | None |
| DEC-109 | DEC-100–108 | DEC-100–108 | DEC-110–112 | Correction/Successor / API-013/014/018/019 | Refines DEC-100/101/104 |
| DEC-110 | DEC-100–109 | DEC-100–109 | DEC-111–112 | Withdrawal / API-014/018/019 / WF-010–012 | None |
| DEC-111 | DEC-100–110 | DEC-100–110 | DEC-112 | Republish / API-013/014/018/019 | Refines DEC-100/101/104 |
| DEC-112 | DEC-100–111 | DEC-100–111 | None in this Brief | Projection/event/read model / API-014/018/019 | None |
| DEC-114 | DEC-053/076–079/082/084/092 | approved identity, authorization, audit, administration, security and post-freeze governance baseline | F16-PHASE-5 and later separately authorized FEAT-016 phases | FEAT-016 / API-015 / TRACE-016 / UI-006/036 | Clarifies partial execution and ownership; supersedes no prior Decision |

## Dependency order

```text
DEC-096–099
→ DEC-100
→ DEC-101
→ DEC-102
→ DEC-103
→ DEC-104
→ DEC-105
→ DEC-106
→ DEC-107
→ DEC-108
→ DEC-109
→ DEC-110
→ DEC-111
→ DEC-112

DEC-053/076–079/082/084/092
→ DEC-114
```

AO-023은 기존 Publication Approval governance인 DEC-096–099를 선행 기준으로 사용한다. 이후 각 Decision은 자신보다 작은 DEC 번호에만 의존한다. DEC-109/111의 refinement edge도 선행 Decision을 향한 정의 보완이며 선행 Decision이 후속 Decision의 prerequisite인 관계를 역전시키지 않는다.

## Validation rules

- Self dependency: 금지
- Backward dependency from prerequisite to consumer: 금지
- Circular dependency: 금지
- Missing prerequisite: 금지
- Scoped refinement를 full supersession으로 해석: 금지
- Registry mapping은 [Decision Trace Matrix](00_DECISION_TRACE_MATRIX.md)를 기준으로 검증

## Validation result

- Decision nodes: 14 aligned nodes plus referenced existing prerequisite nodes
- Direct dependency chain: complete
- Missing prerequisite: 0
- Circular dependency: 0
- Full supersession: 0
- Scoped refinement: DEC-109/111 → DEC-100/101/104
