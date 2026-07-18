# Functional Tests

| 항목 | 값 |
|---|---|
| Document ID | DOC-TEST-006 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Quality Owner / Business Owner |
| 기준일 | 2026-07-15 |

## Workflow validation

WF-001–012 각각 happy path, invalid prerequisite, unauthorized role, stale version, duplicate/retry, cancellation/expiry, exception/recovery와 audit를 검증한다. State transition은 [Status Dictionary](../book-5/13_STATUS_DICTIONARY.md)의 exact value/guard/evidence를 사용한다.

## Business rules

- candidate/Verification/Permission/Approval/Publication entity와 authority 분리.
- current source/provenance, effective period, conflict와 latest version 재검사.
- search/match/AI suggestion은 eligibility/approval을 만들지 않음.
- contact purpose/masking, client sharing와 public publication audience 분리.
- async accepted/queued/retry는 terminal/external success가 아님.

## Approval workflow

Requester/subject/version/approver/scope/reason/time/evidence, SoD, deny/revoke/expiry와 stale change를 검증한다. AI/service/connector/admin/manager의 implicit approval과 self-approval conflict를 거부해야 한다.

## Publication workflow

Valid Verification + public Permission + independent Publication Approval + exact representation/version + target policy를 요구한다. Missing/revoked/expired/stale prerequisite, duplicate command, timeout/ambiguous response, `UNKNOWN`, correction/suspension/withdrawal와 external reconciliation을 검증한다.

## Exception workflow

Containment, owner, severity, attempt, evidence, retry eligibility, manual action, recovery/compensation/accepted risk와 closure를 검증한다. Retry는 authority를 복구하지 않고 unknown/failed를 success로 바꾸지 않는다.

## API/UI behavior

Every visible action은 mapped API를 호출하고 direct mutation/hidden action이 없다. API response는 error envelope, request/correlation, canonical ID/version/status와 safe disclosure를 유지한다. UI loading/error/empty/completed가 business state를 upgrade하지 않는다.

## Acceptance

TEST-001–038의 applicable expected results, P0 bypass cases, all workflow/API/UI coverage와 linked defect closure가 필요하다.

