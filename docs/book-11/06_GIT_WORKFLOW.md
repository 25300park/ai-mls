# Git Workflow

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-007 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Development Reviewer / Release Owner |
| 기준일 | 2026-07-15 |

## Commit rules

- commit은 하나의 coherent change이며 build/review가 가능한 상태를 유지한다.
- 모든 behavior commit은 `DEV-*`, applicable `REQ-CONST-*`, `WF-*`, `TEST-*`를 message footer 또는 linked work item에 기록한다.
- generated output, dependency lock, migration/config와 documentation impact를 숨기지 않는다.
- secret, credential, personal/contact/raw production data를 commit하지 않는다.
- history rewrite와 force push는 protected branch에서 금지하며 approved recovery 절차만 예외다.

## Commit message convention

`<type>(<scope>): <imperative summary>` 형식을 사용한다. type은 `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`, `revert` 중 승인된 값을 사용한다. summary는 English imperative로 작성한다.

Required trace footer의 logical form은 `Developer: DEV-NNN`, `Tests: TEST-NNN`, 필요 시 `Decision: DEC/ADR/CR`이다. 실제 tooling syntax는 추후 확정한다.

## Pull request policy

PR에는 purpose, scope/non-goal, trace IDs, architecture/data/security/privacy/AI/operations impact, test evidence, migration/rollback, documentation와 known risk를 포함한다. self-review와 automated gate를 통과한 뒤 review를 요청한다.

## Review policy

- author는 자신의 변경을 단독 승인할 수 없다.
- code owner와 Development Reviewer가 필수이며 risk에 따라 Architecture, Security/Privacy, Data, AI, Operations와 Business reviewer를 추가한다.
- finding은 severity, rationale, owner와 disposition을 가진다.
- unresolved blocker 또는 stale approval이 있으면 merge하지 않는다.

## Merge policy

protected branch에는 reviewed PR만 merge한다. required checks, approvals, trace와 branch freshness가 충족돼야 한다. merge 방식과 history policy는 repository 설정으로 일관되게 강제한다.

## Emergency workflow

긴급 fix도 authorization, smallest scope, test/rollback와 audit를 생략하지 않는다. 사후 CR/review, documentation sync와 expiry가 필요하다.

> **OPEN DECISION:** hosting provider, required check names, reviewer count, merge method와 signature requirement.
