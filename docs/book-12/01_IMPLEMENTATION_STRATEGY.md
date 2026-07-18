# Implementation Strategy

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-002 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Development Owner |
| 기준일 | 2026-07-15 |

## Architecture-first implementation

각 change는 [Definition of Ready](../book-11/10_DEFINITION_OF_READY.md)를 통과하고 approved `REQ/WF/Entity/API/UI/AI/DEV/TEST`를 입력으로 사용한다. implementation convenience가 authority, state, contract 또는 module boundary를 바꾸면 implementation을 중단하고 CR/ADR review를 수행한다.

## Incremental delivery

- Feature는 독립 review/test/rollback 가능한 vertical slice다.
- Sprint는 mapped tests와 demonstrable outcome을 가지며 incomplete external effect를 노출하지 않는다.
- cumulative release는 이전 gate를 재검증하고 regression, migration와 operations evidence를 포함한다.
- feature flag 또는 internal-only boundary도 authorization, audit와 cleanup owner를 가진다.

## Risk-first implementation

먼저 governance/trace, identity/authorization, audit/security, source provenance와 test infrastructure를 준비한다. publication, connector, migration와 cutover처럼 irreversible/external-effect risk가 높은 capability는 prerequisite와 negative/recovery evidence 후 진행한다.

## MVP strategy

MVP는 internal property intelligence workflow를 우선한다. approved source/manual intake, candidate/property, client requirement, advisory AI/matching, role-based UI, audit/security/operations와 testable release controls가 포함된다. 미검증 candidate 공개, autonomous publication/permission/verification와 autonomous scraping은 포함하지 않는다.

## Beta strategy

MVP evidence 위에 verification, separate permission, exact-version proposal/publication approval, publication reconciliation와 expiry/recovery를 제한된 audience/target에서 검증한다. external effect는 human approval과 rollback/reconciliation 준비 없이는 enable하지 않는다.

## RC and Production strategy

RC는 feature freeze, migration rehearsal, security/performance/AI/UAT/DR evidence와 P0/P1 closure를 요구한다. Production은 fresh approval, cutover/rollback readiness, monitoring/hypercare staffing와 go-live checklist를 모두 통과해야 한다.

## POST-MVP strategy

external broker network, new connector, marketplace/API/analytics expansion은 `POST-MVP`다. REL-005는 planning envelope이며 새로운 approved Requirement/DEV/Feature/Test와 legal/privacy/source-policy review 전 구현하지 않는다.

## Stop conditions

missing trace/test/owner, unresolved constitutional/security/privacy/data-loss blocker, unknown publication state, failed backup/rollback 또는 stale approval이 있으면 Sprint/Release를 중단한다.

> **OPEN DECISION:** approved stack/toolchain, team capacity, environments, quantitative thresholds와 release cadence.
