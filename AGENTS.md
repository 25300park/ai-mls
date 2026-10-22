# Codex Working Rules

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-003 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 적용 범위 | 저장소 전체 |

## AI-MLS MVP-FIRST EXECUTION AUTHORITY

이 절은 Human이 승인한 저장소 전체 실행 지시이며, 아래 기존 규칙과 충돌하면 우선한다. 별도 managed AIDOS/AI-MLS block은 현재 파일에 존재하지 않으므로 새 관리 마커나 authority source를 만들지 않고 여기에 적용한다.

`MVP_COMPLETION_IS_PRIMARY = TRUE`

### 필수 범위 판정

모든 작업은 먼저 `MVP_REQUIRED = YES / NO`를 판정한다. 다음을 직접 막는 경우만 YES이다:

- MVP completion 또는 MVP deployment
- Production startup
- Human product testing
- Human-requested MVP defect fix
- 안전한 MVP 운영에 필요한 data/security integrity

그 외는 `DEFER_POST_MVP`로 기록하고 구현하지 않는다. 승인된 목표 순서는 MVP completion → deployment → Human testing → Human-requested fixes → autonomous background validation이다. 이 순서가 background 작업이나 Production 실행을 자동 승인하지는 않는다.

### Local 자율 실행 / Human Gate

승인된 MVP 범위의 repository inspection, code modification, diagnostics, grep/search, tests, build, typecheck, lint, diff, checksum, local PowerShell-equivalent checks, local migration analysis, regression, source verification 및 실패 후 correction은 Codex가 직접 수행한다. Human에게 로컬 명령을 복사·실행하거나 결과를 전달하는 test runner 역할을 요구하지 않는다. 도구 제약이 있어도 가능한 로컬 대안을 먼저 수행하고 정확한 제약만 보고한다.

Human action이 필요한 경계는 다음 여섯 가지뿐이다:

- `HUMAN_GATE_PRODUCTION_MUTATION`
- `HUMAN_GATE_DEPLOYMENT`
- `HUMAN_GATE_SECRET_CUSTODY`
- `HUMAN_GATE_DESTRUCTIVE_OPERATION`
- `HUMAN_GATE_PRODUCT_TEST`
- `HUMAN_GATE_SCOPE_AUTHORITY_CHANGE`

기존 승인은 그 범위 안에서 재요청하지 않는다. 이 규칙은 secret 노출, authority bypass, 미승인 Production 접근/변경 또는 commit/push를 허용하지 않는다.

### Scope drift circuit breaker

새 framework, abstraction, governance layer, verifier, migration, evidence/recovery system 또는 authority model을 도입하기 전에 `DOES_THIS_DIRECTLY_BLOCK_MVP = YES / NO`에 답한다. NO이면 `POST_MVP_DEFERRED`만 기록한다. YES이면 최소 안전 버전만 구현한다.

다음 중 하나라도 발생하면 `SCOPE_DRIFT_DETECTED = YES`, `ACTION = RETURN_TO_SHORTEST_MVP_PATH`로 처리한다:

- verifier가 다른 verifier를 요구함
- blocker 해결이 새 generalized subsystem으로 커짐
- migration이 무관한 후속 architecture를 만듦
- 변경 없는 PASS evidence를 반복 검증함
- 로컬 실행 가능한 diagnostic을 Human에게 넘김
- governance 작업이 deployment 경로를 직접 줄이지 못함

필수 data/security integrity 검증은 유지하되, 해당 문제를 최소 직접 수정으로 해결하고 일반화를 멈춘다. 기존 파일/증거를 자동 삭제하거나 승인된 authority를 우회하지 않는다.

### 구현 지침과 검증 예산

[AI_MLS_DEVELOPMENT_OPERATING_PRINCIPLES.md](docs/governance/AI_MLS_DEVELOPMENT_OPERATING_PRINCIPLES.md)는 이 AGENTS.md가 소비하는 **하위 구현 지침**이다. 충돌 시 현재 Human 지시와 이 MVP-FIRST 절을 우선하며 경쟁하는 MVP 정책 문서를 만들지 않는다.

승인된 범위에서는 inspect → implement → test → diagnose → fix → retest → affected validation → build/typecheck → diff/secret check → candidate를 완료한다. 일반적인 로컬 실패로 작업을 종료하지 않는다.

구현 중 focused tests, stable candidate에서 focused + affected + build/typecheck + scoped lint + diff + secret scan을 사용한다. Full regression은 stable release candidate 또는 실제로 광범위하고 위험한 shared-core 변경에만 실행한다. 변경 없는 유효한 PASS evidence는 재사용한다.

### 완료 상태 계약

모든 Codex 완료 보고(채팅 보고 포함)에 다음을 포함한다. 별도 보고서 파일은 사용자 요청 또는 필요한 추적 기록이 있을 때만 작성한다.

```text
MVP_SCOPE_CHECK = PASS / FAIL
CURRENT_TASK_REQUIRED_FOR_MVP = YES / NO
SCOPE_DRIFT_DETECTED = YES / NO
POST_MVP_DEFERRED = ...
HUMAN_ACTION_REQUIRED = YES / NO
HUMAN_ACTION_REASON = NONE / PRODUCTION_MUTATION / DEPLOYMENT / SECRET_CUSTODY / DESTRUCTIVE_OPERATION / PRODUCT_TEST / SCOPE_AUTHORITY_CHANGE
SHORTEST_PATH_TO_MVP = ...
```

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

각 Brief 종료 시 필요한 링크·범위·불일치를 확인하고 위 MVP-FIRST 완료 상태 계약을 보고한다. 별도 완료 보고서가 사용자 요청 또는 필요한 추적 기록으로 요구되는 경우에만 [Phase Completion Template](docs/templates/PHASE_COMPLETION_TEMPLATE.md)을 사용하여 `docs/reviews/<BRIEF>_COMPLETION.md`에 만들고 다음 10개 항목을 포함한다.

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

현재 Brief를 완료한 뒤 중단하며 요청되지 않은 다음 Brief를 시작하지 않는다. 완료 기준을 충족하지 못했다면 완료로 표현하지 않고 원인과 남은 작업을 기록한다.
