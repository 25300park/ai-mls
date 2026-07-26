# Phase 11-11 Registry Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-061 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Quality Owner |
| 기준일 | 2026-07-26 |

## 1. Matrix legend

| Code | Meaning |
|---|---|
| V | reciprocal mapping과 governance evidence가 VERIFIED |
| P | structural mapping은 있으나 current status/conflict 때문에 PARTIALLY_VERIFIED |
| O | one direction만 명시되어 reciprocal mapping 미완료 |
| — | self 또는 required direct edge가 아님 |

Registry 약어: `DR` Decision, `RTM` Traceability, `PR` Publication, `WR` Workflow, `AR` API, `SR` Security, `PJR` Projection, `ER` Event, `OR` Operations, `TR` Test.

## 2. Required chain matrix

| Edge | Source evidence | Reverse evidence | Status | Gap |
|---|---|---|---|---|
| Decision ↔ RTM | DR decision/trace references | RTM AO/DEC mappings | V | none |
| RTM ↔ Publication | RTM PR mapping in aligned requirement rows | PR RTM mapping | P | RTM/PR rows retain partial status |
| Publication ↔ Workflow | PR WF mapping | WR Publication mapping | P | PR mapping status partial |
| Workflow ↔ API | WR API mapping | AR Workflow mapping | P | WR mapping status partial |
| API ↔ Security | AR Security mapping | SR API mapping | P | AR mapping status partial |
| Security ↔ Projection | SR Projection mapping | PJR Security mapping | V | none |
| Projection ↔ Event | PJR Event mapping | ER Projection mapping | V | none |
| Event ↔ Operations | ER has no canonical OR mapping | OR Event mapping | O | missing Event→Operations reciprocal mapping |
| Operations ↔ Test | OR cross-reference uses frozen Book 10 only; no canonical TR mapping row | TR Operations mapping | O | missing Operations→canonical Test reciprocal mapping; OPS conflict |

Result: 9/9 structural edges, 3 `V`, 4 `P`, 2 `O`. Brief의 no-partial rule에 따라 6/9 edge가 completion blocker다.

## 3. Registry-to-Decision trace

| Registry | Decision evidence | Status |
|---|---|---|
| Decision Register | canonical decision rows | V |
| RTM | AO/DEC columns and Decision Trace Matrix | V |
| Publication Registry | DEC-100~112 mapping | V |
| Workflow Registry | DEC-100/101/104~112 mapping | V |
| API Registry | DEC-100/104~108/110~112 mapping | V |
| Security Registry | DEC-100/103~112 mapping | V |
| Projection Registry | DEC-112 primary, DEC-100~111 constraints | V |
| Event Registry | DEC-112 primary, DEC-100~111 constraints | V |
| Operations Registry | DEC-059~067/073/090 and AO-023~035 constraints | V |
| Test Registry | TST-001/002 and Decision Trace evidence | V |

Decision trace coverage는 10/10이다.

## 4. Pairwise reference matrix

| From / To | DR | RTM | PR | WR | AR | SR | PJR | ER | OR | TR |
|---|---|---|---|---|---|---|---|---|---|---|
| DR | — | V | V | V | V | V | V | V | V | V |
| RTM | V | — | P | V | V | V | V | V | P | P |
| PR | V | V | — | P | P | P | V | V | P | P |
| WR | V | V | V | — | P | P | V | V | P | P |
| AR | V | V | V | V | — | P | V | V | P | P |
| SR | V | V | V | V | V | — | V | V | P | P |
| PJR | V | V | V | V | V | V | — | V | P | P |
| ER | V | V | V | V | V | V | V | — | O | P |
| OR | V | V | V | V | V | V | V | V | — | O |
| TR | V | V | V | V | V | V | V | V | P | — |

이 표의 non-chain cell은 direct mapping table, row-level reference 또는 TST cross-validation evidence 중 하나 이상을 나타낸다. `P`는 missing이 아니라 partial status/conflict를, `O`는 reciprocal direct mapping 부재를 뜻한다.

## 5. Consistency dimension matrix

| Registry | Identity | Ownership | Authority | Lifecycle | Version | Classification | Mapping | Traceability |
|---|---|---|---|---|---|---|---|---|
| Decision | V | V | V | P | V | N/A | V | V |
| RTM | V | V | V | V | V | N/A | P | P |
| Publication | V | V | V | V | V | V | P | P |
| Workflow | V | V | V | V | V | V | P | P |
| API | V | V | V | V | V | V | P | P |
| Security | V | V | V | V | V | V | P | P |
| Projection | V | V | V | V | V | V | V | V |
| Event | V | V | V | V | V | V | O | P |
| Operations | P | V | P | P | V | V | O | P |
| Test | V | V | V | V | V | V | P | P |

Decision lifecycle `P`는 DEC-096~099의 legacy `ACCEPTED`, Operations identity/authority/lifecycle `P`는 Phase 11-9 unresolved vocabulary 때문이다.

## 6. Authority matrix

| Actor/component | Read | Validate | Business decision | Business mutation/effect | Technical operation | Result |
|---|---|---|---|---|---|---|
| Canonical Aggregate | own state | invariants | via authorized human decision input | yes, through owning command/workflow | no implicit operations authority | CONSISTENT |
| Approved Workflow | context | guards/revalidation | no independent decision | orchestrates authorized command only | may request bounded operation | CONSISTENT |
| Authorized Command API | scoped | contract/authorization | no independent decision | invokes owning Aggregate | bounded technical handoff | CONSISTENT |
| Authorized Human Operator | scoped | evidence | only role/purpose/SoD-approved decision | only allowed command | scoped operation | CONSISTENT |
| Projection | scoped derived read | drift | prohibited | prohibited | rebuild target only | CONSISTENT |
| Event / Replay | event read | order/version | prohibited | prohibited | authorized replay only | CONSISTENT |
| Operations | scoped | yes | prohibited | prohibited outside owning business command | deploy/rollback/backup/restore/replay/rebuild/recover/monitor intended | PARTIAL — Deploy/Rollback vocabulary |
| Test / Evidence | evidence read | yes | prohibited | prohibited | no production operation | CONSISTENT |

## 7. Matrix conclusion

`MODIFY_AND_REVIEW`

Required edge가 모두 문서상 존재하더라도 partial 또는 one-way edge는 Brief의 reciprocal/no-partial 완료 조건을 충족하지 않는다.
