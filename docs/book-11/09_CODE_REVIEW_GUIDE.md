# Code Review Guide

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-010 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Development Reviewer |
| 기준일 | 2026-07-15 |

## Review entry

PR description, `DEV-*` trace, affected contract, risk, test evidence, migration/rollback와 documentation impact가 없으면 review-ready가 아니다. reviewer는 code뿐 아니라 generated/dependency/config/data/test/doc change를 함께 본다.

## Review checklist

- [ ] scope가 approved requirement와 `DEV-*`에 한정된다.
- [ ] mapped Workflow/Entity/API/UI/AI/Test가 정확하다.
- [ ] module boundary와 dependency direction을 지킨다.
- [ ] validation, error, idempotency, concurrency와 rollback을 처리한다.
- [ ] authorization, approval, audit, provenance, privacy와 retention을 우회하지 않는다.
- [ ] normal/negative/failure/recovery test evidence가 risk에 맞다.
- [ ] secret, personal/raw production fixture와 unsafe log가 없다.
- [ ] documentation, runbook, metrics와 release impact가 갱신됐다.

## Architecture review

responsibility, public contract, state authority, data ownership, external integration와 failure isolation이 approved architecture와 일치하는지 확인한다. 새로운 boundary 또는 irreversible choice는 CR/ADR 없이는 승인하지 않는다.

## Security review

authentication/authorization, object scope, separation of duties, input/output, secret, logging, dependency, privacy, export/deletion와 abuse path를 확인한다. privileged/publication operation에는 deny test와 audit evidence가 필요하다.

## Performance review

query/call multiplicity, unbounded collection, pagination, cache consistency, job backpressure, timeout/retry와 capacity impact를 확인한다. measurement 없는 optimization과 correctness/authority를 약화하는 optimization을 승인하지 않는다.

## Maintainability review

이름, cohesion, duplication, complexity, public surface, testability, comments/rationale, dependency health와 operational diagnosability를 본다. broad shared abstraction은 실제 consumer와 stable semantics가 필요하다.

## Finding disposition

`BLOCKER`, `MAJOR`, `MINOR`, `NIT`로 분류한다. Blocker/Major는 해결 또는 authorized risk acceptance 전 merge할 수 없다. 모든 disposition은 reviewer와 evidence를 보존한다.

> **OPEN DECISION:** quantitative complexity, coverage와 performance-review trigger thresholds.
