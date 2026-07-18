# Development Traceability

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-009 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Development Reviewer / Quality Owner |
| 기준일 | 2026-07-15 |

## Canonical chain

`Requirement → Workflow → Entity → API → Screen → AI → Developer Task → Commit → Test`

`N/A`는 적용 불가 이유와 reviewer approval이 있을 때만 허용한다. 누락된 upstream ID를 임의로 만들지 않고 source document/registry를 먼저 갱신한다.

## Mapping contract

| Layer | Canonical source | Development evidence |
|---|---|---|
| Requirement | Constitution `REQ-CONST-*`와 approved requirement | purpose와 acceptance criteria |
| Workflow | Workflow Registry `WF-*` | entry/state/authority/exception impact |
| Entity | Data Dictionary | ownership, lifecycle, provenance/privacy impact |
| API | API Registry `API-*` | contract, validation, authority와 error impact |
| Screen | Screen Registry `UI-*` | role/action/state/accessibility impact |
| AI | AI capability `AI-*` | advisory boundary, schema/version/evaluation/fallback |
| Developer Task | Developer Registry `DEV-*` | bounded implementation work package |
| Commit/PR | Git evidence | exact changed artifact and review |
| Test | Test Registry `TEST-*` | intended/executed result와 evidence |

## Developer task rule

`DEV-*`는 영구 logical development identity다. task split/merge 또는 replacement는 supersession을 기록하고 ID를 재사용하지 않는다. Registry status `PLANNED`는 implementation authorization이 아니다.

## Commit linkage

각 behavior-changing commit/PR은 최소 하나의 active `DEV-*`와 `TEST-*`를 참조한다. documentation-only 정정도 affected Document/Decision/CR을 연결한다. merge commit 또는 squash 결과에서도 trace가 보존돼야 한다.

## Change impact

upstream requirement/workflow/entity/API/screen/AI/test가 바뀌면 affected `DEV-*`, code, test, documentation, migration, security/operations와 release evidence를 재검토한다. authority 또는 external-effect change는 fresh approval이 필요하다.

## Evidence and audit

trace evidence에는 repository/revision, author/reviewer, timestamps, result, exception/waiver와 artifact checksum/version을 포함한다. link만 존재하고 대상 revision이 식별되지 않으면 complete evidence가 아니다.

## Orphan policy

- upstream mapping 없는 `DEV-*`: development 금지.
- `DEV-*` 없는 behavior code: merge 금지.
- `TEST-*` 없는 `DEV-*`: Ready/Done 불가.
- code/commit 없는 `DEV-*`: `PLANNED`로 유지하며 구현 완료로 표현하지 않는다.

## Coverage

[Developer Registry](15_DEVELOPER_REGISTRY.md)는 `REQ-CONST-001–013`, `WF-001–012`, canonical entities, `API-001–019`, `UI-001–037`, `AI-001–007`과 `TEST-001–056`을 logical work packages에 연결한다.
