# Coding Standards

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-004 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Development Reviewer |
| 기준일 | 2026-07-15 |

## General coding standards

- correctness와 readability를 cleverness보다 우선한다.
- input, state transition, authority와 external effect를 explicit하게 검증한다.
- hidden global state, silent fallback, unbounded retry와 implicit privilege를 금지한다.
- public contract와 security-sensitive logic에는 rationale와 failure semantics를 남긴다.
- dead code, unused dependency와 stale feature flag는 승인된 retention 사유 없이 유지하지 않는다.

## Formatting principles

한 repository formatter와 lint profile을 사용하며 개인별 style을 섞지 않는다. formatting-only 변경은 behavior 변경과 분리한다. generated file은 직접 수정하지 않고 source/generator를 수정한다.

> **OPEN DECISION:** exact formatter, lint, compiler/static-analysis configuration은 technology stack 승인 후 결정한다.

## Error handling

- error는 validation, business, authorization, conflict, dependency, AI, publication와 internal category를 보존한다.
- fail-closed가 authority/privacy/publication에 기본이다.
- user-facing message에 credential, stack, contact 또는 raw evidence를 노출하지 않는다.
- error를 삼키지 않고 correlation/request/job ID와 owning boundary로 전달한다.
- retry는 idempotency, bounded attempt, backoff, terminal state와 audit를 가진다.

## Logging principles

- structured event, severity, timestamp, correlation ID, actor/service identity, action, target reference와 result를 기록한다.
- secret/token/password와 불필요한 personal/contact/raw content는 기록하지 않는다.
- authorization, approval, AI version, publication external effect와 privileged operation은 immutable audit evidence와 연결한다.
- log failure가 critical action의 audit를 제거하면 action은 fail-closed하거나 governed recovery queue로 이동한다.

## Dependency rules

- dependency는 owner, purpose, license/security posture, version policy와 exit impact를 review한다.
- direct dependency를 최소화하고 lock/version evidence를 유지한다.
- deprecated, unmaintained 또는 critical-vulnerability dependency는 waiver와 expiry 없이 merge하지 않는다.
- vendor SDK가 domain contract, authority 또는 audit를 소유하지 못한다.

## Data and concurrency

authoritative write는 validation, authorization, expected version/idempotency와 audit context를 함께 처리한다. partial failure는 rollback 또는 reconciliable state를 남기며 unknown external publication state를 success로 간주하지 않는다.

## Verification gate

format, lint, type/static check, dependency/security scan와 mapped `TEST-*` evidence는 [Development Done](11_DEFINITION_OF_DONE_DEVELOPMENT.md)의 applicable gate를 통과해야 한다.
