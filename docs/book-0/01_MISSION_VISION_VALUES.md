# Mission, Vision, and Values

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-027 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](00_PROJECT_CONSTITUTION.md) |

## Mission

mrHOMES 직원이 분산된 부동산 정보를 더 빠르게 발견·구조화·평가하고, source evidence와 human verification에 근거한 적합한 선택지를 고객에게 제공하도록 돕는다.

## Vision

신뢰 가능한 property intelligence가 발견부터 고객 제안과 승인된 publication까지 끊김 없이 추적되는 내부 운영 플랫폼을 만들고, 장기적으로는 명확한 contribution rule과 governance를 갖춘 cooperative MLS로 발전한다.

## Core Values

| Value | 행동 기준 | Evidence example |
|---|---|---|
| Trust before volume | 미검증 정보의 양보다 verified evidence의 품질을 우선 | 외부 결과의 verification/permission trace |
| Human accountability | AI recommendation에 사람이 책임 있는 판단을 더함 | approver identity와 rationale |
| Provenance always | 원본과 transformation lineage를 보존 | source record linkage |
| Privacy with purpose | 필요한 사람에게 필요한 정보만 최소 제공 | masking와 access audit |
| Explainable assistance | recommendation과 match 이유를 이해 가능하게 제시 | explanation/confidence evidence |
| Incremental learning | 작은 단계, 측정, review와 correction으로 개선 | phase metric와 review finding |
| Transparent change | decision과 exception을 숨기지 않음 | CR/ADR/Decision ID |

## Long-term platform vision

1. 내부 candidate discovery와 staff workflow를 일관된 system으로 만든다.
2. property, unit entity, listing offer, source record와 contact를 혼동하지 않는 property intelligence foundation을 구축한다.
3. verified listing과 permission 기반 고객 공유/publication을 운영한다.
4. evidence가 쌓이면 analytics와 partner integration을 확장한다.
5. `POST-MVP`에 external broker contribution, shared rules, data standard와 dispute governance를 갖춘 cooperative network를 검토한다.

## Internal-first strategy

- MVP의 primary user는 mrHOMES staff다.
- candidate listing은 내부 review를 위한 정보이며 외부 authority가 아니다.
- internal workflow에서 search time, correction, verification과 proposal 품질을 먼저 개선한다.
- external sharing은 [constitutional controls](00_PROJECT_CONSTITUTION.md#mandatory-constitutional-requirements)을 통과한 record만 허용한다.
- external broker/member 기능은 internal controls가 검증되기 전에는 `POST-MVP`다.

## Future cooperative MLS vision

향후 cooperative MLS는 단순 scraping database가 아니다. 참여 broker가 rule에 따라 권위 있는 listing data를 제출하고, 공통 governance, data exchange, quality, correction, dispute와 permission 책임을 공유하는 network다. 진입 조건은 최소한 다음을 포함한다.

- source/contributor identity와 authority 검증
- shared data standard와 lifecycle
- provenance, correction와 audit rule
- membership, permission와 enforcement governance
- privacy/security 및 platform policy review

이 vision은 future direction이며 현재 product가 cooperative MLS라고 주장하지 않는다.

## Business objectives

| Objective ID | Objective | A2에서 정의할 측정 방향 |
|---|---|---|
| `BG-001` | client requirement당 staff search effort 감소 | search time per request |
| `BG-002` | 첫 usable shortlist 제공 시간 단축 | time to first shortlist |
| `BG-003` | 외부 제안 정보의 신뢰성과 freshness 향상 | verified-available rate, stale rate |
| `BG-004` | duplicate와 manual rework 감소 | duplicate reduction, correction effort |
| `BG-005` | source별 business contribution 이해 | viewing/closing contribution by source |
| `BG-006` | unauthorized external exposure 방지 | unauthorized publication/sharing count |

수치 target과 baseline은 Book 1에서 evidence를 바탕으로 정의한다.

## Success principles

- business metric 개선이 privacy, provenance 또는 approval control 약화를 대가로 해서는 안 된다.
- speed metric은 accuracy, freshness, unauthorized exposure와 함께 본다.
- AI metric은 human correction, confidence calibration과 downstream outcome에 연결한다.
- output volume이 아니라 verified usefulness와 customer outcome을 평가한다.
- metric 정의, owner, source와 review cadence가 없으면 success claim을 하지 않는다.

## Constitutional bindings

이 문서는 `REQ-CONST-001`–`REQ-CONST-013`을 변경하지 않고 mission/business context로 해석한다. 특히 `BG-006`은 `REQ-CONST-003`, `REQ-CONST-004`, `REQ-CONST-013`의 business outcome trace를 제공한다.

> **OPEN DECISION:** BG-001–BG-006의 baseline, target, owner와 measurement cadence는 A2에서 확정한다.
