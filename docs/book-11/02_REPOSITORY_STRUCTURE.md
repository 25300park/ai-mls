# Repository Structure

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-003 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Development Reviewer / Architecture Owner |
| 기준일 | 2026-07-15 |

## Purpose

향후 구현 저장소의 logical responsibility zones를 정의한다. 아래 경로는 target convention이며 이번 Phase에서 directory, package 또는 scaffolding을 생성하지 않는다.

## Logical repository layout

| Zone | Logical path | 책임 | 금지 |
|---|---|---|---|
| Application | `apps/` | deployable web/API/worker entry point | domain rule 중복, direct cross-app data access |
| Domain modules | `modules/` | feature/domain policy와 use case | transport/vendor/UI coupling |
| Shared libraries | `packages/` | narrowly reusable contracts/utilities | business-domain dumping ground |
| Documentation | `docs/` | Architecture Bible, ADR, review와 phase evidence | generated binary/secret |
| Tests | `tests/` 또는 module-local test area | unit/integration/system/evaluation fixture | production personal data |
| Scripts | `scripts/` | approved reproducible maintenance/validation task | undocumented production mutation |
| Assets | `assets/` 또는 app-local assets | non-secret static asset | raw source/contact evidence |
| Configuration | `config/`와 environment injection | validated non-secret defaults/schema | credential commit, environment drift |
| Future services | `services/` | approved independently deployable boundary | premature service split |

## Ownership and placement

- 하나의 artifact에는 primary owner와 `DEV-*`가 있어야 한다.
- code는 가장 좁은 owning domain에 둔다. 재사용 가능성만으로 shared로 이동하지 않는다.
- generated artifact와 source-of-truth를 구분하고 생성 규칙/version을 기록한다.
- secret, production contact, raw listing content와 access token은 repository에 두지 않는다.

## Application boundary

Application entry point는 authentication, request/job context와 composition을 담당하지만 business authority를 소유하지 않는다. 승인, verification, permission, publication과 audit 규칙은 owning module을 통해서만 실행한다.

## Tests and scripts

Test location은 실행 level과 ownership을 명확히 하고 source artifact와 검색 가능하게 연결한다. Script는 dry-run, authorization, audit, idempotency와 rollback 요구를 문서화하며 ad-hoc bypass가 될 수 없다.

## Configuration

환경별 값은 code와 분리하고 schema validation, safe default, owner와 change evidence를 가진다. environment-specific secret value는 external secret mechanism으로 주입한다.

## Future services

독립 service는 scaling, trust boundary, availability 또는 ownership 근거와 ADR이 있을 때만 분리한다. `POST-MVP` connector/broker-network service는 승인 전 placeholder일 뿐이다.

> **OPEN DECISION:** Phase 13 이후 승인할 language/runtime, monorepo tooling, package manager와 exact physical root layout.
