# REL002 Runtime Artifact Binding A2 Completion

Version: v0.1
Status: IN REVIEW
Owner: Architecture Owner
Date: 2026-10-19
Baseline: `6f87d49d5f5d8030f2fa04a088cf4c78e78cccfd`

## 1. Objective

Complete the approved dependency-safe A2 redirect locally. Supply the exact five canonical artifact bindings through PostgreSQL physical connection startup options without changing historical Identity infrastructure or REL-001 artifact closure.

## 2. Documents read

The approved operating-principles adoption/A2 implementation brief; the preceding dependency-safe design and fingerprint root-cause evidence; [development operating principles](../governance/AI_MLS_DEVELOPMENT_OPERATING_PRINCIPLES.md); [completion template](../templates/PHASE_COMPLETION_TEMPLATE.md).

The policy was found in the primary checkout and copied byte-for-byte into this worktree. Both copies have SHA256 `76C3779C553C23C3E31F94456908FE5005CF536B13E8EF5D2F06B0797D45D788`.

## 3. Files created

- [Production runtime pool](../../apps/api/src/production-runtime-pool.ts): shared runtime-only constructor using the unchanged Identity adapter's factory injection.
- [Production runtime pool tests](../../apps/api/src/production-runtime-pool.test.ts): canonical options, override rejection, physical lifecycle model, and composition checks.
- [Closure regression test](../../scripts/rel002-runtime-artifact-closure.test.mjs): static in-memory clean-HEAD comparison; no database access.
- Worktree copy of the policy and this completion report.

## 4. Files modified

- [Candidate binding module](../../apps/api/src/runtime-artifact-startup-bindings.ts): retain canonical derivation/serialization; remove the opaque objects and upward Identity dependency.
- [Runtime configuration](../../apps/api/src/production-runtime-configuration.ts): reject environment option overrides; remove candidate-specific adapter fields.
- [Configuration tests](../../apps/api/src/production-runtime-configuration.test.ts): retain canonical binding rejection and target/TLS coverage; relocate physical lifecycle coverage.
- [Production secret resolver](../../apps/api/src/production-secret-reference-resolver.ts): use the shared Production pool constructor.
- [Registration dependency factory](../../tools/production/register-service-workload.ts): use that constructor for runtime only; registration construction is unchanged.
- [Identity adapter](../../modules/identity/src/postgresql-pool.ts): restored byte-for-byte to HEAD; no remaining candidate diff.

## 5. Key decisions added

Implemented the already-approved A2 design, not a new architecture. The canonical constructor accepts configuration and connection/CA material, not caller hashes or raw startup options. It derives five exact values from `R3B1_CHILD_ROOT_SCHEMA_CONTRACTS` and adds startup options inside the injected physical pool factory. The Identity module imports no Production/readiness code. The strict readiness helper is unchanged and inherits the same runtime constructor as normal Production startup. No post-connect SET, role/database settings, or new Railway variables are introduced.

## 6. Open decisions

No local implementation decision remains. Commit, push, deployment, Production readiness, Registration DRY_RUN, and actual registration remain separately controlled and were not performed.

## 7. Inconsistencies found

The historical REL-001 test still expects `7fef924f0178d732ca4a1bd4ee5c83c0eea7a5dafb8b1a2a28747784bbe5c659`; clean HEAD and redesigned candidate both produce `aedb6aaa7b3277125d6115ca63d7bf224895a082d3ce81791d2e22bfce701f96`. The latest brief explicitly establishes that clean-HEAD actual as the no-additional-impact gate. Historical expectations are unchanged. The earlier failed candidate report is preserved rather than overwritten as PASS.

## 8. Validation performed

- Focused configuration/pool/resolver/Identity-adapter tests plus strict helper tests: 59 PASS.
- Affected registration/R3C2/resolver tests: 155 PASS / 3 SKIP.
- Dedicated closure test: 1 PASS; all 81 file records and every component fingerprint equal clean HEAD.
- Physical lifecycle model: checkouts `[1,1,2,3]`; creation IDs `[1,2,3]`. Backend 1 is reused and then destroyed; backend 2 replaces it; backend 3 belongs to a recreated pool. All runtime creations receive identical canonical options. Registration receives none.
- TypeScript build, typecheck, scoped lint, syntax check, whitespace check, and production-source secret-literal scan: PASS.
- Full regression, run once after stabilization: 2250 PASS / 1 known historical REL-001 failure / 25 SKIP. No additional failing test. Actual fingerprint equals the approved clean-HEAD actual.
- Historical017/022/023, Forward Structure/Authority, R3C2 contracts, and strict helper remain unchanged. Unrelated untracked evidence is preserved.

## 9. Known limitations

Lifecycle evidence uses an explicit fake physical pool model, not live PostgreSQL backend PIDs. No disposable PostgreSQL server or Production connection was run. The production-only pg client bridge mirrors the existing generic bridge's immutable query results, release behavior, and pool shutdown interface. Artifact bindings declare a release contract and do not replace structural, ACL, membership, ownership, or provenance validation.

## 10. Next brief prerequisites

The stable candidate is ready for bounded commit review. Include this policy copy and the A2 files only; exclude earlier failed-candidate reports and unrelated diagnostic/evidence files. No next Production operation is authorized by this report.
