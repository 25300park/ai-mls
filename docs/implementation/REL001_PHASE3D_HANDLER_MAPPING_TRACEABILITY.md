# REL-001 Phase 3D API-017 Handler Mapping Traceability

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-147 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner |
| 기준일 | 2026-09-15 |
| 기준 commit | `b6955574a3ebbff0f702ba17d39c5be80078023e` |

## 1. Objective

Phase 3B.1에서 승인된 세 Job type과 AI capability handler identity의 결속을 Phase 3D closed registry 구현 및 검증 증거에 연결한다.

## 2. Canonical mapping

| Job type | Handler identity | Registry evidence | Execution evidence | Result |
|---|---|---|---|---|
| `AI_LISTING_PARSE` | `AI-001` | `JobExecutionRegistry` exact mapping | registry/runtime focused tests | WIRED |
| `AI_REQUIREMENT_PARSE` | `AI-004` | `JobExecutionRegistry` exact mapping | registry/runtime focused tests | WIRED |
| `AI_MATCHING` | `AI-005` | `JobExecutionRegistry` exact mapping | registry/runtime focused tests | WIRED |

Approved mapping count는 정확히 `3`이다. 각 trusted application handler port는 canonical `handlerId`를 선언하고 registry key의 expected identity와 일치해야 한다. Swapped identity는 거부된다. Registry는 unknown key를 거부하며 incomplete mapping이면 `NOT_READY`이고 generic/default/reflection/plugin fallback은 없다. Class 또는 object로 구현된 approved application handler port는 동일한 closed mapping을 통과한다.

## 3. Handler input boundary

Handler는 durable Job에서 읽은 `jobId`, `attempt`, `jobType`, `tenantId`, `scopeRef`, `purpose`, immutable `inputReferences`, `policyVersion`과 live admission evidence reference만 받는다. Current Session, HTTP request, credential, provider secret, caller-authored authority 또는 failure code는 전달하지 않는다.

## 4. Authority and ownership

- API-017 runtime은 resolution과 one-shot orchestration만 소유한다.
- Domain/application handler는 실제 업무 로직을 소유한다.
- Runtime executor는 initiating/approving principal로 재해석되지 않는다.
- FEAT-022 Production `AdvisoryRuntime` 조립과 model/provider activation은 Phase 3D에서 `0`이다.

## 5. Failure and evidence

Handler exception 또는 malformed result는 trusted failure mapper를 통과해야 한다. Durable failure에는 기존 canonical failure code와 opaque safe evidence reference만 저장된다. API-017는 Phase 3C의 approved enriched audit intent를 사용하며 final API-016 Audit Event를 직접 생성하지 않는다.

## 6. Explicit exclusions

New Job type `0`, new handler semantic `0`, automatic retry `0`, scheduler/polling `0`, HTTP/RPC `0`, external provider/network call `0`, new Audit vocabulary `0`.
