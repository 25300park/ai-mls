# FEAT-019 Traceability Matrix

| 항목 | 값 |
|---|---|
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner |
| Current verified phase | F19-B |

이 문서는 F19에서 실제 구현·검증된 evidence만 누적한다. API-014, API-018, API-019의 domain truth를 F19 orchestration truth로 대체하지 않는다.

| Requirement | Canonical source | Production evidence | Direct verification | Status |
|---|---|---|---|---|
| Cross-domain orchestration identity | `F19_RECONCILIATION_RECOVERY_CANONICAL_DESIGN_V1.md` §2 | `recovery-orchestration-contracts.ts`, `recovery-durable-persistence.ts` | durable reopen 및 parent/child lineage tests | IMPLEMENTED_AND_VERIFIED |
| Closed internal commands and safe views | Design §5 | `recovery-orchestration-service.ts` | closed request/unknown-field, response-key 및 architecture tests | IMPLEMENTED_AND_VERIFIED |
| Separate append-only finding/disposition | Design §3~4 | `recovery-durable-persistence.ts` | unresolved→terminal append, raw update/delete rejection tests | IMPLEMENTED_AND_VERIFIED |
| Trusted Session, authority, MFA and SoD | Design §6 | `recovery-orchestration-service.ts` | trusted human success, evidence-submitter/weak-assurance/body-claim/wrong-scope rejection tests | IMPLEMENTED_AND_VERIFIED |
| Domain-owned new execution identity | Design §4 | injected `RecoveryExecutionIdentityValidator` boundary | validator rejection with zero disposition mutation | IMPLEMENTED_AND_VERIFIED |
| Atomic recovery binding | Design §4, §7~8 | SQLite transaction binds origin, decision version, finding, disposition, execution identity, idempotency and evidence | restart replay/conflict and injected idempotency-failure rollback tests | IMPLEMENTED_AND_VERIFIED |
| Domain truth and external-effect isolation | Design §1, §9 | `modules/recovery` has no Publication/Connector/API-019 repository or provider dependency | architecture assertion and affected 52/52 regression | IMPLEMENTED_AND_VERIFIED |
| Full regression and dependency gate | F19-B completion gate | production change confined to `modules/recovery`; dependency/lockfile change 0 | focused 12/12; affected 52/52; total 921/921; lint/typecheck/build PASS; production audit 0; full audit 기존 승인 dev-only High 4; new unapproved High/Critical 0 | VERIFIED |

## Deferred boundaries

- F19-C Publication Resolve vs Recover semantic separation: `NOT_STARTED`
- F19-D Connector recovery handoff: `NOT_STARTED`
- F19-E API-019 business handoff: `NOT_STARTED`
- F19-F nested ambiguity/idempotency hardening beyond the F19-B persistence invariants: `NOT_STARTED`
- F19-G Runtime/API-017: `DEFERRED / API-017 NOT_REQUIRED`
- F19-H final integration: `NOT_STARTED`
