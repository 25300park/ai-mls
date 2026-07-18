# AI Principles

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-029 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Reviewer |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](00_PROJECT_CONSTITUTION.md) |

## Role of AI

AI는 source content의 structured extraction, canonical property suggestion, duplicate probability, client requirement parsing, match ranking, explanation과 summary를 지원한다. 모든 output은 recommendation 또는 draft이며 application validation과 필요한 human review를 거친다.

## AI authority limits

- AI는 verification, permission, customer sharing 또는 publication을 승인하지 않는다.
- AI는 authoritative production state를 직접 생성·수정·삭제하지 않는다.
- AI는 role/authorization, retention, audit 또는 connector boundary를 우회하지 않는다.
- AI confidence는 evidence나 human decision의 대체물이 아니다.
- AI는 Facebook/Viber account를 제어하거나 credential을 요구하지 않는다.

## Human review requirements

| Condition | Required human action |
|---|---|
| authoritative field/state에 영향 | source evidence와 proposed change 검토 |
| confidence가 approved threshold 미만 | correction, reject 또는 manual completion |
| conflicting sources/duplicate ambiguity | conflict resolution과 rationale 기록 |
| contact/personal data 포함 가능 | authorization과 masking 확인 |
| external sharing/publication에 사용 | verification, permission, approval 독립 확인 |
| malformed/unsafe input 또는 prompt injection 의심 | quarantine/fallback 및 security review |

threshold는 Book 4에서 evaluation evidence와 risk에 따라 정의한다.

## Confidence handling

- output schema는 feature별 confidence와 uncertainty reason을 제공한다.
- score range, calibration set, threshold, fallback과 reviewer route를 version화한다.
- confidence를 probability/fact/permission처럼 표시하지 않는다.
- low confidence를 숨기거나 missing value를 high confidence로 default하지 않는다.
- calibration drift와 human correction rate를 관찰한다.

## Prompt governance

- prompt는 permanent ID/version, purpose, input/output contract와 owner를 가진다.
- production prompt 변경은 test/evaluation, privacy/security review와 rollback evidence를 남긴다.
- third-party credential, unrestricted contact 또는 불필요한 raw personal data를 prompt에 넣지 않는다.
- untrusted source content를 instruction과 분리하고 prompt injection을 가정한다.
- provider log/retention/data-use setting을 승인된 policy와 일치시킨다.

## AI provider independence

AI capability는 provider-specific response가 아니라 provider-neutral validated contract 뒤에 둔다. provider 교체 시 privacy, capability, structured output, latency, cost와 evaluation regression을 검토한다. provider abstraction은 현재 [ASM-003](../00_ASSUMPTION_REGISTER.md)이며 Book 4/ADR 전까지 확정 architecture가 아니다.

## AI transparency

- user에게 AI-generated/suggested field를 구분한다.
- 중요한 recommendation은 source/evidence와 주요 reason을 제시한다.
- model/provider/prompt version을 authorized audit context에서 추적한다.
- 설명할 수 없는 score는 approval evidence로 단독 사용하지 않는다.

## AI auditability

최소한 feature, job/request correlation, model/provider, prompt/version, input reference, validated output, confidence, error/fallback와 human correction/decision을 추적한다. raw sensitive input은 audit 필요성과 retention/minimization을 균형 있게 적용하며 audit log에 불필요하게 복제하지 않는다.

## AI prohibited actions

| Prohibited action | Required control/evidence |
|---|---|
| listing/permission/publication 승인 | approval capability를 AI identity에 부여하지 않는 authorization test |
| authoritative state 직접 write | validated application command와 human gate separation test |
| unrestricted contact 노출 | masking, role and access log test |
| credential 수집/전송 | secret scanning과 input redaction test |
| source platform autonomous control | connector policy와 integration boundary review |
| application validation bypass | invalid/malformed output rejection test |
| provenance 삭제/대체 | source linkage integrity test |

## Measurable AI gates

- 모든 persisted AI output은 schema/semantic validation 결과를 가진다.
- 모든 human-review-required output은 reviewer disposition으로 종료되거나 안전하게 보류된다.
- invalid output, provider outage와 timeout에 documented fallback이 있다.
- evaluation dataset/version과 metric 없이는 AI feature를 release-ready로 표시하지 않는다.
- prohibited action test가 하나라도 실패하면 release를 차단한다.

## Constitutional bindings

`REQ-CONST-001`, `REQ-CONST-002`, `REQ-CONST-005`, `REQ-CONST-007`–`REQ-CONST-010`을 AI boundary로 구체화한다.

> **OPEN DECISION:** confidence scale, calibration threshold, provider data-retention requirement와 evaluation release gate는 Book 4에서 확정한다.
