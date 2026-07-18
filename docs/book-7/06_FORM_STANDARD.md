# Form Standard

| 항목 | 값 |
|---|---|
| Document ID | DOC-UI-007 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner / Development Reviewer |
| 기준일 | 2026-07-14 |

## Purpose

Intake, requirement, review, approval와 administration form의 일관된 logical behavior를 정의한다.

## Structure

- title, purpose, subject ID/version, owner와 canonical status를 먼저 표시한다.
- required/optional 이유, accepted format, privacy class와 source/provenance 요구를 field 가까이에 표시한다.
- related field는 business grouping으로 나누고 긴 form은 step progress와 validation summary를 제공한다.
- AI suggestion은 원문/현재값/제안값/confidence/limitation을 비교하며 일괄 silent overwrite를 금지한다.

## Input controls and required fields

Control은 data type과 task에 맞게 text, number/amount, date/time, select, multi-select, checkbox/radio, structured address/location, file/evidence와 read-only reference를 선택한다. Placeholder는 label을 대체하지 않는다. Required field는 text와 programmatic indicator로 표시하고 왜 필요한지, 조건부 required 조건과 validation timing을 설명한다.

## Auto-save

Auto-save는 owning API가 draft operation과 idempotency/version contract를 제공하는 screen에서만 사용한다. 저장 중/저장됨/실패/서버 확인 시각을 표시하고 local change를 canonical success로 오해시키지 않는다. Approval, Verification, Permission, publication, destructive action은 auto-save/auto-submit하지 않는다.

## Validation

| Stage | Behavior |
|---|---|
| Input | format/range/required를 즉시 안내하되 typing을 방해하지 않음 |
| Submit | API domain validation과 workflow prerequisite를 재검사 |
| Conflict | expected version mismatch를 표시하고 current vs draft 비교 제공 |
| Authority | API-002 deny reason을 safe language로 표시; UI enablement가 grant 아님 |
| Result | canonical ID/version/status, audit/correlation reference와 next step 표시 |

## Action safety

Save Draft, Validate, Submit for Review, Approve/Reject와 Publish/Withdraw를 다른 label과 confirmation으로 구분한다. Enter key는 destructive/approval action을 암묵 실행하지 않는다. 취소 시 unsaved change를 경고하고, idempotent retry 여부를 API error metadata에 따라 안내한다.

## Confirmation

Confirmation은 irreversible/high-impact action에 subject ID/version, canonical current state, prerequisites, affected audience/fields, expiry와 rationale를 보여 준다. 일반 save에 반복 confirmation을 남용하지 않으며 server result와 audit reference를 confirmation 후 별도로 표시한다.

## Sensitive fields

Contact/channel, raw evidence와 security data는 masked default, purpose indicator, reveal authorization과 audit notice를 사용한다. Secret/credential을 일반 form, query string, notification 또는 client-side persistence에 노출하지 않는다.

## Accessibility

각 input은 programmatic label, instruction, error association과 logical focus order를 가진다. Error summary는 field link를 제공하며 color만으로 상태를 표현하지 않는다.
