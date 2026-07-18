# Product Principles

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-028 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](00_PROJECT_CONSTITUTION.md) |

## Platform identity

AI MLS는 **internal Property Intelligence Platform first**다. 여러 source에서 발견하거나 입력한 candidate listing을 구조화·정규화하고 client requirement와 match하며, staff verification과 permission-based external use를 지원한다. 초기 제품은 contributor-submitted authoritative cooperative MLS가 아니다.

## Product boundaries

| Boundary | Inside | Outside 또는 별도 authority |
|---|---|---|
| Discovery/intake | manual copy/input, approved future intake | source platform account control |
| Intelligence | parsing, normalization suggestion, duplicate/match recommendation | AI approval 또는 사실 확정 |
| Verification | staff evidence review와 contact follow-up 지원 | autonomous verification |
| Customer sharing | approved internal proposal workflow | unrestricted candidate exposure |
| Publication | verification·permission evidence와 human approval orchestration | automatic public posting authority |
| Integration | approved contract를 통한 connector boundary | connector의 private core access |

## MVP scope

- staff authentication/role control을 전제로 한 internal workflow
- manual intake와 raw/source evidence reference
- AI-assisted structured extraction과 human correction
- property/unit/listing offer normalization과 duplicate review 지원
- client requirement capture와 candidate matching/ranking 지원
- contact restriction, staff verification와 freshness 관리
- verified information을 사용하는 customer proposal
- 별도 public-publication permission과 human approval이 있는 publication workflow
- provenance, audit, retention과 operational visibility

이 목록은 product capability boundary이며 final module, schema, API 또는 screen contract가 아니다.

## Out of scope

- autonomous Facebook 또는 Viber scraping/control
- third-party policy approval 없는 connector
- AI의 verification, permission 또는 publication approval
- 미검증 candidate listing의 client/public exposure
- fully autonomous public posting
- external broker cooperative membership/network governance (`POST-MVP`)
- final vendor/stack commitment 없이 vendor-specific lock-in
- legal compliance guarantee 또는 source content ownership 주장

## Human-centered workflow

human은 exception 처리만 하는 최후의 fallback이 아니라 authority owner다. 제품은 반복 작업을 줄이되 source evidence, AI confidence, conflict, freshness, permission과 audit context를 승인 시점에 보여준다. review queue와 correction path는 normal workflow의 일부이며 hidden override가 아니다.

## Internal intelligence platform

- candidate listing은 search/review 대상이며 listing authority가 아니다.
- internal access도 role과 need-to-know에 제한된다.
- match result는 decision support이며 client suitability 보증이 아니다.
- staff correction은 provenance를 지우지 않고 improvement evidence로 남긴다.
- internal success는 [Mission business goals](01_MISSION_VISION_VALUES.md#business-objectives)로 측정한다.

## Verified publication policy

publication eligibility에는 서로 독립적인 모든 조건이 필요하다.

| Gate | Required evidence | Failure behavior |
|---|---|---|
| Verification | authorized human, verified facts, timestamp/freshness | publication blocked |
| Permission | explicit public-publication permission scope/expiry | publication blocked |
| Approval | authorized human publication approval | publication blocked |
| Provenance | source record와 transformation trace | publication blocked |
| Security/privacy | contact masking/disclosure rule와 authorization | restricted fields omitted 또는 publication blocked |
| Audit | attempt, actor, decision와 outcome recordability | state transition blocked/fails safe |

client-sharing permission은 public-publication permission을 대신하지 않으며, verified listing은 published listing이 아니다.

## Customer-first principles

- relevance와 clarity: client requirement와 match 이유를 이해 가능하게 제시한다.
- truthfulness: unknown, unverified, stale과 confidence를 숨기지 않는다.
- privacy: 필요 이상의 contact/source detail을 노출하지 않는다.
- timeliness: verification freshness와 expiration을 관리한다.
- correction: 잘못된 external information을 신속히 수정·철회하고 audit한다.
- choice: AI ranking이 유일한 답인 것처럼 표현하지 않고 human-curated alternatives를 허용한다.

## Measurable product gates

- unverified external exposure test는 항상 거부되어야 한다.
- permission 종류를 교차 사용한 sharing/publication test는 거부되어야 한다.
- 모든 external item은 verification, permission, approval와 provenance로 역추적되어야 한다.
- MVP capability는 owner, acceptance criteria와 failure path 없이 complete로 표시할 수 없다.

## Constitutional bindings

`REQ-CONST-002`–`REQ-CONST-005`, `REQ-CONST-009`, `REQ-CONST-011`–`REQ-CONST-013`을 product boundary와 external-use gate로 구체화한다. canonical wording은 [Constitution](00_PROJECT_CONSTITUTION.md#mandatory-constitutional-requirements)에만 있다.
