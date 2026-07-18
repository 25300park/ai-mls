# Philippine Market Context

| 항목 | 값 |
|---|---|
| Document ID | DOC-BIZ-007 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Evidence boundary

이 문서는 unsupported market size, transaction volume, adoption rate 또는 platform share를 제시하지 않는다. regulatory statements는 공식 source에 연결하고, workflow/ecosystem statement는 `ASSUMPTION`으로 구분한다.

## Philippine brokerage characteristics

- Republic Act No. 9646은 Philippine real estate service practice를 규율하고 Professional Regulatory Board of Real Estate Service를 둔다: [Lawphil — RA 9646](https://lawphil.net/statutes/repacts/ra2009/ra_9646_2009.html).
- 따라서 AI MLS는 staff/persona와 licensed professional authority를 혼동하지 않고, professional/legal review가 필요한 action을 software가 자동 대체하지 않아야 한다.
- developer project information은 일반 resale/rental offer와 별도 regulatory evidence가 필요할 수 있다. DHSUD는 subdivision/condominium project의 registration과 license-to-sell requirement를 안내한다: [DHSUD License to Sell FAQ](https://dhsud.gov.ph/requirement-of-license-to-sell-hred-faqs/).

이 문서는 legal advice가 아니며 exact applicability는 qualified reviewer가 case별로 판단한다.

## Current listing ecosystem

> **ASSUMPTION [ASM-009]:** mrHOMES가 다루는 candidate는 broker/owner/developer communication, social/community channel, direct message, website와 internal records 등 여러 source에서 발견된다. source mix, 권위, reuse permission과 update cadence는 source inventory/interview로 검증해야 한다.

ecosystem 설계 시 source마다 다음을 분리한다.

- source identity와 content authority
- property/unit/offer/contact relationship
- collection/reuse/display policy
- freshness와 correction route
- client-sharing/public-publication permission

## Fragmentation

> **ASSUMPTION [ASM-010]:** naming, format, language, unit description, contact, price/terms와 availability가 source별로 달라 manual reconciliation이 필요하다.

fragmentation의 business response는 unrestricted scraping이 아니라 approved intake, provenance, canonical suggestion, human correction와 evidence-based verification이다.

## Manual communication

> **ASSUMPTION [ASM-011]:** availability, viewing, condition과 permission 확인의 상당 부분이 call/message로 이루어져 response delay와 audit gap이 생길 수 있다.

system은 communication을 자동으로 impersonate하지 않고 follow-up context, owner, timestamp, outcome과 next action을 보존하는 방향을 취한다.

## Privacy and contact context

Republic Act No. 10173(Data Privacy Act of 2012)는 government/private sector의 personal information processing에 적용되는 framework를 둔다: [National Privacy Commission — Data Privacy Act](https://privacy.gov.ph/data-privacy-act/). AI MLS는 contact/client requirement를 단순 listing field가 아니라 purpose, access, retention와 security가 필요한 personal information으로 취급한다.

## Opportunities

- multilingual/inconsistent source를 provenance-aware structured candidate로 정리
- property alias와 unit/offer distinction을 통한 duplicate/rework 감소
- verification freshness와 permission evidence 표준화
- client need와 candidate를 explainable하게 연결
- developer/owner/broker source별 approved evidence와 outcome 추적
- future local interoperability/contribution governance foundation

## Challenges

| Challenge | Business response |
|---|---|
| source policy/platform change | policy review, manual fallback, no autonomous scraping MVP |
| uncertain authority/permission | fail-closed verification와 explicit permission |
| contact/personal data | minimization, masking, audit, retention |
| stale/duplicate offer | time-bound verification와 provenance-preserving review |
| inconsistent local naming | alias/canonical suggestion + human review |
| professional/developer regulation | licensed/qualified reviewer와 official evidence route |
| network trust | contributor identity, rules, enforcement를 `POST-MVP` gate로 둠 |

## Future platform positioning

1. **Now:** mrHOMES internal staff용 Property Intelligence Platform.
2. **Next:** verified, permission-controlled client proposal/publication workflow.
3. **Later:** selected owner/developer/broker integration with source-policy approval.
4. **POST-MVP:** governed external broker contribution and cooperative MLS.

## Required market validation

- current source/channel inventory와 policy owner
- staff workflow interview/observation
- owner/developer/broker willingness와 permission model
- tenant/buyer trust/pain interview
- licensed real-estate, privacy와 developer-regulation review
- no-statistics baseline study for [Success Metrics](09_SUCCESS_METRICS.md)

> **OPEN DECISION:** Philippine legal/compliance reviewer, target geography/segment와 market research sample을 지정해야 한다.
