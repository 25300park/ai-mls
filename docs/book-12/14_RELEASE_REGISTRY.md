# Release Registry

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-015 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Release Owner / Product Owner |
| 기준일 | 2026-07-15 |

> Phase 15 synchronization: `REL-001–005`는 [Canonical Traceability Matrix](../00_CANONICAL_TRACEABILITY_MATRIX.md)에 모두 연결되며, release execution/approval evidence가 없으므로 row status는 `PLANNED`로 유지한다.

## Purpose

logical release identity, included Epic/Feature/Sprint, approval와 status를 관리한다. Release row는 binary artifact, deployment, calendar commitment 또는 approval evidence가 아니다.

## Status

`PLANNED → READY → IN_REVIEW → APPROVED → RELEASED`를 기본으로 하며 `BLOCKED`, `SUSPENDED`, `SUPERSEDED`, `CANCELLED`를 사용할 수 있다. status 전환에는 [Release Acceptance](../book-10/12_RELEASE_ACCEPTANCE.md) evidence가 필요하다.

## Registry

| Release ID | Release | Epic | Feature | Sprint | Approval | Status |
|---|---|---|---|---|---|---|
| REL-001 | MVP internal baseline | EPIC-001–006/008/010 | FEAT-001–011/016–018/021–024 | SP-000–005 | PENDING — Business/Architecture/Security/Quality/Operations/User | PLANNED |
| REL-002 | Controlled Beta | EPIC-001–008/010 | FEAT-001–018/021–024 | SP-000–007 | PENDING — REL-001 + Publication/Privacy/Integration | PLANNED |
| REL-003 | Release Candidate | EPIC-001–008/010 | FEAT-001–018/021–024 | SP-008 | PENDING — full regression/UAT/security/AI/DR/migration | PLANNED |
| REL-004 | Production | EPIC-001–008/010 | FEAT-001–018/021–024 | SP-009 | PENDING — go-live board/user approval | PLANNED |
| REL-005 | Future expansion — POST-MVP | EPIC-001/009 | FEAT-019/020/024 | SP-010 | PENDING — new business/legal/source/privacy/architecture approval | PLANNED |

## No-orphan rule

각 release는 Epic, Feature, Sprint, tests, owner/approval와 checklist에 연결된다. included Feature가 없거나 approval/acceptance path가 없는 release ID는 발급하지 않는다.

## Cumulative rule

REL-002–004는 이전 accepted capability를 포함하고 fresh regression/approval을 요구한다. REL-005는 Production의 자동 후속이 아니며 별도 `POST-MVP` authorization이 필요하다.

## Governance

release scope 변경은 Implementation Registry, Sprint, risk, migration/cutover, release note와 CR/Decision을 갱신한다. superseded/cancelled row는 삭제하지 않는다.

## Post-freeze implementation progress metadata

Sprint 0은 release artifact나 deployment가 아니다. 아래 metadata는 `REL-001` foundation readiness만 추적하며 release status와 approval은 `PLANNED`/`PENDING`으로 유지한다.

| Release ID | Foundation Sprint | Readiness status | Release status | Evidence | Updated |
|---|---|---|---|---|---|
| REL-001 | SP-000 | COMPLETE | PLANNED | [Sprint 0 Completion](../development/SPRINT0_COMPLETION.md), [Sprint 0 Task Status](../development/SPRINT0_TASK_STATUS.md) | 2026-07-15 |
