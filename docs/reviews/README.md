# Review Workspace

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-009 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |

이 디렉터리는 Brief completion report, architecture review, inconsistency register, correction 및 freeze evidence를 보존한다. 공통 review 형식은 [Review Template](../templates/REVIEW_TEMPLATE.md), 완료 보고 형식은 [Phase Completion Template](../templates/PHASE_COMPLETION_TEMPLATE.md)을 사용한다.

## Review 원칙

- reviewer는 대상, 기준, 발견사항, severity, 근거와 결론을 기록한다.
- 발견사항은 문서와 heading에 연결하고 owner와 disposition을 둔다.
- 승인된 문서를 review 중 임의로 수정하지 않는다. 변경은 [Document Governance](../00_DOCUMENT_GOVERNANCE.md)의 change control을 따른다.
- 숨은 결정 대신 `OPEN DECISION`, 가정은 `ASSUMPTION`, 미래 범위는 `POST-MVP`로 표시한다.
- completion report는 작업 결과와 검증을 기록할 뿐, 지정 approver의 승인을 대신하지 않는다.

## 파일 규칙

| 유형 | 파일명 |
|---|---|
| Brief 완료 | `<BRIEF>_COMPLETION.md` |
| 정식 review | `<REVIEW>_<SUBJECT>.md` |
| inconsistency register | `<REVIEW>_INCONSISTENCY_REGISTER.md` |
| open decisions | `<REVIEW>_OPEN_DECISIONS.md` |

## 현재 register

| 문서 | 목적 | 상태 |
|---|---|---|
| [A0 Completion](A0_COMPLETION.md) | Documentation Workspace Foundation 완료 증거 | FROZEN |
| [Phase 16 Freeze Validation](PHASE16_FREEZE_VALIDATION.md) | v1.0 file/ID/link/status/trace/registry/no-code validation | FROZEN |
| [Phase 16 Completion](PHASE16_COMPLETION.md) | Architecture Freeze v1.0 completion evidence | FROZEN |

전체 review document와 current lifecycle status의 authoritative registry는 [Master Index](../00_MASTER_INDEX.md)와 [Freeze Document Registry](../freeze/FREEZE_DOCUMENT_REGISTRY.md)다. Phase 14/15/16은 각각 legacy `R1`/`R2`/`F1`을 대체한다.
