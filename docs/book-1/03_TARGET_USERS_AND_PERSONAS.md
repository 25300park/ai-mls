# Target Users and Personas

| 항목 | 값 |
|---|---|
| Document ID | DOC-BIZ-004 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

persona는 research hypothesis이며 실제 permission role과 동일하지 않다. authorization은 Book 8에서 별도 정의한다. **Collector persona**는 사람인 Intake/Research Staff를 뜻하며 [Glossary](../00_GLOSSARY.md)의 technical `collector` component와 구분한다. **Developer persona**는 property developer를 뜻하며 software developer가 아니다.

## Persona summary

| Persona | Stage | Primary relationship |
|---|---|---|
| Collector | MVP internal | candidate discovery/intake |
| Agent | MVP internal | requirement, matching, client service |
| Senior Agent | MVP internal | quality/exception review |
| Manager | MVP internal | oversight, priority, performance |
| Administrator | MVP internal | access/configuration/audit support |
| Future External Broker | `POST-MVP` | governed contribution/cooperation |
| Tenant | MVP customer | rental requirement/outcome |
| Buyer | MVP customer | purchase requirement/outcome |
| Owner | MVP source/partner | offer, verification, permission |
| Developer | controlled partner/future | project inventory/evidence |

## Collector

| Dimension | Definition |
|---|---|
| Goals | relevant candidate를 빠르고 정확하게 capture하고 provenance를 유지 |
| Responsibilities | approved source search, source reference/raw intake, obvious field correction, duplicate signal 제공 |
| Pain points | repetitive search/copy, inconsistent naming, unclear staleness, duplicate posts |
| Success criteria | capture time 감소, required provenance completeness, correction/duplicate rework 감소 |

## Agent

| Dimension | Definition |
|---|---|
| Goals | client need에 맞는 credible option을 빠르게 제시 |
| Responsibilities | requirement clarification, match review, verification coordination, client feedback 기록 |
| Pain points | fragmented candidates, changing criteria, slow verification, weak comparison |
| Success criteria | time to shortlist/response 감소, relevant proposal와 viewing conversion 향상 |

## Senior Agent

| Dimension | Definition |
|---|---|
| Goals | complex case와 team decision quality 향상 |
| Responsibilities | exception/duplicate review, coaching, high-value proposal quality, delegated approval |
| Pain points | tacit knowledge concentration, inconsistent junior judgment, repeated escalation |
| Success criteria | correction/escalation rate 감소, review consistency와 turnaround 개선 |

## Manager

| Dimension | Definition |
|---|---|
| Goals | staff capacity, quality, risk와 business outcome 균형 |
| Responsibilities | policy/priority, workload, KPI, exception/risk와 source contribution review |
| Pain points | work visibility 부족, outcome attribution 약함, unauthorized exposure risk |
| Success criteria | operational efficiency, verified-available rate, zero unauthorized publication, source ROI clarity |

## Administrator

| Dimension | Definition |
|---|---|
| Goals | secure and reliable access/configuration 운영 |
| Responsibilities | identity/role lifecycle, approved configuration, audit support, incident escalation |
| Pain points | unclear access ownership, manual permission changes, limited audit context |
| Success criteria | timely provisioning/revocation, unauthorized access zero, complete privileged audit |

## Future External Broker — POST-MVP

| Dimension | Definition |
|---|---|
| Goals | governed network에 authoritative listing/offer를 기여하고 cooperative reach 확대 |
| Responsibilities | identity/authority evidence, data quality/freshness, correction, shared rule 준수 |
| Pain points | duplicate entry, incompatible format, trust/permission/dispute uncertainty |
| Success criteria | accepted contribution quality, freshness, cooperation outcome와 rule compliance |

## Tenant

| Dimension | Definition |
|---|---|
| Goals | budget/timing/location에 맞는 verified rental option을 신속히 확인 |
| Responsibilities | requirement/feedback 제공, viewing decision, personal data/communication consent 관리 |
| Pain points | unavailable/stale offer, unclear conditions, slow response |
| Success criteria | relevant option, response time, viewing satisfaction와 reduced misinformation |

## Buyer

| Dimension | Definition |
|---|---|
| Goals | credible purchase option과 decision context 확보 |
| Responsibilities | requirement/constraint와 feedback 제공, due diligence decision |
| Pain points | fragmented inventory, duplicate listing, unverified claims, comparison difficulty |
| Success criteria | verified shortlist quality, viewing conversion, reduced correction and decision delay |

## Owner

| Dimension | Definition |
|---|---|
| Goals | property/unit offer를 정확한 조건과 허용 범위로 적합한 client에게 전달 |
| Responsibilities | authority, availability, terms, contact channel와 sharing/publication permission 제공 |
| Pain points | repeated inquiries, outdated reposts, permission misuse, offer confusion |
| Success criteria | fewer irrelevant contacts, accurate representation, traceable permission와 qualified interest |

## Developer

| Dimension | Definition |
|---|---|
| Goals | approved project/inventory information을 정확히 전달하고 qualified demand 이해 |
| Responsibilities | project authority, official material, availability/terms, applicable DHSUD evidence와 update 제공 |
| Pain points | version drift, distributed collateral, stale availability, inconsistent partner presentation |
| Success criteria | approved information consistency, response quality, qualified lead/viewing contribution |

## Persona validation

- 각 persona 3명 이상 또는 available representative와 interview가 권장되지만 sample size는 `OPEN DECISION`이다.
- workflow observation에서 goal/pain/responsibility를 검증한다.
- success criteria는 [Success Metrics](09_SUCCESS_METRICS.md)와 연결한다.
- persona 이름을 permission role로 복사하지 않고 least-privilege role design에서 재검토한다.
