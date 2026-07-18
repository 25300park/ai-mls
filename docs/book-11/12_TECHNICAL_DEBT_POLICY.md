# Technical Debt Policy

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-013 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Development Reviewer / Architecture Owner |
| 기준일 | 2026-07-15 |

## Purpose

Technical debt는 숨은 TODO가 아니라 승인된 risk와 resolution obligation이다. constitutional/security/privacy/authority/audit/provenance 위반은 debt로 수용할 수 없는 defect/blocker다.

## Classification

| Class | Meaning | Example category |
|---|---|---|
| Architecture debt | boundary/contract가 target architecture와 다름 | temporary adapter, deferred split |
| Code debt | maintainability, duplication, complexity | bounded refactor need |
| Test debt | required coverage/evidence 부족 | non-critical automation gap |
| Data debt | quality/migration/retention cleanup 필요 | approved reconciliation backlog |
| Security/privacy debt | non-blocking hardening gap | approved time-bounded improvement |
| Operations debt | observability/runbook/capacity gap | non-critical alert refinement |
| Dependency debt | version/support/vendor exit gap | scheduled upgrade |
| Documentation debt | implementation-linked doc drift | bounded correction |

## Registration

각 debt record는 permanent ID, class, description, cause, affected `DEV/REQ/WF/Entity/API/UI/AI/TEST`, severity/likelihood, owner, introduced release, workaround, acceptance authority, expiry/target와 resolution criteria를 가진다.

## Approval

owner와 Development Reviewer가 기본 review한다. architecture/security/privacy/data/AI/operations 영향은 해당 specialist approval이 필요하다. release blocker는 debt acceptance로 downgrade하지 않는다.

## Resolution

resolution은 linked `DEV-*`, regression test, documentation와 evidence로 검증한다. 단순 close가 아니라 root cause와 affected consumer를 확인하고 temporary control을 제거한다.

## Review cadence

release planning마다 active debt를 재평가하고 expired, growing 또는 repeated debt는 escalation한다. debt age, risk exposure, recurrence와 resolution rate를 quality metric으로 추적하되 숫자 목표는 추후 승인한다.

## Prohibited practice

anonymous TODO, owner/expiry 없는 waiver, credential/privacy issue 은폐, test 삭제를 통한 pass, architecture conflict의 영구 normalization을 금지한다.

> **OPEN DECISION:** debt registry의 physical location/tool, severity SLA와 quantitative budget.
