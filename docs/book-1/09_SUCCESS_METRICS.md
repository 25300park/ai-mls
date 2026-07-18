# Success Metrics

| 항목 | 값 |
|---|---|
| Document ID | DOC-BIZ-010 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Metric policy

- baseline 없는 performance target을 사실처럼 만들지 않는다.
- speed/productivity KPI는 quality/control KPI와 pair로 본다.
- metric은 definition, owner, population, period, source, exclusion과 review cadence를 가진다.
- personal/contact data를 불필요하게 analytics에 복제하지 않는다.
- constitutional control metric은 target이 `0` unauthorized 또는 `100%` required evidence일 수 있다.

## KPI dictionary

| KPI ID | KPI | Definition/formula | Goal | Baseline | Target | Owner |
|---|---|---|---|---|---|---|
| KPI-001 | Search Time | request search 시작부터 review 가능한 첫 candidate set까지 elapsed time의 median/P90 | BG-001 | OPEN | OPEN | Operations/Business |
| KPI-002 | Time to Shortlist | complete requirement부터 첫 usable shortlist 전달까지 elapsed time의 median/P90 | BG-002 | OPEN | OPEN | Agent Manager |
| KPI-003 | Duplicate Reduction | `(baseline duplicate touches - current duplicate touches) / baseline duplicate touches` | BG-004 | OPEN | OPEN | Data/Operations |
| KPI-004 | Verification Rate | verification 시도 candidate 중 valid available verification을 얻은 비율; reason별 분리 | BG-003 | OPEN | OPEN | Verification Owner |
| KPI-005 | Publication Accuracy | audited publication 중 당시 valid verification, public-publication permission, approval와 correct representation을 모두 가진 비율 | BG-003, BG-006 | OPEN | 100% control target | Publication Owner |
| KPI-006 | Unauthorized Publication Count | required approval/permission/verification 없는 publication event 수 | BG-006 | OPEN | 0 | Security/Business |
| KPI-007 | Client Response Time | complete client message/request부터 meaningful human response까지 elapsed time median/P90 | BG-002 | OPEN | OPEN | Agent Manager |
| KPI-008 | Viewing Conversion | eligible delivered proposal/shortlist 중 confirmed viewing으로 이어진 비율; denominator 고정 | BG-003, BG-005 | OPEN | OPEN | Business Owner |
| KPI-009 | Closing Contribution | closed outcome을 source/candidate/agent contribution model에 연결한 count/value/share | BG-005 | OPEN | OPEN | Business Owner |
| KPI-010 | Operational Efficiency | staff productive outcome당 search/capture/review/follow-up effort; role별로 측정 | BG-001 | OPEN | OPEN | Operations Owner |

## Supporting quality metrics

| KPI ID | Metric | Purpose |
|---|---|---|
| KPI-011 | Source provenance completeness | external-use record의 source/lineage completeness |
| KPI-012 | Stale proposal rate | proposal 시점에 invalid/expired 정보 비율 |
| KPI-013 | Candidate correction rate | AI/manual capture 후 material correction 비율 |
| KPI-014 | False duplicate merge rate | 서로 다른 unit/offer를 잘못 결합한 비율 |
| KPI-015 | Permission trace completeness | sharing/publication의 correct permission evidence 비율 |
| KPI-016 | Restricted contact audit coverage | restricted access 중 complete audit evidence 비율 |

KPI-011, KPI-015, KPI-016의 release control target은 100%지만 measurement rule과 exception treatment는 후속 Book에서 승인한다.

## Measurement rules

### Search time and time to shortlist

- start/end event와 “complete requirement”, “usable shortlist”를 operationally 정의한다.
- waiting on client/source와 active staff time을 분리한다.
- median과 P90을 함께 보고 극단값을 숨기지 않는다.

### Duplicate reduction

- same post, same unit, same offer와 false merge를 분리한다.
- deletion count가 아니라 avoided review/re-entry effort와 provenance preservation을 본다.

### Verification rate

- available, unavailable, no response, insufficient evidence, expired를 분리한다.
- 높은 rate를 위해 verification 기준을 낮추지 않는다.

### Publication accuracy

- sampled audit가 아니라 가능하면 모든 publication gate evidence를 검사한다.
- correction/unpublish latency와 unauthorized attempt rejection도 함께 본다.

### Viewing and closing

- attribution model(single-touch/multi-touch)은 `OPEN DECISION`이다.
- conversion을 높이기 위해 irrelevant pressure나 privacy-invasive tracking을 사용하지 않는다.

## Baseline and target process

1. metric owner와 definition 승인
2. privacy-safe 4–8주 baseline period 제안(기간은 `OPEN DECISION`)
3. data completeness/selection bias review
4. pilot target과 guardrail pair 설정
5. weekly operational/monthly business review cadence 제안
6. target miss 시 root cause와 scope/process correction; control 완화 금지

## Release/decision gates

- KPI definition과 source가 없으면 value claim을 `VALIDATED`로 표시하지 않는다.
- KPI-005가 100%가 아니거나 KPI-006이 0이 아니면 external publication release를 차단하고 incident review한다.
- performance improvement가 KPI-011/015/016 저하와 함께 발생하면 success로 인정하지 않는다.

> **OPEN DECISION:** baseline period, denominator/exclusion, attribution model, target와 dashboard owner는 controlled pilot 전에 승인한다.
