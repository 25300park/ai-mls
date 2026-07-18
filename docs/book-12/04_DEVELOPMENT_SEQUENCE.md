# Development Sequence

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-005 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Development Owner |
| 기준일 | 2026-07-15 |

## Canonical order

`Requirement → Epic → Feature → Developer Task → Test`

Implementation evidence chain에는 Workflow/Entity/API/Screen/AI, Sprint, Release와 Implementation ID가 함께 연결된다.

## Sequence

| Order | Outcome | Epic / Feature | DEV | Primary gate |
|---|---|---|---|---|
| 0 | governance, trace와 acceptance baseline | EPIC-001 / FEAT-024 | DEV-024 | TEST-056, Ready approval |
| 1 | identity, authorization, administration, audit와 cross-cutting control | EPIC-002/008 / FEAT-001–003/016/017/023 | DEV-001–003/016/017/023 | deny/SoD/security/audit tests |
| 2 | approved source, intake와 async foundation | EPIC-003/008 / FEAT-004/005/018 | DEV-004/005/018 | provenance, fallback, audit |
| 3 | property/candidate와 advisory AI | EPIC-004/006 / FEAT-006/007/022 | DEV-006/007/022 | human review, duplicate/AI evaluation |
| 4 | contact/client/requirement | EPIC-005 / FEAT-008–010 | DEV-008–010 | privacy, lifecycle, parser tests |
| 5 | matching와 role-aware UI | EPIC-006/010 / FEAT-011/021 | DEV-011/021 | eligibility, accessibility/UAT |
| 6 | verification와 permission | EPIC-007 / FEAT-012/013 | DEV-012/013 | separate human authority, expiry |
| 7 | proposal, approval와 publication | EPIC-007 / FEAT-014/015 | DEV-014/015 | exact version, idempotency, reconciliation |
| 8 | cumulative RC stabilization | all REL-002 Features | DEV-024 coordination | regression/UAT/security/performance/AI/DR |
| 9 | Production cutover and verification | all REL-003 accepted Features | DEV-024 coordination | go-live/rollback/post-deployment acceptance |
| 10 | conditional POST-MVP integration expansion | EPIC-009 / FEAT-019/020 | DEV-019/020 | new approval, isolation, source policy, recovery |

## Ordering rules

- downstream Sprint는 prerequisite acceptance가 PASS일 때만 Ready가 된다.
- UI shell은 앞설 수 있지만 privileged action은 owning API/workflow gate 전에 enable하지 않는다.
- AI provider integration은 deterministic validation/fallback와 human review 전에 enable하지 않는다.
- publication/connector/migration은 rollback/reconciliation rehearsal 후 진행한다.
- sequence change는 Dependency Matrix, risk, Sprint/Release Registry와 approval을 갱신한다.

## Parallelism

같은 order의 독립 Feature는 team capacity와 review availability가 확인될 때 병렬화할 수 있다. shared entity/contract, migration, security control 또는 test environment 충돌이 있으면 serialization한다.
