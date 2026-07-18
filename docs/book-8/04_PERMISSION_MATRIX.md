# Permission Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-SEC-005 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security Owner / Business Owner |
| 기준일 | 2026-07-14 |

## Purpose and interpretation

모든 security role, UI-001–037, API-001–019와 requested operation의 logical grant baseline을 정의한다. 모든 허용은 authenticated principal, active assignment, resource/team/purpose scope, current workflow state/version, MFA/SoD와 audit 조건을 충족할 때만 유효하다.

`S` = scoped allow, `R` = scoped read only, `E` = pre-authorized non-human execution only, `P` = privileged scoped allow requiring MFA/reason/audit, `—` = deny, `POST` = `POST-MVP` and not currently granted.

## Canonical roles

| Code | Role | Boundary |
|---|---|---|
| COL | Collector | approved source/intake only |
| AGT | Agent | assigned client/listing work; no independent authority approval |
| SAG | Senior Agent | agent work + proposal/business review; no Verification/Permission/Publication approval inheritance |
| REV | Reviewer | dashboard/assigned-review navigation shell; no standalone disposition or approval capability |
| AIR | AI Reviewer | AI Result correction/disposition only |
| DUR | Duplicate Reviewer | duplicate disposition only |
| VER | Verifier | assigned evidence-based Verification only |
| PMR | Permission Reviewer | purpose/field/audience/expiry Permission only |
| PUA | Publication Approver | exact representation approval only |
| MGR | Manager | scoped oversight/escalation; no subordinate action inheritance |
| DST | Data Steward | property/source/listing master proposals/decisions |
| OPS | Operations/Publication Owner | job, exception, delivery/reconciliation; no approval creation |
| SEC | Security/Privacy/Audit Owner | audit, investigation, security/privacy control |
| ADM | Administrator | identity/role/policy administration; no business approval |
| SVC | Service/Connector Identity | non-human API execution; no interactive UI/human authority |
| EXT | Future External Partner | `POST-MVP`, contract-scoped contribution only |

## Role-to-operation matrix

| Role | View | Create | Edit | Delete | Verify | Approve | Publish | Export | AI Review | Admin |
|---|---|---|---|---|---|---|---|---|---|---|
| COL | S | S | S | — | — | — | — | — | — | — |
| AGT | S | S | S | — | — | — | — | S | — | — |
| SAG | S | S | S | — | — | S — proposal only | — | S | — | — |
| REV | R | — | — | — | — | — | — | — | — | — |
| AIR | S | — | S — AI correction | — | — | — | — | — | S | — |
| DUR | S | — | S — disposition | — | — | — | — | — | — | — |
| VER | S | S | S | — | S | — | — | — | — | — |
| PMR | S | S | S | — | — | S — permission only | — | — | — | — |
| PUA | S | S | S | — | — | S — publication only | — | — | — | — |
| MGR | R | — | — | — | — | — | — | S | — | — |
| DST | S | S | S | — | — | — | — | S | — | — |
| OPS | S | S | S | — | — | — | S — approved delivery only | S | — | — |
| SEC | P | — | P — security disposition | — | — | — | — | P | — | P — security only |
| ADM | P | P | P | — | — | — | — | P — admin evidence only | — | P |
| SVC | E | E | E | — | — | — | E — approved command only | — | — | — |
| EXT | POST | POST | POST | — | — | — | — | — | — | — |

Delete는 default deny다. Privacy deletion/retention은 API-015/017의 governed disposition이며 row-level delete grant가 아니다.

## Screen permission matrix

| Screen | Allowed roles | View | Create | Edit | Delete | Verify | Approve | Publish | Export | AI Review | Admin |
|---|---|---|---|---|---|---|---|---|---|---|---|
| UI-001 Sign In | all human roles; EXT POST | S | — | — | — | — | — | — | — | — | — |
| UI-002 Collector Dashboard | COL, MGR, SEC | S | — | — | — | — | — | — | — | — | — |
| UI-003 Agent Dashboard | AGT, SAG, MGR, SEC | S | — | — | — | — | — | — | — | — | — |
| UI-004 Reviewer Dashboard | REV, AIR, DUR, VER, PMR, PUA, MGR, SEC | S | — | — | — | — | — | — | — | — | — |
| UI-005 Manager Dashboard | MGR, SEC | S | — | — | — | — | — | — | S | — | — |
| UI-006 Administrator Dashboard | ADM, SEC | P | — | — | — | — | — | — | P | — | P |
| UI-007 Future External Partner Dashboard | EXT | POST | POST | POST | — | — | — | — | — | — | — |
| UI-008 Global Search | AGT, SAG, MGR, DST, SEC, ADM | S | — | — | — | — | — | — | S | — | — |
| UI-009 Source Registry | COL, DST, ADM, SEC | S | S | S | — | — | — | — | S | — | P ADM |
| UI-010 Discovery Queue | COL, SAG, DST, MGR | S | S | S | — | — | — | — | — | — | — |
| UI-011 Manual Intake | COL, SAG, DST | S | S | S | — | — | — | — | — | — | — |
| UI-012 Intake Review | SAG, DST | S | S | S | — | — | S — candidate registration | — | — | — | — |
| UI-013 AI Review Queue | AIR, SAG, SEC | S | — | S | — | — | — | — | — | S | — |
| UI-014 Candidate List | AGT, SAG, DUR, VER, MGR, DST | S | — | — | — | — | — | — | S scoped | — | — |
| UI-015 Candidate Detail | AGT, SAG, DUR, VER, DST | S | S | S | — | — | — | — | S scoped | — | — |
| UI-016 Duplicate Review | DUR, DST | S | — | S | — | — | — | — | — | — | — |
| UI-017 Property Master Search | AGT, SAG, DST, MGR | S | S proposal | S proposal | — | — | — | — | S scoped | — | — |
| UI-018 Property Detail | DST, AGT, SAG | S | S | S | — | — | — | — | S scoped | — | — |
| UI-019 Contact List | AGT, SAG, VER, PMR, SEC | S masked | — | — | — | — | — | — | P SEC only | — | — |
| UI-020 Contact Detail and Case | AGT, SAG, VER, SEC | S purpose | S | S | — | — | — | — | P SEC only | — | — |
| UI-021 Client List | AGT, SAG, MGR, SEC | S | S | S | — | — | — | — | S scoped | — | — |
| UI-022 Client Detail | AGT, SAG, MGR, SEC | S | S | S | — | — | — | — | S scoped | — | — |
| UI-023 Requirement Editor | AGT, SAG | S | S | S | — | — | S — activation only | — | — | — | — |
| UI-024 Matching Workspace | AGT, SAG, MGR | S | S request | S shortlist | — | — | S — shortlist only | — | S scoped | — | — |
| UI-025 Client Proposal | AGT, SAG, PMR | S | S | S | — | — | S SAG — share only | — | S scoped | — | — |
| UI-026 Verification Queue | VER, PMR, MGR, SEC | S | S request | S assignment | — | — | — | — | P SEC only | — | — |
| UI-027 Verification Detail | VER, PMR, SEC | S | S | S | — | S VER | — | — | P SEC only | — | — |
| UI-028 Permission Review | PMR, VER, SEC | S | S | S | — | — | S PMR | — | P SEC only | — | — |
| UI-029 Publication Approval Queue | PUA, MGR, SEC | S | — | — | — | — | — | — | P SEC only | — | — |
| UI-030 Publication Approval Detail | PUA, SEC | S | S decision | S rationale | — | — | S PUA | — | P SEC only | — | — |
| UI-031 Publication Operations | OPS, PUA, MGR, SEC | S | S command | S reconcile | — | — | — | S OPS after approval | P SEC/OPS | — | — |
| UI-032 Expiration and Reverification | AGT, SAG, VER, PMR, OPS, SEC | S | S request | S | — | S VER | S PMR | — | P SEC only | — | — |
| UI-033 Exception Recovery | OPS, SEC, ADM | P | S | P | — | — | S accepted-risk only | — | P | — | P scoped |
| UI-034 Background Jobs | OPS, ADM, SEC | P | S | S cancel/successor | — | — | — | E approved command | P | — | P scoped |
| UI-035 Audit Explorer | SEC, ADM, MGR limited | P | — | — | — | — | — | — | P | — | P SEC |
| UI-036 Role and Policy Administration | ADM, SEC | P | P | P | — | — | S independent policy approver | — | P | — | P |
| UI-037 Notification Center | all human roles; EXT POST | S | — | S acknowledge | — | — | — | — | — | — | — |

SVC는 interactive screen 37개 모두 `—`다. Service/connector는 API matrix의 `E`만 사용한다.

REV는 navigation/read shell이며 actual review action은 AIR/DUR/VER/PMR/PUA 중 explicit assignment가 추가로 있어야 한다. Tenant, Buyer, Owner와 Developer persona는 현재 authenticated internal role이 아니며 Contact/Client/Organization entity로 처리한다. External portal role은 별도 승인 전 `POST-MVP`다.

## API permission matrix

| API | Allowed roles | View | Create | Edit | Delete | Verify | Approve | Publish | Export | AI Review | Admin |
|---|---|---|---|---|---|---|---|---|---|---|---|
| API-001 Authentication/session | all human, SVC; EXT POST | S | S session | S refresh | — | — | — | — | — | — | P ADM revoke |
| API-002 Authorization decision | all authenticated, SVC | S own decision | — | — | — | — | — | — | — | — | P SEC/ADM policy |
| API-003 Source registry | COL, DST, ADM, SEC, SVC | S | S proposal | S | — | — | S ADM/DST policy | — | P SEC | — | P ADM |
| API-004 Manual/source intake | COL, SAG, DST, AIR, SVC; EXT POST | S | S | S | — | — | S SAG registration | — | — | S AIR | — |
| API-005 Property master | AGT, SAG, DST, MGR, SVC | S | S proposal | S DST | — | — | S DST master decision | — | S scoped | — | — |
| API-006 Candidate/offer/duplicate | AGT, SAG, DUR, DST, VER, SVC | S | S | S | — | — | S DUR disposition | — | S scoped | S AIR support | — |
| API-007 Contact/communication | AGT, SAG, VER, PMR, SEC | S purpose | S | S | — | — | — | — | P SEC | — | — |
| API-008 Client relationship | AGT, SAG, MGR, SEC | S | S | S | — | — | — | — | S scoped | — | — |
| API-009 Requirement lifecycle | AGT, SAG, AIR, SVC | S | S | S | — | — | S AGT activation | — | S scoped | S AIR | — |
| API-010 Matching | AGT, SAG, MGR, AIR, SVC | S | S request | S shortlist | — | — | S AGT shortlist | — | S scoped | S AIR | — |
| API-011 Verification | VER, PMR, AGT request, SEC | S | S request | S | — | S VER | — | — | P SEC | — | — |
| API-012 Permission | PMR, VER read, AGT request, PUA read, SEC | S | S request | S | — | — | S PMR | — | P SEC | — | — |
| API-013 Proposal/publication approval | AGT, SAG, PMR read, PUA, SEC | S | S request | S | — | — | S SAG/PUA by decision type | — | P SEC | — | — |
| API-014 Publication delivery | OPS, PUA read, SEC, SVC | S | E/S command | S reconcile | — | — | — | S/E after approval | P SEC/OPS | — | — |
| API-015 Administration | ADM, SEC, policy owners | P | P | P | — | — | S independent owner | — | P | — | P |
| API-016 Audit/history | SEC, ADM, MGR limited, domain owner limited | P/R | — | — | — | — | — | — | P | — | P SEC |
| API-017 Background jobs | OPS, ADM, domain owner, SVC | S | S/E | S cancel/successor | — | — | — | E approved work | P OPS/SEC | — | P ADM |
| API-018 Connector boundary | OPS, ADM, SEC, SVC; EXT POST | S | E/S | E/S | — | — | — | E approved delivery | P SEC | — | P ADM |
| API-019 External integration | OPS, ADM, SEC, SVC; EXT POST | S | P/E | P/E | — | — | S owners contract | E approved work | P SEC | — | P ADM |

## Separation-of-duties rules

1. Subject creator/editor는 같은 exact version의 Publication Approver가 될 수 없다.
2. Verification, Permission, client proposal approval, publication approval와 publication delivery는 서로 대체하지 않는다.
3. Role/permission grant proposer와 approver를 분리하고 emergency grant는 Security Owner review가 필요하다.
4. Export requester와 high-risk restricted export approver를 분리할 수 있으며 threshold는 `OPEN DECISION`이다.
5. MGR/ADM/SEC의 oversight는 domain business mutation을 암묵 허용하지 않는다.

## Permission decision and audit

Every allow/deny는 policy version과 applied scope를 가지며 privileged allow는 MFA, reason, correlation ID와 Audit Event를 요구한다. Matrix 변경은 CR/Decision, security/business owner review, impact analysis와 access recertification을 거친다.
