# MAOS Phase 1.3 Repository Bootstrap Design

| 항목 | 값 |
|---|---|
| Document ID | MAOS-P13-001 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | System Development Team |
| 기준일 | 2026-08-16 |

## Objective

기존 pnpm monorepo와 AI MLS Business Code를 보존하면서 MAOS System Development Team MVP가 사용할 TypeScript strict-mode Modular Monolith Bootstrap Foundation을 별도 namespace에 추가한다.

## Selected approach

MAOS source는 top-level `maos/` namespace에 격리한다. `pnpm-workspace.yaml`에 `maos/apps/*`, `maos/modules/*`, `maos/packages/*`를 추가하고 기존 `apps/*`, `modules/*`, `packages/*` workspace와 source를 유지한다. Root 명령은 기존 `pnpm` script와 TypeScript build를 확장해 AI MLS와 MAOS 양쪽을 검증한다.

대안으로 기존 root `apps/`, `modules/`, `packages/`에 MAOS artifact를 혼합하는 방식은 baseline 소유권이 불명확해지므로 선택하지 않는다. 기존 구조를 이동하거나 npm workspace로 전환하는 방식은 사용자 지시와 보존 원칙에 위배되어 선택하지 않는다.

## Repository layout

```text
maos/
  apps/
    web/
    api/
    worker/
  modules/
    core/
    identity/
    work/
    ai/
    execution/
    governance/
    knowledge/
    integration/
    audit/
    quality/
    delivery/
    operations/
  packages/
    contracts/
    config/
    observability/
    shared/
  skills/
  migrations/
  tests/
    unit/
    integration/
    contract/
    e2e/
```

Repository 공용 `docs/architecture`, `docs/adr`, `docs/api`, `docs/runbooks`, `scripts`는 기존 위치를 보존한다. MAOS Architecture 문서는 `docs/maos/architecture`에서만 관리한다. 빈 디렉터리는 목적을 설명하는 `README.md`로 version control에 포함한다.

## Application foundation

- `maos/apps/web`, `maos/apps/api`, `maos/apps/worker`는 각각 독립 `package.json`과 `tsconfig.json`을 가진 pnpm workspace package다.
- 세 app은 TypeScript project reference로 개별 build 가능하며 root build에도 포함된다.
- Web과 Worker는 실행 가능한 최소 entry point만 제공하고 UI, queue, Agent Runtime 또는 business workflow를 구현하지 않는다.
- API는 repository에 별도 HTTP framework가 없으므로 Node 내장 HTTP를 사용한다. 기존 AI MLS API adapter와 admin-console server는 수정하지 않는다.
- API는 `GET /health`, `GET /health/live`, `GET /health/ready`만 제공한다. readiness는 이 Phase에서 외부 dependency가 없으므로 process readiness만 반환한다.

## Request context and logging

- inbound `x-request-id`와 `x-correlation-id`가 유효한 제한 길이의 식별자이면 보존하고, 없거나 유효하지 않으면 `crypto.randomUUID()`로 생성한다.
- 응답은 두 식별자를 header에 포함한다.
- middleware skeleton은 framework-neutral request context 생성 함수와 Node HTTP adapter로 분리한다.
- structured logger는 JSON line을 출력하며 timestamp, level, message, service, environment, `request_id`, `correlation_id`를 지원한다.
- logger는 arbitrary object 전체를 자동 serialize하지 않고 명시적으로 허용한 metadata만 받는다. audit 또는 canonical business record를 대체하지 않는다.

## Environment configuration

- dependency-free validator가 `NODE_ENV`, `PORT`, `LOG_LEVEL`, `SERVICE_NAME`을 검사하고 immutable config를 반환한다.
- secret 값은 정의하거나 default하지 않는다. `.env.example`에는 non-secret 예시만 추가한다.
- invalid value는 startup 전에 명시적 validation error로 실패한다.

## Contracts and module boundaries

- `@maos/contracts`는 MAOS package 사이 public contract entry point다.
- 신규 module은 각 package의 `src/index.ts`만 public surface로 노출하고 다른 module의 `src/*` internal path를 import하지 않는다.
- architecture contract test가 `maos/modules`의 relative cross-module internal import와 `/src/` package import를 거부한다.
- `@maos/shared`는 business state를 소유하지 않으며 Bootstrap에 필요한 최소 primitive만 허용한다.

`ARCHITECTURE_CONFLICT`: 현재 repository에는 MAOS Architecture v1.0 canonical enum 원문이 없다. 따라서 enum 이름이나 값을 AI MLS Architecture 또는 일반 관행에서 추정하지 않는다. `@maos/contracts` package와 freeze reference는 만들되 canonical enum 구현은 승인된 원문이 제공될 때까지 제외하고 완료 보고서에 명시한다.

## Testing strategy

TDD 순서는 다음과 같다.

1. config validation의 valid/default/invalid case를 실패하는 unit test로 먼저 작성한다.
2. request/correlation ID 생성·전파를 실패하는 unit test로 먼저 작성한다.
3. structured JSON logging과 민감 metadata 제한을 실패하는 unit test로 먼저 작성한다.
4. health route의 status/body/header를 실패하는 integration test로 먼저 작성한다.
5. 신규 module import boundary를 검사하는 contract test를 작성한다.
6. app별 build와 root lint/typecheck/test/build를 검증한다.

Node 내장 test runner를 유지해 새로운 test framework를 추가하지 않는다.

## CI

GitHub Actions workflow는 Node 24와 pnpm 11.9.0을 사용해 install, lint, typecheck, test, build를 실행한다. Production credential, deployment target 또는 deployment job은 연결하지 않는다.

## Explicit non-goals

- DB schema 또는 executable migration
- Auth/Authorization 구현
- Approval, Workflow 또는 business feature
- Agent Runtime 또는 Memory Integration
- AI MLS Business Code refactoring
- Production deployment
- MAOS Architecture/Normalization 원문의 추정 또는 재작성

## Acceptance criteria

- 기존 AI MLS source와 frozen Architecture 문서는 변경되지 않는다.
- MAOS namespace의 app 세 개가 각각 build되고 root 검증에 포함된다.
- health endpoint, request context, structured logging, config validation이 automated test로 검증된다.
- 신규 MAOS module 사이 internal implementation 직접 import가 없다.
- `pnpm install`, lint, typecheck, test, build와 가능한 API health smoke test 결과를 기록한다.
- `docs/reviews/PHASE_1_3_COMPLETION.md`가 요구된 10개 완료 항목과 `ARCHITECTURE_CONFLICT`를 포함한다.

## Related documents

- [MAOS Architecture Index](README.md)
- [MAOS Architecture Freeze v1.0 placeholder](MAOS-FRZ-001-architecture-freeze-v1.0.md)
- [MAOS Normalization placeholder](MAOS-NRM-001-normalization.md)
- [AI MLS Repository Structure](../../book-11/02_REPOSITORY_STRUCTURE.md)
- [AI MLS Folder and Module Rules](../../book-11/05_FOLDER_AND_MODULE_RULES.md)
