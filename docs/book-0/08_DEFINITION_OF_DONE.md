# Definition of Done

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-034 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](00_PROJECT_CONSTITUTION.md) |

“Done”은 작업량이 아니라 검증된 outcome과 evidence를 의미한다. `CRITICAL` 또는 `HIGH` finding이 열려 있거나 constitutional requirement를 충족하지 못하면 어떤 범주도 Done으로 표시할 수 없다.

## Document Done

| ID | Measurable acceptance criterion | Required evidence |
|---|---|---|
| DOD-DOC-001 | permanent Document ID, v0.1+ version, lifecycle status, owner/date가 있다. | metadata와 Master Index registry |
| DOD-DOC-002 | required section과 scope/non-goal이 모두 있다. | brief-to-heading check |
| DOD-DOC-003 | Glossary/naming과 constitutional IDs를 일관되게 사용한다. | terminology/ID scan |
| DOD-DOC-004 | normative dependency와 related document의 상대 link가 유효하다. | link validation |
| DOD-DOC-005 | assumption, risk, decision, open question과 `POST-MVP`가 명시된다. | register/reference review |
| DOD-DOC-006 | Review Checklist에서 applicable row가 PASS이고 N/A에는 rationale가 있다. | review report |
| DOD-DOC-007 | required approval과 revision evidence가 fixed version에 연결된다. | Approval Workflow evidence |

## Architecture Done

| ID | Measurable acceptance criterion | Required evidence |
|---|---|---|
| DOD-ARCH-001 | responsibility, boundary, input/output, authority와 failure behavior가 정의된다. | architecture spec/diagram |
| DOD-ARCH-002 | alternatives, decision, risk/assumption, security/privacy와 rollback impact가 기록된다. | ADR/Decision/CR links |
| DOD-ARCH-003 | constitutional requirement 위반이 없고 connector/AI bypass가 없다. | compliance matrix/negative review |
| DOD-ARCH-004 | business goal부터 test/phase/release까지 trace route가 정의된다. | trace matrix |
| DOD-ARCH-005 | ARB와 required specialist/business/user review가 완료된다. | approval records |
| DOD-ARCH-006 | 모든 diagram과 contract가 terminology/state/cardinality에서 일치한다. | consistency validation |

## Development Done

향후 coding phase에 적용하며 현재 A1에서는 구현을 요구하지 않는다.

| ID | Measurable acceptance criterion | Required evidence |
|---|---|---|
| DOD-DEV-001 | approved phase scope와 architecture/trace ID만 구현했다. | change mapping |
| DOD-DEV-002 | build, lint, type/static checks가 성공한다. | reproducible command output |
| DOD-DEV-003 | required unit/integration/security test가 성공하고 regression이 없다. | test report |
| DOD-DEV-004 | secret/sensitive fixture가 없고 dependency/security finding이 gate를 통과한다. | scans/review |
| DOD-DEV-005 | migration/config/rollback/observability 영향이 문서화되고 검증된다. | operational evidence |
| DOD-DEV-006 | code review finding이 해결되고 behavior 문서가 갱신된다. | review/change links |

## Feature Done

| ID | Measurable acceptance criterion | Required evidence |
|---|---|---|
| DOD-FEAT-001 | business purpose, owner, user/role, in/out scope와 acceptance criteria가 충족된다. | requirement/UAT evidence |
| DOD-FEAT-002 | normal, empty, error, unauthorized와 correction path가 검증된다. | scenario tests |
| DOD-FEAT-003 | data provenance, audit, retention, privacy와 permission impact가 검증된다. | control tests |
| DOD-FEAT-004 | AI 사용 시 validation, confidence, human review, evaluation과 fallback이 검증된다. | AI evaluation report |
| DOD-FEAT-005 | accessibility/mobile/operational behavior 등 applicable quality criteria를 통과한다. | checklist evidence |
| DOD-FEAT-006 | metric/telemetry와 rollback 또는 disable path가 있다. | dashboard/runbook evidence |

## Phase Done

| ID | Measurable acceptance criterion | Required evidence |
|---|---|---|
| DOD-PHASE-001 | prerequisites와 in/out scope가 충족되고 다음 phase 기능을 선행하지 않았다. | phase scope comparison |
| DOD-PHASE-002 | 포함 feature/development/document Done criteria가 모두 충족된다. | aggregated checklist |
| DOD-PHASE-003 | database/API/UI/AI/security/test 영향이 승인 scope와 trace된다. | phase trace matrix |
| DOD-PHASE-004 | test/build/validation과 acceptance evidence가 재현 가능하다. | evidence bundle |
| DOD-PHASE-005 | risk, known limitation, rollback과 follow-up owner가 기록된다. | completion report |
| DOD-PHASE-006 | completion report를 생성하고 사용자 gate에서 중단한다. | `PHASE_*_COMPLETION.md` |

## Release Done

| ID | Measurable acceptance criterion | Required evidence |
|---|---|---|
| DOD-REL-001 | included scope와 모든 Document ID/version/path/checksum이 고정된다. | release manifest |
| DOD-REL-002 | required approvals, release notes와 change/decision/ADR disposition이 있다. | approval/release records |
| DOD-REL-003 | constitutional, security/privacy, quality와 traceability gate가 통과된다. | review summary |
| DOD-REL-004 | critical/high finding과 unresolved critical decision이 없다. | issue/open-decision register |
| DOD-REL-005 | deployment/rollback/backup/restore/monitoring evidence가 applicable scope에서 준비된다. | operational readiness report |
| DOD-REL-006 | archive, retention과 previous release supersession이 기록된다. | archive/release policy evidence |

## Evidence quality rules

- evidence는 대상 Document/Requirement/Test/Phase/Release ID와 version을 식별한다.
- 단순 “완료” 주장이나 screenshot 하나는 검증 가능한 evidence가 아니다.
- waived/deferred item은 approver, rationale, risk, expiry/target version을 가진다.
- evidence가 stale하거나 candidate가 변경되면 affected validation/approval을 재수행한다.

## Constitutional bindings

모든 `REQ-CONST-001`–`REQ-CONST-013`은 applicable Done gate에서 trace되고 검증되어야 한다.

> **OPEN DECISION:** quantitative coverage/performance/accessibility threshold와 evidence retention period는 Book 7, 9, 10, 11에서 확정한다.
