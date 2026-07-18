# Phase 7.5 — Cross-Phase Consistency Review

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-011 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Database Reviewer / AI Reviewer / Development Reviewer |
| 기준일 | 2026-07-14 |
| Phase | Phase 7.5 |

## Objective and scope

Book 0–6, ADR-001–006, Master/Decision/Change/Risk/Assumption registry와 모든 completion/review 문서를 대상으로 terminology, status, entity, workflow, API, AI, registry, naming, publication 및 traceability 정합성을 검증했다. 새 architecture/business rule/implementation은 만들지 않고 이미 정의된 계약의 누락·이름·mapping 차이만 교정했다.

## Method

- canonical source 우선순위: Constitution → Data Dictionary → Workflow Status/Transition → API Registry → AI Capability Registry.
- permanent/trace ID를 namespace별로 추출해 definition과 reference를 대조했다.
- Markdown local target, metadata/version, duplicate entity/status/capability와 required mapping을 검사했다.
- publication 11개 상태는 관련 6개 normative 문서에 대해 exact set equality를 검사했다.
- 역사 review 문서의 H1 제목과 filename은 보존하고 active phase wording만 교정했다.

## 1. Terminology consistency

| Term group | Canonical resolution | Result |
|---|---|---|
| candidate listing / verified listing / publishable listing | Glossary 정의를 유지하고 서로 교환하지 않음 | PASS |
| property / unit entity / listing offer / source record | Book 3 canonical entity 의미와 일치 | PASS |
| verification / permission / publication approval | 별도 entity, authority, lifecycle로 유지 | PASS |
| Workflow names | WF-001–012 titles와 Book 5 navigation 일치 | PASS |
| API names | API-001–019 owner document와 API Registry 일치 | PASS |
| AI capability names | AI-001–007 index/schema/API mapping 일치 | PASS |
| `CANDIDATE`, `VERIFIED`, `CLIENT_SHAREABLE`, `PUBLISHED` | authority/eligibility term과 canonical status 관계를 Status Dictionary에 명시 | CORRECTED |
| AI `INTERNAL_CANDIDATE`, `CLIENT_ELIGIBLE`, `PUBLISHED` | AI-006 query intent label이며 business status가 아님을 명시 | CORRECTED |

## 2. Status consistency

Book 5 Status Dictionary가 business workflow status의 canonical source다. Book 3 lifecycle은 동일 `AGGREGATE.STATUS` 표기로 정규화했고 Book 6은 같은 값을 response/validation에서 사용한다.

| Aggregate set | Database | Workflow | API/AI | Result |
|---|---|---|---|---|
| Intake, Duplicate, Requirement, Match | Data Dictionary exact names | Status Dictionary + transitions | domain APIs / AI advisory mapping | PASS |
| Contact Case, Verification, Permission | exact entity lifecycle | WF-007/011 | Contact/Verification APIs | PASS |
| Proposal, Publication Approval | missing entity rows added | WF-008/009 | Publication API | CORRECTED |
| Publication | 11-state exact set | workflow/dictionary/transition | Publication API | CORRECTED |
| AI Job, AI Result, AI Review | Data Dictionary job/result; review evidence mapping | WF-003 | AI schema/job contracts | PASS |
| Exception/System Error | `EXCEPTION.*` mapping | WF-012 | error/job/publication APIs | CORRECTED |
| Audit Event | `AUDIT_EVENT.*` lifecycle | status/transition rule | Admin/Audit API | CORRECTED |

`CANDIDATE`는 authority class, `VERIFIED`는 valid `VERIFICATION.VERIFIED`의 scoped authority, `CLIENT_SHAREABLE`은 derived eligibility, `PUBLISHED`는 `PUBLICATION.PUBLISHED`의 external exposure class다. Bare term은 state transition value가 아니다.

## 3. Entity consistency

Data Dictionary는 54개 unique canonical entities를 포함하고 duplicate entity name은 0개다. Workflow aggregate와 API Registry의 모든 entity reference를 exact Data Dictionary name에 대조했다.

누락되어 있던 기존 계약 entity 4개를 교정 등록했다.

| Entity | Existing evidence before correction | Canonical context |
|---|---|---|
| Intake | Manual Intake workflow, Source/Intake API, Module output | Source and Intake |
| Contact Case | `CONTACT_CASE.*`, Contact API route | Contact and Organization |
| Client Proposal | WF-008, `PROPOSAL.*`, Publication API | Publication/client sharing |
| Publication Approval | WF-009, `PUBLICATION_APPROVAL.*`, Publication Model/API | Publication |

Published Listing은 별도 canonical entity가 아니라 confirmed Publication의 derived view로 명시했고, publication history는 Status History/Audit Event를 사용한다.

## 4. Workflow consistency

| Workflow | Canonical entities | API capabilities | AI / approval boundary |
|---|---|---|---|
| WF-001 Discovery | Source Registry, Raw Source | API-003/004/018 | N/A; policy reviewer |
| WF-002 Manual Intake | Intake, Raw Source, Candidate Listing | API-004/005 | AI-001/002 support; Senior Agent draft decision |
| WF-003 AI Processing | AI Job, AI Result, Intake | API-004/017/019 | AI-001–007 advisory; human AI review |
| WF-004 Duplicate Review | Duplicate Group, Candidate Listing | API-005/006 | AI-003 advisory; human disposition |
| WF-005 Requirement | Requirement, Requirement History | API-008/009 | AI-004/006/007 advisory; Agent activation |
| WF-006 Matching | Match Result, Requirement | API-010/017 | AI-005–007 advisory; human shortlist disposition |
| WF-007 Contact/Verification | Contact Case, Verification, Permission | API-007/011/012 | human verifier/permission reviewer |
| WF-008 Client Proposal | Client Proposal, Match Result, Permission | API-013 | human sharing approval |
| WF-009 Publication Approval | Publication Approval, Approval History | API-013 | independent human approver |
| WF-010 Publication | Publication, Publication Target, Status History | API-014/018/019 | connector delivers; reconciler confirms |
| WF-011 Expiration/Reverification | Reverification Request, Verification, Permission | API-011/012/014/017 | scheduler restricts; human renews |
| WF-012 Exception/Recovery | System Error, Audit Event | API-014/016–019 | named owner/recovery authority |

모든 workflow가 entity와 API에 연결되며 AI/approval이 적용되지 않는 경우도 deterministic/human boundary가 명시된다.

## 5. API consistency

API Registry에는 API-001–019가 각각 한 번 존재하고 owner document, logical operation, WF mapping, entity mapping, AI/N/A와 authority가 모두 채워져 있다. Workflow coverage는 12/12, AI coverage는 7/7, unknown entity mapping은 0이다. Authentication, authorization, Verification, Permission과 Approval은 서로 대체하지 않는다.

## 6. AI consistency

| AI capability | Workflow | Entity | API | Schema / validation / review / audit |
|---|---|---|---|---|
| AI-001 Listing parsing | WF-002/003 | AI Job/Result, Intake, Candidate | API-004/006/017–019 | Listing Parser schema + AI-007 + human review + trace |
| AI-002 Property normalization | WF-003 | AI Job/Result, Property/Alias | API-004–006/017–019 | normalization schema + ambiguity review |
| AI-003 Duplicate detection | WF-004 | Duplicate Group, AI Result | API-006/017–019 | duplicate schema + human disposition |
| AI-004 Requirement parsing | WF-005 | Requirement, AI Result | API-009/017/019 | requirement schema + human activation |
| AI-005 Matching/ranking | WF-006 | Match Result, AI Result | API-010/017/019 | matching schema + human shortlist review |
| AI-006 Search interpretation | WF-005/006 | Requirement/Property/Match projections | API-005/009/010/017/019 | search schema; requested result class is non-authoritative |
| AI-007 Confidence/validation | WF-003–006 cross-cutting | AI Result | applicable domain APIs/017–019 | confidence schema + deterministic validation + human review |

모든 capability가 JSON Schema, validation, human review, audit 및 fallback 원칙을 가지며 orphan capability는 0이다.

## 7. Registry consistency

| Registry | Defined | Duplicate | Orphan reference |
|---|---:|---:|---:|
| Document Registry | 140 after Phase 7.5 registration | 0 | 0 |
| Workflow Registry | 12 | 0 | 0 |
| API Registry | 19 | 0 | 0 |
| AI Capability Registry | 7 | 0 | 0 |
| Database capability set | 15 | 0 | 0 |
| Constitutional requirements | 13 | 0 | 0 |
| Decision Register | DEC-001–045 | 0 | 0 |
| Change Register | CR-001–010 after registration | 0 | 0 |
| ADR Register | ADR-001–006 | 0 | 0 |

## 8. Naming consistency

Active documentation의 legacy A-series labels for Phases 4–7을 `Phase 4`, `Phase 5`, `Phase 6`, `Phase 7`로 교정했다. Historical review H1 titles와 filenames는 변경하지 않았다. Post-correction exact scan 결과 legacy token은 0개다.

## 9. Publication consistency

Canonical state set은 다음 11개다.

`PUBLICATION.DRAFT_REPRESENTATION`, `PUBLICATION.APPROVAL_PENDING`, `PUBLICATION.APPROVED`, `PUBLICATION.DELIVERY_PENDING`, `PUBLICATION.PUBLISHED`, `PUBLICATION.UNKNOWN`, `PUBLICATION.FAILED`, `PUBLICATION.SUSPENDED`, `PUBLICATION.CORRECTION_PENDING`, `PUBLICATION.WITHDRAWAL_PENDING`, `PUBLICATION.WITHDRAWN`.

Publication Model, Data Dictionary, Publication Workflow, Status Dictionary, State Transition Rules와 Publication API 각각에 11/11이 존재한다. `SUSPENDED`는 internal fail-closed hold이며 external removal confirmation이 아니다. Approval rejection은 `PUBLICATION_APPROVAL.REJECTED`이고 Publication에 별도 `REJECTED` state를 만들지 않는다.

## 10. Traceability verification

| Requirement theme | Workflow | Entity/DB | API | AI | Test placeholder | Phase |
|---|---|---|---|---|---|---|
| REQ-CONST-001/008 AI advisory | WF-003–006 | AI Job/Result; DB-005/010/014 | API-004/006/009/010/017/019 | AI-001–007 | PLANNED — Book 10 authority tests | Phase 5–7 defined |
| REQ-CONST-002 human approval | WF-007–010 | Verification/Permission/Approval; DB-003–006 | API-011–014 | N/A — AI cannot approve | PLANNED — approval bypass tests | Phase 6–7 defined |
| REQ-CONST-003/004 publication gates | WF-009/010 | Publication Approval/Publication; DB-006 | API-013/014/018/019 | N/A | PLANNED — publication gate tests | Phase 6–7 defined |
| REQ-CONST-005 provenance | WF-001–012 | Raw Source/Provenance/Audit; DB-002 | API-004–019 applicable | AI outputs carry input/version trace | PLANNED — lineage tests | Phase 4–7 defined |
| REQ-CONST-007 audit | WF-001–012 | Audit Event/history; DB-004/009 | API-001–019 | AI job/result trace | PLANNED — audit completeness tests | Phase 4–7 defined |
| REQ-CONST-009 connector isolation | WF-001–004/009–012 | Source/Publication/System Error | API-018/019 | advisory after intake only | PLANNED — connector bypass tests | Phase 3–7 defined |
| REQ-CONST-010 least privilege | all | User/Role/Assignment/User Action | API-001/002/015/016 | N/A | PLANNED — role matrix tests | Phase 7 defined |
| REQ-CONST-011–013 authority separation | WF-002/007–010 | Candidate/Verification/Permission/Publication | API-004–014 | advisory only | PLANNED — state separation tests | Phase 4–7 defined |

Test와 delivery Phase ID는 Book 10/12가 아직 생성되지 않아 invalid placeholder ID를 발급하지 않고 `PLANNED` + owning future Book으로 표시했다. 현재 정의된 chain에는 broken target 또는 orphan ID가 없다.

## Review conclusion

확인된 correctable inconsistency는 [Phase 7.5 Corrections](PHASE7_5_CORRECTIONS.md)에 반영됐다. 남은 항목은 미정 policy/vendor/numeric detail이며 현재 cross-phase naming, entity, status, workflow, API, AI 또는 registry conflict가 아니다.
