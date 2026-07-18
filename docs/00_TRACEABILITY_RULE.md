# End-to-End Traceability Rule

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-019 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |

모든 중요한 requirement는 근거에서 test evidence까지 양방향으로 추적할 수 있어야 한다. traceability는 provenance와 audit log를 대체하지 않으며, 문서 identity는 [Document ID Rule](00_DOCUMENT_ID_RULE.md)을 따른다. End-to-end 연결의 단일 authoritative record는 [Canonical Traceability Matrix](00_CANONICAL_TRACEABILITY_MATRIX.md)다.

## Traceability chain

`Requirement → Workflow → Entity → API → Screen → AI Capability → Developer Task → Sprint → Release → Test`

각 단계가 적용되지 않으면 chain에서 생략하지 않고 `N/A`와 이유를 기록한다. 예를 들어 AI를 사용하지 않는 authorization rule은 AI 단계가 `N/A — deterministic application control`이다.

## Unique ID namespaces

| Artifact | ID format | 예 | 책임 문서 |
|---|---|---|---|
| Business Goal | `BG-NNN` | `BG-001` | Book 1; requirement의 upstream 근거 |
| Requirement | `REQ-<DOMAIN>-NNN` | `REQ-CONST-001` | Book 0 / Test traceability |
| Workflow | `WF-NNN` | `WF-001` | Book 5 |
| Entity | canonical entity name | `Publication` | Book 3 Data Dictionary |
| API capability | `API-NNN` | `API-001` | Book 6 |
| Screen | `UI-NNN` | `UI-001` | Book 7 |
| AI capability | `AI-NNN` | `AI-001` | Book 4 |
| Developer task | `DEV-NNN` | `DEV-001` | Book 11 |
| Sprint | `SP-NNN` | `SP-001` | Book 12 |
| Release | `REL-NNN` | `REL-001` | Roadmap/release record |
| Test scenario | `TEST-NNN` | `TEST-001` | Book 10 |
| Trace row | `TRACE-NNN` | `TRACE-001` | traceability matrix |

ID는 namespace 안에서 유일하고 발급 후 재사용하지 않는다. title, path 또는 version 변경 시 ID를 유지하며, 본질적 replacement는 새 ID와 `supersedes` 관계를 사용한다.

## Requirement ID rules

- domain code는 짧고 안정적인 책임 영역을 사용한다: `AUTH`, `SRC`, `PUB`, `PRIV`, `AI`.
- 한 requirement는 하나의 검증 가능한 의무만 담고 `shall`에 해당하는 명확한 표현을 사용한다.
- requirement metadata에는 owner, source Document ID, status, target version과 acceptance evidence를 둔다.
- architecture principle을 여러 requirement로 구현하면 각 requirement가 principle의 ID/Document ID를 역참조한다.

## Relationship rules

1. 모든 `REQ-*`는 최소 하나의 upstream `BG-*` 또는 constitutional source와 downstream `TEST-*`를 가진다.
2. workflow, entity, API, screen, AI artifact는 자신이 실현하는 requirement를 역참조한다.
3. `TEST-*`는 검증 대상 requirement와 expected evidence를 명시한다.
4. `DEV-*`는 전달할 requirement/artifact를, `SP-*`는 delivery order와 prerequisite를, `REL-*`은 included work와 accepted evidence를 연결한다.
5. 중요한 relationship에는 `implements`, `constrains`, `verifies`, `delivers`, `included-in`, `supersedes` 중 의미 있는 type을 기록한다.
6. 여러 대상을 comma-separated text로 숨기지 않고 matrix에서 별도 ID 또는 명시적 list로 연결한다.
7. 변경 또는 삭제 시 양방향 reference와 downstream impact를 함께 검토한다.
8. orphan ID, 존재하지 않는 target, cycle로만 근거가 형성된 requirement는 허용하지 않는다.

## Minimum trace record

| 필드 | 필수 내용 |
|---|---|
| Trace ID | `TRACE-NNN` |
| Source | upstream ID와 Document ID/path |
| Target | downstream ID와 Document ID/path |
| Relationship | 표준 relationship type |
| Rationale | 연결 이유 또는 `N/A` 이유 |
| Status | `PLANNED`, `DEFINED`, `VERIFIED`, `SUPERSEDED` |
| Evidence | review, test 또는 approval link |

## Canonical matrix format

| Trace ID | Requirement | Workflow | Entity | API | Screen | AI Capability | Developer Task | Sprint | Release | Test | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `TRACE-NNN` | `REQ-*` | `WF-*` | canonical entity | `API-*` | `UI-*` | `AI-*` 또는 reasoned `N/A` | `DEV-*` | `SP-*` | `REL-*` | `TEST-*` | `PLANNED/DEFINED/VERIFIED/SUPERSEDED` |

Placeholder example은 canonical ID와 충돌할 수 있으므로 사용하지 않는다. 실제 연결 example과 검증 대상은 [Canonical Traceability Matrix](00_CANONICAL_TRACEABILITY_MATRIX.md)의 승인된 `TRACE-*` 행이다.

## Change impact and validation

- requirement 변경 proposal은 연결된 workflow/entity/API/screen/AI/developer task/sprint/release/test를 impact list로 생성한다.
- [Review Checklist](00_REVIEW_CHECKLIST.md)은 missing link, orphan, invalid `N/A`, duplicate ID와 stale evidence를 검사한다.
- Phase 14 Architecture Review(`R1` legacy alias)와 Phase 15 Architecture Corrections(`R2` legacy alias)는 canonical matrix와 모든 CRITICAL workflow를 검증한다.
- freeze manifest에는 Document ID/version/path를 기록하고 trace matrix의 verified baseline을 연결한다.

Phase 15에서 단일 문서 방식이 승인되었으며, generated view를 도입하더라도 이 문서의 승인 baseline을 대체하려면 change request와 동일 수준의 검증이 필요하다.
