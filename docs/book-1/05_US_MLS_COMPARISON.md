# US MLS Comparison

| 항목 | 값 |
|---|---|
| Document ID | DOC-BIZ-006 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Comparison purpose

US MLS를 feature checklist가 아니라 broker cooperation, member-submitted listing authority, common rules와 standardized exchange의 operating model로 비교한다. AI MLS는 현재 candidate discovery platform이며 이름이 같다는 이유로 전통적 MLS authority를 주장하지 않는다.

## Official reference baseline

- NAR는 MLS를 listing broker가 cooperative broker를 찾고 listing cooperation에 필요한 정보를 공유하도록 돕는 facility로 설명한다: [NAR — Multiple Listing Service: What Is It](https://www.nar.realtor/mls-online-listings/multiple-listing-service-mls-what-is-it).
- NAR policy resources는 MLS rules/policies와 seller listing options를 다룬다: [NAR MLS Policies](https://www.nar.realtor/about-nar/policies), [Multiple Listing Options for Sellers](https://www.nar.realtor/about-nar/policies/multiple-listing-options-for-sellers).
- RESO는 real-estate data exchange 표준을 제공하며 listing data 자체는 제공하지 않는다: [RESO Web API](https://www.reso.org/reso-web-api/), [RESO Data Dictionary](https://dd.reso.org/).

정확한 US MLS rule은 local MLS와 시점에 따라 다르므로 이 문서는 보편적 비교 축만 사용한다.

## Comparison table

| Dimension | US MLS archetype | mrHOMES AI MLS current target |
|---|---|---|
| Primary identity | cooperative broker listing service/facility | internal Property Intelligence Platform |
| Data origin | participating brokers submit listings under rules/authority | multiple sources yield internal candidate listing |
| Authority | participant/listing agreement와 MLS rules | human verification + separate permission/approval |
| Core value | cooperation, distribution, market exposure/information | search effort reduction, structuring, matching, verification |
| Governance | membership/participation, local/national policy, enforcement | internal governance/ARB/approval controls |
| Data standard | RESO-style standardized exchange commonly relevant | canonical model planned; no final exchange standard yet |
| Publication | rule/consent-based dissemination options | verified publication workflow only |
| AI role | optional vendor/application capability | explicit assistant for parsing/matching; no authority |
| Network | multi-broker participants/subscribers | mrHOMES internal users first |
| External contribution | normal cooperative function | `POST-MVP` and policy-gated |

## Similarities

- property/listing information을 structured하게 비교·검색하려는 목적
- cooperation과 customer service를 개선하는 information infrastructure
- data quality, freshness, rules, authorization과 controlled distribution의 필요
- common identifiers/terms와 interoperability가 scale에 중요

## Differences

- US MLS의 starting point는 member/broker-submitted listing authority이며 AI MLS의 starting point는 candidate discovery다.
- US MLS는 cooperative network governance가 본질이지만 AI MLS MVP는 단일 조직 internal workflow다.
- AI MLS는 source content를 곧바로 authoritative listing으로 취급하지 않고 verification/permission gate를 명시한다.
- AI assistance는 AI MLS의 core differentiator지만 approval authority가 아니다.

## Candidate discovery platform

candidate listing은 “possible market opportunity”이지 “member-authorized listing”이 아니다. discovery breadth가 늘어도 verification, permission, source policy와 provenance가 부족하면 cooperative MLS authority에 가까워지지 않는다.

## Verified publication workflow

AI MLS의 external publication은 valid verification, public-publication permission, human approval, provenance와 audit를 모두 요구한다. 이 workflow는 현재 authority gap을 통제하지만 cooperative member submission, shared enforcement와 dispute mechanism을 대신하지 않는다.

## Current limitations

- external broker membership/contribution governance 없음
- common submission rule, enforcement, dispute/appeal process 없음
- authoritative coverage나 market completeness 보장 없음
- final data exchange standard/API 없음
- independent compliance/legal review와 network operating model 없음

## Future convergence

`POST-MVP` convergence는 다음 readiness evidence가 있을 때만 고려한다.

1. internal verification/permission/audit controls가 pilot에서 안정적임
2. external contributor identity/authority와 membership policy가 승인됨
3. shared data standard, update SLA, correction/dispute가 정의됨
4. source/data licensing, privacy/security와 local regulation review 완료
5. contribution quality와 network value가 measurable함

목표는 US model 복제가 아니라 Philippine context와 mrHOMES strategy에 맞는 governed cooperation이다.
