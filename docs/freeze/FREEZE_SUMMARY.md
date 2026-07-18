# Architecture Freeze Summary

| 항목 | 값 |
|---|---|
| Document ID | DOC-FREEZE-002 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| Freeze Date | 2026-07-15 |

## Architecture

AI MLS는 connector-isolated intake, modular core, auditable authority transitions와 human-controlled external use를 갖는 internal-first Property Intelligence Platform으로 동결한다. AI는 advisory capability이며 verification, permission 또는 publication approval 권한을 갖지 않는다.

## Business

MVP는 internal productivity, fragmented candidate normalization, client requirement matching과 verified sharing workflow에 집중한다. Cooperative broker network, marketplace와 broader monetization은 승인된 `POST-MVP` envelope이며 현재 baseline의 구현 약속이 아니다.

## Database

52개 logical entity와 provenance, authority state, history, retention/privacy boundary를 동결한다. Executable schema, migration, provider와 physical topology는 동결 범위에 포함하지 않으며 ADR-003은 `IN REVIEW`다.

## Workflow

`WF-001–012`가 discovery부터 intake, AI assistance, duplicate review, requirement/matching, verification/permission, proposal/publication, expiration/recovery까지의 canonical lifecycle이다. Workflow/authority/audit bypass는 허용하지 않는다.

## API

`API-001–019`는 logical capability contract다. Every write is authorized, state-validated, audited and workflow-mapped. OpenAPI 또는 executable endpoint specification은 v1.0 baseline에 없다.

## UI

`UI-001–037`은 role-aware logical screen registry다. Business state와 permission을 UI가 재정의하지 않으며 sensitive contact와 irreversible action은 명시적 control을 따른다.

## Security

`SEC-001–034`는 Zero Trust, least privilege, scoped authorization, privacy classification, encryption, audit, incident와 recovery control을 정의한다. Exact identity provider, legal basis와 quantitative parameter는 관련 open gate를 따른다.

## Operations

`OPS-001–032`는 environment, configuration, observability, backup/restore, disaster recovery, continuity, incident/change와 operational security obligations를 정의한다. Measured SLO/RPO/RTO와 exercise evidence는 release 전에 필요하다.

## Testing

`TEST-001–056`은 requirements, workflow, AI, security, performance, recovery, UAT와 release quality를 검증하는 logical registry다. Frozen trace는 test definition coverage이며 execution pass를 주장하지 않는다.

## Developer Bible

`DEV-001–024`는 repository, coding, naming, module, Git, review, Ready/Done, debt, documentation와 code-generation governance를 정의한다. Frozen standards는 구현 권한이 아니라 구현 시 준수할 constraint다.

## Roadmap

`SP-000–010`, `REL-001–005`, `IMP-001–024`가 dependency-aware delivery envelope를 제공한다. 모든 execution row는 `PLANNED`; dates, capacity, provider, tooling과 release acceptance는 future authorized work다.
