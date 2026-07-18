# Codex Working Rules

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-003 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 적용 범위 | 저장소 전체 |

## 작업 시작 규칙

1. 요청된 Brief와 관련된 기존 문서를 모두 읽는다.
2. 한 번에 요청된 Brief 하나만 수행한다.
3. 작업 전 현재 파일과 사용자 변경을 확인하고 보존한다.
4. 설명 문서는 한국어로, 기술 식별자·파일명·schema·code example은 영어로 작성한다.
5. 용어는 [Glossary](docs/00_GLOSSARY.md), 문서 절차는 [Document Governance](docs/00_DOCUMENT_GOVERNANCE.md)를 따른다.
6. 가정은 `ASSUMPTION`, 미결정은 `OPEN DECISION`, 미래 기능은 `POST-MVP`로 표시한다.
7. 초안 문서는 v0.1을 사용하고 관련 문서 사이에 상호 링크를 둔다.

## Source of truth 우선순위

현재 문서 단계에서 충돌 시 다음 순서를 적용한다.

1. 사용자의 현재 명시적 지시
2. [Global Codex Operating Brief 및 현재 Brief](AI_MLS_CODEX_DOCUMENTATION_BRIEFS.md)
3. 향후 승인되는 Project Constitution
4. 승인된 ADR
5. 승인 또는 동결된 Architecture Bible 문서
6. [Document Governance](docs/00_DOCUMENT_GOVERNANCE.md)와 [Glossary](docs/00_GLOSSARY.md)
7. Master Development Roadmap와 phase-specific brief
8. 기존 source code

동일 우선순위에서 충돌하면 더 구체적이고 최신의 승인 문서를 따르되, 조용히 해석해 변경하지 말고 `OPEN DECISION` 또는 inconsistency로 기록한다. v1.0 동결 시 F1에 정의된 최종 우선순위가 이 임시 순서를 대체한다.

## 변경 규칙

- 승인되거나 동결된 결정을 몰래 변경하지 않는다.
- 중요한 architecture 변경은 ADR로 추적한다.
- 기존 문서는 명시적 지시 없이 삭제하지 않는다.
- 문서 상태는 [Document Lifecycle](docs/00_DOCUMENT_LIFECYCLE.md)의 canonical 값(`DRAFT`, `IN REVIEW`, `APPROVED`, `FROZEN`, `SUPERSEDED`, `ARCHIVED`)만 사용한다.
- 중요한 상태 변경, 권한, provenance, 보안·개인정보 원칙을 관련 문서에서 누락하지 않는다.

## 금지 작업

- 문서 Brief 중 production feature code 구현
- 요청되지 않은 다음 Brief 자동 시작
- 승인 없는 autonomous Facebook/Viber scraping 또는 source connector 구현
- final database schema, executable migration 또는 final API endpoint 선결정
- AI의 검증·공개 게시 승인, 미검증 정보 외부 노출, 권한·audit 우회
- prompt나 예제에 third-party account credential 또는 민감한 contact 정보 기록
- 출처 정책 승인 없이 connector 구현

## 검증 및 완료 보고

각 Brief 종료 시 링크, 필수 섹션, 용어·상태·버전, 범위 제한, 알려진 불일치를 검증한다. 완료 보고서는 [Phase Completion Template](docs/templates/PHASE_COMPLETION_TEMPLATE.md)을 사용하여 `docs/reviews/<BRIEF>_COMPLETION.md`에 만들고 다음 10개 항목을 포함한다.

1. Objective
2. Documents read
3. Files created
4. Files modified
5. Key decisions added
6. Open decisions
7. Inconsistencies found
8. Validation performed
9. Known limitations
10. Next brief prerequisites

완료 보고서를 만든 뒤 중단하며 다음 Brief를 시작하지 않는다. 완료 기준을 충족하지 못했다면 완료로 표현하지 않고 원인과 남은 작업을 기록한다.
