# REL-001 Staging Acceptance Scope

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-246 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Release Owner / Architecture Owner |
| 기준일 | 2026-09-16 |

## 1. Exact candidate boundary

이 평가는 source `cd620b273c8e7672ffc1e015380ce36d486d9a9a`, artifact fingerprint `0bdee557c89a99491c4b0194e5b3828c6df8772a32706de452896c53fd66f27e`, release candidate `e9244c1df51ef29b2ae61fe0323f05d29d4127f688a5eda2bc8ef10c14f957a2`, candidate fingerprint `9a74e4d1052998d8603cd9504c256dfaf5264cc02a22bc929384aaf0caaf2a14`에만 적용한다. Runtime closure는 `18` component roots와 `65` unique files다.

## 2. Included executable boundary

- durable Session/Auth와 live authorization
- API-015 Administration HTTP/runtime
- API-016 durable Audit runtime
- API-017 bounded one-shot Job foundation
- FEAT-022 provider-independent runtime (`3/3 READY`)
- Admin Console의 fully executable 5 screens
- UI-006 executable shell과 truthful deferred-data presentation
- integrated Staging composition
- security, privacy, readiness, safe-error and accessibility controls

## 3. Deferred or unavailable boundary

| Surface | Current truth | Acceptance effect |
|---|---|---|
| Core API-001/002 public transport | `HOLD` | exact candidate의 required runtime gap이므로 positive acceptance 차단 |
| Live FEAT-022 provider execution | `0/3 NOT_READY`; external account/contract hold | required external blocker; DEC-162 `IN_REVIEW` |
| UI-006 live Core data | `SAFELY_DEFERRED` | UI truthfulness은 PASS이나 required candidate surface는 미완료 |
| Production activation | `NOT_AUTHORIZED` | 평가 범위 밖; deployment authority `0` |

이 표의 deferred 표현은 canonical candidate의 `requiredByReleaseScope`를 `false`로 바꾸지 않는다. 기존 scope를 축소하거나 새 partial-acceptance 결과를 만들지 않는다.

## 4. Acceptance vocabulary

허용 결과는 `ACCEPTED`, `REJECTED`, `INCOMPLETE`뿐이다. 현재 candidate는 required runtime gaps가 있으므로 `INCOMPLETE`이다.

Related: [Prerequisite Matrix](REL001_STAGING_ACCEPTANCE_PREREQUISITE_MATRIX.md), [Gap Disposition](REL001_STAGING_REMAINING_GAP_DISPOSITION.md).
