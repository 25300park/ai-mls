# Environment Strategy

| 항목 | 값 |
|---|---|
| Document ID | DOC-OPS-003 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Operations Owner / Security Owner |
| 기준일 | 2026-07-14 |

## Environment model

| Environment | Purpose | Data | External effects | Access |
|---|---|---|---|---|
| Development | local/team build and deterministic checks | synthetic/minimized only | disabled/sandbox contract | developers; no production credential |
| Test | automated/manual integration and failure validation | synthetic/approved anonymized fixture | fake/sandbox boundary | test/service identities |
| Staging | release candidate, migration/recovery/security rehearsal | production-like synthetic or approved masked subset | disabled or isolated test target | release reviewers/operations |
| Production | approved business service and authoritative state | canonical classified data | approved real integrations only | least-privileged operational/business roles |
| Future environments | training, performance, DR, partner validation | `POST-MVP`; class/purpose-specific | isolated by default | separate approval required |

## Isolation principles

Environment별 identity, role/policy, secret/key, data store, object, queue, integration target, logging와 backup boundary를 분리한다. Non-production에서 production credential/raw personal data/publication target을 사용하지 않는다. Environment name/flag만으로 safety를 보장하지 않고 external effect boundary도 강제한다.

## Promotion policy

`Development → Test → Staging → Production` 순서로 immutable candidate/version/evidence를 승격한다. Source rebuild가 아닌 동일 artifact identity를 사용하고 environment-specific configuration만 승인된 방식으로 주입한다. 단계 생략은 금지하며 emergency change도 최소 verification, approval, audit와 사후 full validation이 필요하다.

## Entry and exit gates

| Gate | Required evidence |
|---|---|
| Dev→Test | scope/CR, build identity, basic validation, no secret/data violation |
| Test→Staging | automated/manual result, schema/config compatibility, security scan/review placeholder |
| Staging→Production | release approval, rollback/recovery readiness, monitoring/alert, data/security/privacy sign-off |
| Production complete | health/business/security validation, release evidence, observation window와 known issue |

Book 10 전까지 test artifact ID를 선발급하지 않고 evidence type만 `PLANNED — Book 10`으로 표시한다.

## Data movement

Production→non-production copy는 default deny다. Exception은 purpose, minimum fields/rows/time, masking/anonymization, Security/Privacy approval, transfer audit, retention/cleanup verification을 요구한다. Non-production data를 production authority로 import하지 않는다.

## Environment drift

Approved configuration baseline과 actual state 차이를 detect/review하고 unauthorized drift를 incident/change로 관리한다. Staging은 production-like behavior를 목표로 하지만 production data/external effect/secret를 복제하지 않는다.

## OPEN DECISION

Future DR/performance/training environment, isolation strength, masking verification, environment retention와 staging fidelity threshold는 implementation planning에서 정한다.

