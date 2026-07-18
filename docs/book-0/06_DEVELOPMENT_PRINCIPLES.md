# Development Principles

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-032 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Development Reviewer |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](00_PROJECT_CONSTITUTION.md) |

## Documentation-first

production behavior를 만들기 전에 approved requirement, workflow, data/security impact와 acceptance criteria를 문서화한다. 문서 phase에서는 production feature code, executable migration 또는 final endpoint를 선행 구현하지 않는다.

## Architecture-first

- module responsibility, authority boundary, failure isolation과 integration contract를 구현 전에 승인한다.
- source code가 Constitution 또는 approved architecture와 충돌하면 code 관행이 아니라 architecture authority를 따른다.
- implementation detail이 architecture decision을 암묵적으로 만들지 않도록 review한다.

## ADR-driven changes

중요하거나 비가역적인 architecture change는 CR, alternatives/impact가 있는 ADR, Decision ID와 approval을 선행한다. approved/frozen decision을 code로 조용히 변경하지 않는다. 긴급 변경도 사후 등록/review와 expiry가 필요하다.

## Backward compatibility

- API/data/event/config와 user workflow의 compatibility impact를 변경 전에 분류한다.
- breaking change에는 version, migration, consumer communication, rollback과 data preservation plan이 필요하다.
- compatibility를 유지할 수 없으면 ADR와 major/minor release 판단을 남긴다.
- provenance, audit 또는 permission evidence를 잃는 migration은 허용하지 않는다.

## Coding standards policy

- [Naming Convention](../00_NAMING_CONVENTION.md)과 향후 Book 11 standard를 따른다.
- type safety, explicit validation, secure defaults와 clear error handling을 사용한다.
- credential, personal/contact data와 raw production content를 source/test fixture에 넣지 않는다.
- lint/format/static analysis 규칙을 repository에서 reproducible하게 실행한다.

이 section은 coding style 세부나 technology stack을 확정하지 않는다.

## Testing policy

- 모든 behavior change는 risk에 비례한 automated test와 acceptance evidence를 가진다.
- authorization, verification, permission, publication, provenance, audit, retention과 AI validation은 negative/bypass test를 포함한다.
- AI feature는 deterministic contract validation과 evaluation dataset/metric을 함께 사용한다.
- bug fix는 가능한 경우 regression test를 추가한다.
- failing critical test를 waiver 없이 release하지 않는다.

## Incremental delivery

- roadmap phase 하나씩 prerequisites와 bounded scope를 수행한다.
- 각 increment는 observable, reversible하고 independent validation이 가능해야 한다.
- incomplete capability는 feature flag/internal-only boundary와 status를 명확히 한다.
- phase completion report 후 다음 phase를 자동 시작하지 않는다.

## Quality over speed

schedule pressure는 verification, permission, security/privacy, provenance, audit 또는 test를 생략할 이유가 아니다. scope를 줄이거나 release를 defer할 수 있지만 constitutional control을 약화하지 않는다.

## Measurable development gates

| Gate | Minimum evidence |
|---|---|
| Before implementation | approved requirement/phase scope, affected Document/trace IDs, risk/security impact |
| Before merge | review, tests, static checks, migration/rollback note와 no-secret evidence |
| Before phase complete | acceptance criteria, test/validation output, known limitation와 completion report |
| Before release | [Definition of Done](08_DEFINITION_OF_DONE.md), release checklist와 no blocking finding |

## Constitutional bindings

`REQ-CONST-005`–`REQ-CONST-010`을 transparent, tested, least-authority implementation process로 구체화한다.

> **OPEN DECISION:** branch protection, required test commands, coverage thresholds와 compatibility support window는 Book 10/11에서 확정한다.
