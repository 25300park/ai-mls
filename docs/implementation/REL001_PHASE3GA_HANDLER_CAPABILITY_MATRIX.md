# REL-001 Phase 3G-A Handler Capability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-160 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / Security Owner / Operations Owner |
| 기준일 | 2026-09-15 |
| Decision | `DEC-152` (`APPROVED`) |

## 1. Exact matrix

| Job / handler | Required domain/application port | Job Store | Audit/evidence | Failure mapper | Clock | Tenant/scope | Network | Timer | Background | Filesystem/process | Contract readiness | Implementation validation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `AI_LISTING_PARSE` / `AI-001` | exact listing-parse application port | `NONE` | safe refs returned; persistence `NONE` | `NONE` | `NONE` | immutable Job context, live admission | `NONE` | `NONE` | `NONE` | `NONE` | `CONTAINMENT_READY` | `NOT_IMPLEMENTED` |
| `AI_REQUIREMENT_PARSE` / `AI-004` | exact requirement-parse application port | `NONE` | safe refs returned; persistence `NONE` | `NONE` | `NONE` | immutable Job context, live admission | `NONE` | `NONE` | `NONE` | `NONE` | `CONTAINMENT_READY` | `NOT_IMPLEMENTED` |
| `AI_MATCHING` / `AI-005` | exact matching application port | `NONE` | safe refs returned; persistence `NONE` | `NONE` | `NONE` | immutable Job context, live admission | `NONE` | `NONE` | `NONE` | `NONE` | `CONTAINMENT_READY` | `NOT_IMPLEMENTED` |

## 2. Assessment

- approved handlers assessed: `3`
- contract-level containment-ready: `3/3`
- prohibited-capability dependencies required by canonical contracts: `0`
- Production handler implementations found: `0/3`
- implementation source/global validation complete: `0/3`

`CONTAINMENT_READY`는 이 amendment가 확정한 closed capability requirement를 뜻하며 실제 Production handler가 검증되었다는 뜻이 아니다. 실제 handler가 존재하기 전에는 direct global usage를 `0`으로 입증할 수 없다. 현재 scan 결과는 “사용 발견 없음”이 아니라 “검사 대상 구현 없음”이다.

## 3. Binding rules

1. Handler identity와 Job type은 기존 closed registry mapping과 일치해야 한다.
2. Application port는 해당 handler branch에만 나타나야 한다.
3. Runtime-owned store, failure mapper, audit writer와 clock은 handler로 전달하지 않는다.
4. Handler는 immutable Job context의 tenant/scope를 authority로 재해석하지 않는다.
5. Result는 기존 safe reference/checksum/evidence shape만 반환하며 persistence는 runtime이 수행한다.
6. Direct prohibited global 또는 undeclared service가 발견되면 해당 handler는 `BLOCKED`이고 runtime은 `NOT_READY`이다.

## 4. Implementation gate

Phase 3G 재개 시 실제 세 handler 각각에 대해 typed context wiring, static/source inspection과 runtime observation을 수행해야 한다. 세 결과가 모두 PASS일 때만 implementation-level `3/3 CONTAINMENT_READY`를 선언할 수 있다.
