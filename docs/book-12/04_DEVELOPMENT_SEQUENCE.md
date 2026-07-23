# Development Sequence

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-005 |
| 문서 버전 | v1.1 |
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
| 7 | Publication Approval Authority | EPIC-007 / FEAT-014 | DEV-014 | exact-version human approval, separation of duties |
| 8 | Publication execution ownership — `PENDING ARCHITECTURE OWNER DECISION` | EPIC-007 / FEAT-015 | DEV-015 | idempotency, reconciliation, external-effect recovery |
| 9 | cumulative RC stabilization, migration rehearsal와 cutover rehearsal | all REL-003 Features | DEV-024 coordination | regression/UAT/security/performance/AI/DR |
| 10 | conditional POST-MVP integration expansion | EPIC-009 / FEAT-019/020 | DEV-019/020 | new approval, isolation, source policy, recovery |

Production cutover와 post-deployment verification의 Sprint assignment는 `PENDING ARCHITECTURE OWNER DECISION`이다. AO-017은 기존 SP-008 RC stabilization scope만 SP-009로 이동하며 Production cutover의 새 Sprint를 지정하지 않는다.

## Ordering rules

- downstream Sprint는 prerequisite acceptance가 PASS일 때만 Ready가 된다.
- UI shell은 앞설 수 있지만 privileged action은 owning API/workflow gate 전에 enable하지 않는다.
- AI provider integration은 deterministic validation/fallback와 human review 전에 enable하지 않는다.
- publication/connector/migration은 rollback/reconciliation rehearsal 후 진행한다.
- sequence change는 Dependency Matrix, risk, Sprint/Release Registry와 approval을 갱신한다.

## Parallelism

같은 order의 독립 Feature는 team capacity와 review availability가 확인될 때 병렬화할 수 있다. shared entity/contract, migration, security control 또는 test environment 충돌이 있으면 serialization한다.
