# Document ID Rule

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-016 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |

모든 Architecture Bible 문서는 경로, 제목과 version이 바뀌어도 유지되는 영구 identifier를 가진다. canonical ID registry는 [Master Index](00_MASTER_INDEX.md)이며, filename 규칙은 [Naming Convention](00_NAMING_CONVENTION.md)을 따른다.

## ID format

형식은 `DOC-<DOMAIN>-<NNN>`이다.

- `DOC`: 문서 identifier namespace
- `<DOMAIN>`: 아래의 고정 domain code
- `<NNN>`: domain 안에서 001부터 증가하는 세 자리 번호

ID는 대문자 ASCII와 hyphen만 사용하고, 발급한 번호는 삭제·대체 후에도 재사용하지 않는다.

| Domain code | 범위 | 예 |
|---|---|---|
| `CORE` | master, governance, glossary, 품질 foundation | `DOC-CORE-001` |
| `BIZ` | Book 1 business strategy | `DOC-BIZ-001` |
| `ARCH` | Book 2 system architecture | `DOC-ARCH-001` |
| `DATA` | Book 3 data architecture | `DOC-DATA-001` |
| `AI` | Book 4 AI architecture | `DOC-AI-001` |
| `WF` | Book 5 workflow/lifecycle | `DOC-WF-001` |
| `API` | Book 6 API/integration | `DOC-API-001` |
| `UI` | Book 7 UI/UX | `DOC-UI-001` |
| `SEC` | Book 8 security/privacy/compliance | `DOC-SEC-001` |
| `OPS` | Book 9 deployment/operations | `DOC-OPS-001` |
| `TEST` | Book 10 test/quality | `DOC-TEST-001` |
| `DEV` | Book 11 developer bible | `DOC-DEV-001` |
| `ROADMAP` | Book 12 roadmap | `DOC-ROADMAP-001` |
| `ADR` | Architecture Decision Record | `DOC-ADR-001` |
| `REVIEW` | completion, review, correction, freeze report | `DOC-REVIEW-001` |
| `FREEZE` | architecture baseline manifest, snapshot, summary와 freeze control | `DOC-FREEZE-001` |

Book 0 Project Constitution 문서는 project-wide precedence를 가지므로 `CORE` domain을 사용한다. domain은 folder가 아니라 내용의 책임 영역으로 선택한다.

## 발급과 표시

1. Author는 Master Index에서 해당 domain의 다음 미사용 번호를 확인한다.
2. ID를 먼저 reserve하고 문서 metadata의 `Document ID`에 기록한다.
3. Master Index에 ID, title, path, status/availability를 등록한다.
4. review에서 uniqueness, format과 registry 일치를 확인한다.

문서 상단 최소 metadata는 다음과 같다.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DOMAIN-NNN |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | ROLE |
| 기준일 | YYYY-MM-DD |

기존 A0 문서는 이번 foundation에서 Master Index registry로 ID를 부여한다. cross-reference 외 수정이 허용되는 다음 시점에 같은 ID를 header에 추가하되, registry 발급 시점부터 ID는 유효하고 변경하지 않는다.

## Version rule

- Document ID는 content identity이고 version과 독립이다.
- 동일 문서의 `v0.1 → v0.2 → v1.0` 변경은 같은 Document ID를 유지한다.
- version은 [Document Governance](00_DOCUMENT_GOVERNANCE.md)와 [Version History](00_VERSION_HISTORY.md)를 따른다.
- manifest는 Document ID, version, path와 checksum을 함께 기록한다.

## Rename and move rule

제목, filename 또는 directory 이동만으로 새 ID를 만들지 않는다. Master Index의 path와 변경 이력을 갱신하고 기존 link를 가능한 범위에서 보존한다.

## Replacement rule

문서의 책임이나 의미가 본질적으로 달라져 독립된 기준선이 필요하면 대체 문서에 새 ID를 발급한다. 새 문서는 `Supersedes: <old ID>`를, 이전 문서는 `Superseded by: <new ID>`를 기록한다. 단순 보완, 오탈자 또는 호환되는 명확화는 replacement가 아니다.

## Superseded rule

- 이전 문서 status를 `SUPERSEDED`로 전환하고 삭제하지 않는다.
- 대체 ID, path, 날짜, 승인 근거와 관련 ADR을 기록한다.
- `SUPERSEDED` 문서는 새로운 architecture의 source of truth로 사용하지 않지만 audit와 과거 release 재현을 위해 보존한다.
- 동결 문서를 대체하려면 [Document Governance](00_DOCUMENT_GOVERNANCE.md)의 post-freeze change control과 새 ADR이 필요하다.

## Cross-reference rule

중요한 normative reference는 가능한 경우 `Document Title (DOC-DOMAIN-NNN)`와 Markdown link를 함께 사용한다. ID만으로 의미를 추측하지 않으며 path만으로 identity를 판단하지 않는다.

requirement, workflow, database capability, API capability, test 등의 trace ID는 Document ID와 별도이며 [Traceability Rule](00_TRACEABILITY_RULE.md)을 따른다.

## 금지 사항

- 번호 재사용 또는 임의 renumbering
- version을 ID에 포함 (`DOC-ARCH-001-v2`)
- filename을 ID로 간주
- 한 파일에 복수 primary Document ID 부여
- 대체 관계 없이 같은 ID를 서로 다른 책임의 두 문서에 사용

> **OPEN DECISION:** 향후 자동 ID registry validator의 구현 방식은 Book 11에서 정한다. 현재는 Master Index review를 기준으로 한다.
