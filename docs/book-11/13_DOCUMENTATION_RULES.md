# Documentation Rules

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-014 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Documentation Owner / Development Reviewer |
| 기준일 | 2026-07-15 |

## Documentation update policy

code와 behavior가 바뀌는 같은 change에서 affected architecture, contract, registry, runbook, test와 user/developer documentation을 갱신한다. 문서 변경을 “later”로 미루면 Done이 아니다.

## Required update triggers

| Change | Documentation impact |
|---|---|
| Requirement/workflow/state | Constitution/requirement, Workflow Registry와 transition/trace |
| Entity/data lifecycle | Data Dictionary, privacy/retention/migration |
| API/integration | API Registry, error/version/connector contract |
| Screen/action | Screen Registry, role/state/accessibility |
| AI capability/prompt/schema | AI registry/governance/evaluation/fallback |
| Security/operation | control/operation registry, runbook/checklist |
| Test/developer task | Test/Developer Registry와 evidence |

## Document ownership

각 문서는 single accountable owner와 required reviewers를 가진다. code owner는 연결 문서 drift를 발견하면 Documentation Owner에게 전가하지 않고 change scope에 포함한다.

## Version update

[Document Governance](../00_DOCUMENT_GOVERNANCE.md), [Document Lifecycle](../00_DOCUMENT_LIFECYCLE.md), [Document ID Rule](../00_DOCUMENT_ID_RULE.md)과 [Release Policy](../00_RELEASE_POLICY.md)를 따른다. content-compatible revision은 ID를 유지하고 replacement만 새 ID와 supersession을 사용한다.

## Cross-reference update

rename/move/replace 시 Master Index, inbound/outbound links, registry, Decision/CR/ADR와 completion/release manifest를 갱신한다. broken link 또는 orphan ID가 있으면 merge하지 않는다.

## Documentation quality

설명은 한국어, technical identifier/file/schema/code example은 English를 사용한다. assumption은 `ASSUMPTION`, 미결정은 `OPEN DECISION`, 미래 기능은 `POST-MVP`로 표시한다. example은 production secret/contact/raw data를 포함하지 않는다.

## Generated documentation

자동 생성 문서는 source, generator/version, generated marker와 regeneration rule을 가진다. human-authored authority document를 generated output으로 덮어쓰지 않는다.

## Review evidence

link, required section, terminology/status/version, trace, scope와 implementation/document consistency를 fixed revision에서 검증한다.
