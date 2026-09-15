# REL-001 Phase 5B Screen Execution Traceability

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-230 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / UI Owner |
| 기준일 | 2026-09-16 |

## 1. 목적

REL-001 Staging Admin Console에서 승인된 여섯 화면만 기존 소유 API/application 경계로 실행되도록 연결한 증거를 추적한다. 이 문서는 새 화면, API, business authority 또는 persistence ownership을 만들지 않는다.

## 2. 화면 실행 추적

| 화면 | 기존 route | 소유 경계 | Staging 실행 경계 | 검증 결과 |
|---|---|---|---|---|
| `UI-006` | `/administration` | API-015 Administration | `AdministrationConsoleReadAdapter` → API-015 HTTP | EXECUTABLE; Core API-001/002 data는 `DEFERRED` / `NOT_AVAILABLE` |
| `UI-031` | `/publication/operations` | API-014 Publication | injected `publicationReadAdapter` | EXECUTABLE |
| `UI-032` | `/publication/revalidation` | API-014 Publication | injected `publicationReadAdapter` | EXECUTABLE |
| `UI-033` | `/publication/recovery` | API-014/F19 recovery read | injected `publicationReadAdapter` | EXECUTABLE |
| `UI-035` | `/publication/audit` | API-016 Audit | injected `auditReadAdapter` | EXECUTABLE |
| `UI-036` | `/administration/governance` | API-015 Administration | `AdministrationConsoleReadAdapter` → API-015 HTTP | EXECUTABLE; existing controlled-write contract only |

## 3. Supporting operational projection

기존 `/system/operations` supporting view는 새 canonical screen이 아니다. API-017 status port와 FEAT-022 advisory status port를 분리해 표시한다.

- API-017 readiness와 bounded Job status는 injected read port에서만 온다.
- FEAT-022 provider-independent implementation은 `READY`이다.
- live provider execution은 `NOT_READY`이다.
- blocker는 `EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY`, `DEC-162`는 `IN_REVIEW`이다.
- 전체 Staging composition readiness는 `DEGRADED`이며 `READY`로 승격하지 않는다.

## 4. 접근 및 안전 경계

trusted Staging ingress가 전달한 `x-session-id`는 Phase 1D `resolveAuthorized()`로 매 요청 재검증한다. browser JavaScript는 Session identifier를 읽거나 보관하지 않으며, ingress가 carrier를 주입하지 않은 직접 요청은 `401`로 fail closed 한다. tenant/scope 및 다섯 selector scope는 Staging 구성과 정확히 일치해야 하며 browser query/body가 덮어쓰지 못한다. revoked/expired/unauthorized Session과 stale MFA는 backend 호출 전에 fail closed 한다. 반환 값은 bounded immutable Console DTO로 재구성하고 unsafe token, prompt, provider payload, stack/path/SQL/SQLite 진단은 렌더링하지 않는다.

## 5. 제외 및 보존

| 항목 | 상태 |
|---|---|
| Canonical screen 수 | 6 유지; 추가 0 |
| `UI-034` | dependency-blocked; Phase 5B 제외 |
| Core API-001/002 data | `DEFERRED` / `NOT_AVAILABLE` |
| live AI provider | `0/3 NOT_READY` |
| 새 API/route/role/capability | 0 |
| Console direct store/provider access | 0 |
| dependency/network/credential 변경 | 0 |
