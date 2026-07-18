# Scalability Strategy

| 항목 | 값 |
|---|---|
| Document ID | DOC-ARCH-010 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Strategy

초기 목표는 내부 팀의 정확하고 추적 가능한 workflow를 단순한 구조로 제공하는 것이다. MVP는 modular monolith와 분리 가능한 worker 책임을 기본 제안으로 삼고, 관측된 병목과 조직 경계가 확인될 때만 부분을 추출한다. 규모를 이유로 검증·승인·privacy boundary를 약화하지 않는다.

## Evolution stages

| Stage | Expected shape | Scaling focus | Exit signal |
|---|---|---|---|
| MVP | modular monolith, logical queue, worker, relational authority, private evidence storage | correctness, auditability, operability, manual fallback | 실제 workload·latency·failure 데이터 축적 |
| Growth | 동일 codebase의 수평 확장 가능한 stateless 경계, worker pool, read/report 분리 가능성 | job throughput, search responsiveness, integration isolation | 특정 module의 독립 scale/release 필요 반복 |
| Enterprise | 선택적 service extraction, stronger tenant/organization controls, governed integration platform | isolation, compliance, regional/organizational operations | 명확한 소유권·SLO·비용 근거 |
| Future distributed network | broker/member federation과 standards-based exchange 가능성 | trust federation, policy interoperability, dispute/audit governance | 사업·법률·회원 governance 승인 |

## Scaling principles

- 먼저 측정하고 workload profile과 사용자 영향이 확인된 병목을 개선한다.
- 동기 요청은 짧고 예측 가능하게 유지하고 장시간·재시도 가능 작업은 worker로 이동 가능하게 한다.
- stateless application 경계를 선호하되 authoritative consistency를 임의의 cache에 위임하지 않는다.
- search/read optimization은 source of truth와 reconciliation 가능한 파생 view로 취급한다.
- job은 at-least-once delivery와 수평 consumer를 견딜 수 있도록 idempotent하게 설계한다.
- tenant, source, connector, provider 단위의 noisy-neighbor 제한과 사용량 관측을 준비한다.
- 민감정보 복제를 최소화하고 서비스 분리가 privacy surface를 불필요하게 키우지 않도록 한다.

## Service extraction criteria

다음 근거 중 하나 이상이 반복적으로 입증되고, 분리 비용보다 이익이 클 때 ADR로 검토한다.

1. 독립적인 scale 또는 resource profile이 필요하다.
2. 장애가 core workflow와 강하게 격리되어야 한다.
3. data ownership과 consistency boundary가 명확하다.
4. 보안·privacy·compliance 경계가 별도 통제를 요구한다.
5. 독립 team ownership과 release cadence가 실제로 존재한다.
6. 기술 또는 provider dependency를 core에서 격리해야 한다.

명사별 microservice 분리, 추정 트래픽만을 근거로 한 분리, 분산 transaction을 숨긴 분리는 피한다.

## Performance assumptions

현재 승인된 사용자 수, 매물 수, 원문 크기, parse rate, matching latency, publication volume, retention 규모, availability objective가 없다. 따라서 수치 기반 capacity 약속은 하지 않는다.

> **OPEN DECISION:** Phase 4 이후 실제 업무량 baseline과 우선 사용자 여정을 계측한 뒤 latency, throughput, concurrency, backlog, recovery objective를 승인해야 한다.

## Likely independent scaling candidates

AI parsing workers, connector workers, publication delivery, search/read projection, reporting은 서로 다른 resource·failure 특성을 가질 수 있다. 이는 미래 후보일 뿐 현재의 별도 서비스 결정을 의미하지 않는다.

## Governance

중대한 topology 변경, data ownership 분리, 새로운 distributed dependency는 성능 증거·보안 영향·migration/rollback·운영 소유자를 포함한 ADR과 Architecture Review Board 검토를 요구한다.
