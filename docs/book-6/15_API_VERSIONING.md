# API Versioning

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-016 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Development Reviewer |
| 기준일 | 2026-07-14 |

## Purpose

API와 connector contract의 compatibility, version negotiation, deprecation, retirement와 migration evidence를 정의한다.

## Logical Endpoints

Major version은 logical resource namespace `/v{major}`에 나타난다. `GET /v{major}/api-capabilities` 같은 discovery operation은 supported capability/contract version metadata를 제공할 수 있으나 exact endpoint와 protocol은 **OPEN DECISION**이다.

## Request Model

Client/connector version, media/contract version where applicable, capability requirements와 trace IDs를 보낸다. 비동기 job과 callback은 submit 당시 contract/schema/policy version을 고정한다.

## Response Model

Served major/contract version, resource version, supported/deprecated indicators, sunset/replacement reference와 migration documentation link를 반환한다. Unsupported version은 자동 downgrade하지 않는다.

## Compatibility rules

| Change | Classification | Rule |
|---|---|---|
| optional field/operation 추가 | compatible candidate | old consumer behavior와 authority invariant 유지 |
| enum/status/error 의미 추가 | review required | consumer가 unknown value를 fail safely 처리 가능한지 검증 |
| required field, meaning, authority/guard 변경 | breaking | new major/contract version |
| field 제거/rename/type narrowing | breaking | deprecation 후 new major |
| security/privacy restriction 강화 | emergency-compatible 가능 | 즉시 fail-closed 가능; CR/review/evidence 필수 |
| workflow/state bypass 허용 | prohibited | 어떤 version에서도 불가 |

## Business Rules

API version은 resource/entity version, prompt/model version, policy version과 다르다. Major coexistence도 같은 canonical workflow authority를 사용한다. Deprecated version이 revoked permission이나 obsolete approval을 계속 인정할 수 없다. Consumer-specific hidden fork를 금지한다.

## Authority

Architecture Owner가 version classification, Security/Business/Data owners가 affected invariant, User/Release approver가 support/deprecation policy를 승인한다. Integration Owner는 consumer migration evidence를 제공한다.

## Validation

consumer inventory, contract diff, workflow/entity/AI/authority/error impact, backward/forward behavior, data/privacy, job/callback coexistence, rollback, observability와 migration readiness를 검사한다.

## Audit

version negotiation, unsupported/deprecated use, migration status, compatibility decision, exception/extension, sunset notice와 retirement를 consumer/connector ID와 함께 기록한다.

## Error Conditions

`API_VERSION_UNSUPPORTED`, `CONTRACT_VERSION_UNSUPPORTED`, `CAPABILITY_UNAVAILABLE`, `DEPRECATED_VERSION`, `MIGRATION_REQUIRED`, `VERSION_NEGOTIATION_FAILED`.

## Related Workflow

`WF-001`–`012`; version change cannot alter workflow gates without corresponding Book 5 change approval.

## Related Entity

All exposed entities; especially Status History, Decision History, Audit Event, AI Job, Publication and connector instance metadata (logical extension candidate).

## Related AI Capability

`AI-001`–`007` contracts carry independent schema/model/prompt versions; API major does not imply AI version.

> **OPEN DECISION:** initial major label, support overlap, sunset notice period, consumer registry owner와 emergency security retirement rule.

