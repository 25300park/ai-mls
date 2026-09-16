# REL-001 Blocker 2 UI-006 Live Core Data Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-259 |
| 문서 버전 | v1.0 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / UI Owner / API Owner |
| 기준일 | 2026-09-16 |

## 1. 목적과 범위

UI-006의 기존 `/administration` 화면에 이미 승인된 API-001 `GET /v1/me`의 live principal projection만 연결한다. API-015 administration data, 기존 Session ingress, renderer 구조와 FEAT-021 접근성 primitive를 유지한다.

## 2. 승인된 데이터 흐름

`browser → Staging Console Session ingress → Administration Console composition → CoreIdentityConsoleReadAdapter → GET /v1/me → 4-field presentation DTO → UI-006 renderer`

`SessionAccessCoordinator`의 `resource.view` 재검증이 authoritative capability gate다. 별도 API-002 호출은 중복 authorization path이므로 추가하지 않는다.

## 3. 구현 단위

1. UI-006 placeholder를 live principal로 교체하는 RED를 먼저 확인한다.
2. `CoreIdentityConsoleReadAdapter`가 API-001 transport response를 strict validation하고 `principalId`, `tenantId`, `roles`, `scopes`만 재구성한다.
3. Staging bootstrap이 전용 handler를 adapter에 주입한다.
4. composition은 API-015 결과가 READY일 때만 Core projection을 병합하며 Core 실패는 UI-006 Core section만 `NOT_AVAILABLE / NOT_READY`로 처리한다.
5. renderer는 기존 route와 semantic section 구조 안에서 current principal만 표시한다.
6. focused, affected, full regression과 architecture/security/document 검증을 수행한다.

## 4. 불변식

- API-002 추가: `0`
- API-003~010 확장: `0`
- direct persistence access: `0`
- 새 API, role/capability, auth model, persistence, dependency: `0`
- Session ID, `principalType`, `expiresAt`, assignment/policy internals 노출: `0`
- Core 장애 시 Console 전역 readiness의 임의 강등: `0`
- commit/push: Architecture Owner closeout 전 `NOT_CREATED / NOT_PERFORMED`

## 5. 관련 문서

- [Field Mapping Matrix](REL001_BLOCKER2_UI006_FIELD_MAPPING_MATRIX.md)
- [Runtime Traceability](REL001_BLOCKER2_UI006_RUNTIME_TRACEABILITY.md)
- [Blocker 1 Core Transport Traceability](REL001_BLOCKER1_CORE_API001002_TRACEABILITY.md)
- [UI-006 Screen Contract](../book-7/05_SCREEN_SPECIFICATIONS.md)
