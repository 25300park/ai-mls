# REL-002 R3-C1 Implementation Plan

Document ID DOC-DEV-385 / 버전 v0.1 / 상태 IN REVIEW / 범위 R3-C1 only.
승인 근거: DEC-199 / CR-033 / AO app_organization placement.

- [x] RED: migration artifact 및 record validation 테스트 실패 확인.
- [x] GREEN: owner schema별 versioned table, forward-only migration, lifecycle/immutability trigger, 최소 ACL.
- [x] GREEN: domain-owned async persistence contracts; existing pool port 주입만 사용.
- [x] GREEN: 세 root catalog snapshot의 exact verifier; runtime resolver 연결 없음.
- [x] VERIFY: disposable PostgreSQL lifecycle/replay/CAS/concurrency/atomicity/ACL/drift.
- [x] VERIFY: affected/full regression/build/lint/typecheck/diff/secret scan/독립 리뷰 및 completion report.

Binding→RegisteredServiceWorkload는 같은 Identity 소유 registration_id PK에 immediate NO ACTION FK. Version/tenant/principal은 추가 검증. 나머지 cross-domain 관계는 logical reference와 주입된 owner read 검증이다.

기존 approved migration/R3-B exact verifier는 수정하지 않는다. 신규 table은 additive extension이며 R3-C1 verifier는 신규 objects와 schema-level authority를 검사한다. 기존 Administration aggregate의 9-table fingerprint는 신규 적용 DB를 승인하지 않으며 후속 composition은 별도 단계다.

JSONB evidenceReferences/containedScopes, frozen createdAt, mutable status/updatedAt 및 Binding auditEvidenceRef. Runtime SELECT/INSERT와 mutable column UPDATE만 허용. 구현·검증 동안 commit/push/Production 접근 없음.

근거와 FK/ACL/readiness 경계는 [ADR-007](../adr/ADR-007-R3C1-WORKLOAD-BINDING-PERSISTENCE.md), 검증 결과와 남은 범위는 [Completion Report](../reviews/REL002_R3C1_COMPLETION.md)에 기록한다.
