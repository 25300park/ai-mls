# Code Generation Policy

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-015 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Development Reviewer / Security Reviewer |
| 기준일 | 2026-07-15 |

## Codex usage policy

Codex는 approved `DEV-*` 범위에서 analysis, draft, refactor suggestion, test suggestion와 documentation 지원에 사용할 수 있다. Codex가 requirement, authority, schema, endpoint, credential, approval 또는 production action을 자율 결정할 수 없다.

## AI-assisted coding policy

- 입력에는 필요한 최소 context만 제공하고 secret, token, personal/contact/raw production data를 포함하지 않는다.
- generated code는 untrusted contribution으로 취급해 compile/static/security/license/dependency와 mapped test를 검증한다.
- AI output이 architecture, human approval, privacy, audit 또는 provenance를 우회하면 폐기한다.
- provider/model/tool 변경이 reproducibility, data use 또는 license에 영향을 주면 review한다.

## Human approval

human author가 scope, correctness, security/privacy, architecture, test와 licensing을 책임진다. AI가 자신의 output을 최종 승인하거나 sole reviewer가 될 수 없다. privileged/publication/security-critical code에는 independent qualified reviewer가 필요하다.

## Generated code review

reviewer는 이해 가능성, hidden assumption, fabricated API/dependency, insecure default, error/retry, resource usage, data exposure, test adequacy와 copied-license risk를 확인한다. 생성량이 많아 review할 수 없으면 변경을 분할하거나 거부한다.

## Code ownership

generated code의 owner는 사람/팀이며 vendor/model이 아니다. owner는 유지보수, incident, vulnerability, rollback와 deletion을 책임진다. 생성 provenance에는 tool/model family, date, purpose와 human reviewer를 필요한 수준으로 기록한다.

## Prohibited use

- credential/account/session을 prompt에 제공하거나 생성하게 하기
- autonomous production deploy, migration, scraping, public publication 또는 approval
- security/quality gate를 통과시키기 위한 test/scan 억제
- 이해·검증하지 않은 generated code merge
- third-party code/license 출처 은폐

## Retention and audit

prompt/output retention은 provider policy, data classification와 minimization을 따른다. trace에는 `DEV-*`, commit/PR와 review evidence를 남기되 sensitive prompt content 자체를 불필요하게 저장하지 않는다.

> **OPEN DECISION:** approved coding assistants/models, enterprise data controls, prompt retention와 provenance automation.
