# Problem Statement

| 항목 | 값 |
|---|---|
| Document ID | DOC-BIZ-002 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Evidence status

> **ASSUMPTION [ASM-007]:** 아래 current-state description은 project brief와 internal-first product intent를 바탕으로 한 working model이다. 실제 빈도, 시간과 error rate는 staff interview, observation 및 baseline measurement로 D0 discovery/pilot 전에 검증해야 한다.

## Current business problems

- property candidate가 여러 source와 대화 channel에 분산되어 한 번에 비교하기 어렵다.
- 동일 property/unit/offer가 서로 다른 표현·contact·가격으로 반복되어 duplicate effort가 발생한다.
- source post와 verified availability가 혼재하여 external-use readiness를 판단하기 어렵다.
- client requirement가 자유 형식으로 전달되어 search 기준과 우선순위가 사람마다 달라질 수 있다.
- verification, permission, follow-up와 publication evidence가 한 trace로 연결되지 않을 수 있다.
- source별 viewing/closing contribution이 보이지 않으면 search effort를 어디에 집중할지 판단하기 어렵다.

## Current property search workflow

1. Agent가 client requirement를 message, call 또는 note로 받는다.
2. Collector/Agent가 여러 source와 과거 대화를 수동 검색한다.
3. candidate 내용을 복사·정리하고 location, unit, price, contact를 비교한다.
4. 중복·stale 여부를 사람의 기억과 수동 확인으로 판단한다.
5. contact 또는 source를 통해 availability와 조건을 verification한다.
6. 적합한 option을 shortlist/proposal로 정리한다.
7. 필요 시 client-sharing permission 또는 public-publication permission을 별도로 확인한다.

이 workflow는 [Current Workflow Analysis](02_CURRENT_WORKFLOW_ANALYSIS.md)에서 stakeholder/decision/risk로 분해한다.

## Pain points

| Pain point | Business effect | Related goal |
|---|---|---|
| 반복 검색 | client 대응 지연과 staff capacity 감소 | BG-001, BG-002 |
| inconsistent naming | 놓친 match와 duplicate 증가 | BG-004 |
| stale/unknown availability | client trust 저하와 재작업 | BG-003 |
| fragmented evidence | verification/permission 확인 지연 | BG-003, BG-006 |
| hidden contact access | privacy/security risk | BG-006 |
| unstructured requirement | relevance 편차와 correction 증가 | BG-002 |
| source outcome 미연결 | channel/resource allocation 판단 약화 | BG-005 |

## Manual workload

현재 manual work 자체가 모두 waste는 아니다. human judgment, source-policy 판단과 verification은 constitutional control이다. 줄여야 하는 것은 반복 검색, 재입력, 형식 변환, duplicate comparison과 evidence 재탐색이며, 사람의 approval responsibility를 자동화로 제거해서는 안 된다.

## Duplicate effort

duplicate는 같은 source post의 재전송, 같은 unit의 여러 offer, alias가 다른 같은 property, 오래된 정보의 재게시를 포함할 수 있다. 이들은 서로 다른 business 의미를 가지므로 단순 삭제가 아니라 provenance를 보존한 분류·연결이 필요하다. duplicate baseline은 [Success Metrics](09_SUCCESS_METRICS.md)에서 정의한다.

## Information fragmentation

fragmentation은 source, format, language, naming, freshness, contact와 permission evidence의 분리를 뜻한다. 해결 목표는 모든 정보를 무제한 중앙화하는 것이 아니라, 필요한 reference와 authority state를 privacy/retention 범위 안에서 연결하는 것이다.

## Business opportunity

- 한 번 입력한 candidate evidence를 search, matching, verification와 proposal에서 재사용한다.
- property/unit/offer/source를 분리해 comparison quality를 높인다.
- human review를 evidence-rich workflow로 만들어 verified option 제공 시간을 줄인다.
- source별 outcome을 측정해 staff effort와 partnership을 개선한다.
- internal controls가 검증되면 approved partner contribution과 cooperative network로 확장할 foundation을 만든다.

## Target future state

| Current assumption | Target outcome | Constraint |
|---|---|---|
| source별 반복 검색 | unified internal candidate discovery | source policy와 provenance 유지 |
| 수동 재입력/비교 | structured assistance와 human correction | AI is advisory |
| 기억 중심 duplicate 판단 | explainable duplicate review | offer/source 삭제 금지 |
| ad hoc verification | time-bound evidence workflow | authorized human required |
| permission 혼동 | sharing/publication permission 분리 | fail closed |
| outcome 불명확 | source-to-viewing/closing trace | privacy/minimization 유지 |

## Problem validation plan

- 역할별 interview와 실제 case walkthrough
- request-to-shortlist time sample
- candidate당 source/re-entry/duplicate touch count
- verification 성공/실패와 stale reason 분류
- client correction, viewing와 closing outcome linkage 가능성 검토

> **OPEN DECISION:** baseline sample period, participating team과 privacy-safe observation method를 Business Owner가 승인해야 한다.
