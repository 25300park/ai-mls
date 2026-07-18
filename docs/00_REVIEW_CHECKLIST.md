# Documentation Review Checklist

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-018 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |

모든 Book과 control document는 동일한 quality gate를 통과한다. reviewer는 적용 가능한 항목을 임의로 생략하지 않으며, 적용되지 않으면 `N/A`와 근거를 기록한다. review lifecycle은 [Document Governance](00_DOCUMENT_GOVERNANCE.md), 상세 finding 형식은 [Review Template](templates/REVIEW_TEMPLATE.md)을 따른다.

## 결과와 severity

| Result | 의미 |
|---|---|
| `PASS` | evidence로 충족 확인 |
| `FAIL` | 필수 조건 미충족 |
| `N/A` | 범위 밖이며 rationale 기록 |

| Severity | 의미 |
|---|---|
| `CRITICAL` | 외부 노출, 승인 우회, data loss, 법/정책 중대 위험 또는 source-of-truth 붕괴 가능 |
| `HIGH` | 핵심 workflow/architecture가 구현 불가능하거나 중요 trace가 끊김 |
| `MEDIUM` | 해석 차이, 운영·품질 저하 가능 |
| `LOW` | 국소적 명확성·유지보수 문제 |
| `EDITORIAL` | 의미를 바꾸지 않는 문체·표기 문제 |

`CRITICAL` 또는 `HIGH`가 열려 있으면 `APPROVED`/`FROZEN`으로 전환할 수 없다.

## Reusable review summary

| Review ID | Document ID | Version | Reviewer | Date | Result | Blocking Findings |
|---|---|---|---|---|---|---|
| REVIEW-XXX | DOC-DOMAIN-NNN | v0.1 | ROLE_OR_NAME | YYYY-MM-DD | PASS/FAIL/PASS WITH CONDITIONS | IDs 또는 None |

## Detailed checklist

| ID | Category | Review question | Evidence | Result | Finding ID |
|---|---|---|---|---|---|
| REV-BIZ-001 | Business | 목표, 사용자 가치와 measurable outcome이 명확한가? | heading/link | PASS/FAIL/N/A |  |
| REV-BIZ-002 | Business | MVP, `POST-MVP`, non-goal과 assumption이 구분되는가? | heading/link | PASS/FAIL/N/A |  |
| REV-ARCH-001 | Architecture | responsibility, boundary, input/output과 failure isolation이 명확한가? | heading/diagram | PASS/FAIL/N/A |  |
| REV-ARCH-002 | Architecture | AI recommends/human approves 및 connector isolation을 위반하지 않는가? | rule/diagram | PASS/FAIL/N/A |  |
| REV-DB-001 | Database | entity 의미, cardinality, key/constraint/index가 요구 수준에 맞게 설명되는가? | model/table | PASS/FAIL/N/A |  |
| REV-DB-002 | Database | provenance, retention, audit 및 duplicate를 손실 없이 표현하는가? | model/rule | PASS/FAIL/N/A |  |
| REV-WF-001 | Workflow | 정상·예외·correction path와 authorized role이 모두 정의되는가? | transition table | PASS/FAIL/N/A |  |
| REV-WF-002 | Workflow | verification과 permission/approval을 우회하는 전이가 없는가? | state diagram/table | PASS/FAIL/N/A |  |
| REV-API-001 | API | capability, authorization, validation, error, idempotency와 audit가 설명되는가? | contract table | PASS/FAIL/N/A |  |
| REV-API-002 | API | private core function 또는 publication control을 connector가 우회하지 않는가? | boundary/contract | PASS/FAIL/N/A |  |
| REV-UI-001 | UI | role, state, loading/empty/error, mobile과 accessibility가 정의되는가? | screen spec | PASS/FAIL/N/A |  |
| REV-UI-002 | UI | unverified data 구분, contact masking과 approval evidence가 보이는가? | screen/wireframe | PASS/FAIL/N/A |  |
| REV-AI-001 | AI | purpose, input/output, validation, confidence, fallback과 human review가 정의되는가? | AI spec | PASS/FAIL/N/A |  |
| REV-AI-002 | AI | AI가 authority state를 직접 변경하거나 permission을 추론하지 않는가? | boundary/rule | PASS/FAIL/N/A |  |
| REV-SEC-001 | Security | authentication, authorization, least privilege, secret과 audit 영향이 반영되는가? | control mapping | PASS/FAIL/N/A |  |
| REV-PRIV-001 | Privacy | contact/raw data classification, masking, minimization, retention과 deletion이 반영되는가? | privacy rule | PASS/FAIL/N/A |  |
| REV-DEP-001 | Deployment | environment, dependency, health, monitoring, backup, recovery와 rollback이 실행 가능한가? | ops spec | PASS/FAIL/N/A |  |
| REV-TERM-001 | Terminology | [Glossary](00_GLOSSARY.md)의 표준 용어를 일관되게 사용하는가? | term scan | PASS/FAIL/N/A |  |
| REV-NAME-001 | Naming | [Naming Convention](00_NAMING_CONVENTION.md)의 case와 artifact naming을 따르는가? | name scan | PASS/FAIL/N/A |  |
| REV-CONS-001 | Consistency | 본문, table, diagram, 다른 Book 사이에 모순이 없는가? | comparison | PASS/FAIL/N/A |  |
| REV-XREF-001 | Cross Reference | normative dependency가 유효한 상대 link와 Document ID로 연결되는가? | link check | PASS/FAIL/N/A |  |
| REV-OPEN-001 | Open Decisions | 모든 미결정에 `OPEN DECISION`, owner와 필요 시점이 있는가? | decision scan | PASS/FAIL/N/A |  |
| REV-VER-001 | Version | version/status/owner/date와 Version History가 governance에 맞는가? | metadata/history | PASS/FAIL/N/A |  |
| REV-DOCID-001 | Document IDs | ID가 유일하고 [Document ID Rule](00_DOCUMENT_ID_RULE.md) 및 Master Index와 일치하는가? | registry check | PASS/FAIL/N/A |  |
| REV-MMD-001 | Mermaid | diagram이 parse되고 [Mermaid Style Guide](00_MERMAID_STYLE_GUIDE.md)를 따르는가? | render/style check | PASS/FAIL/N/A |  |
| REV-EX-001 | Examples | example이 규칙과 일치하고 가상 값이며 final decision으로 오인되지 않는가? | example review | PASS/FAIL/N/A |  |
| REV-TRACE-001 | Traceability | 중요 requirement가 [Traceability Rule](00_TRACEABILITY_RULE.md)의 end-to-end chain을 갖는가? | trace matrix | PASS/FAIL/N/A |  |
| REV-RISK-001 | Risk | 새/변경 risk와 invalidated assumption이 register에 반영됐는가? | register link | PASS/FAIL/N/A |  |

## Finding disposition table

| Finding ID | Checklist ID | Severity | Description | Owner | Due/Phase | Disposition | Evidence |
|---|---|---|---|---|---|---|---|
| F-001 | REV-XXX-001 | CRITICAL/HIGH/MEDIUM/LOW/EDITORIAL |  |  |  | OPEN/ACCEPTED/RESOLVED/DEFERRED |  |

`ACCEPTED` 또는 `DEFERRED`는 승인 주체와 target version을 기록한다. 보안·개인정보·외부 publication 관련 CRITICAL finding은 acceptance만으로 freeze할 수 없다.

## Review completion gate

- 모든 checklist row에 result와 evidence 또는 `N/A` rationale가 있다.
- blocking finding이 없다.
- 새 risk, assumption, ADR와 `OPEN DECISION`이 관련 register에 연결된다.
- Document ID와 link 검사 결과가 첨부된다.
- reviewer와 approver 역할, 날짜, reviewed version이 기록된다.
