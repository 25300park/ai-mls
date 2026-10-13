# REL002 Forward Registration Validator Completion

Version: v0.1
Status: DRAFT
Date: 2026-10-13
Baseline: `1aa25a73089588a3e78da55d3c97231411b2238a`

## 1. Objective

Implement the explicitly selected post-Identity014/Audit002 registration readiness contract without changing historical authority, provisioning registration roles, or executing registration.

## 2. Documents read

- Human implementation brief: `APPROVE_REL002_FORWARD_REGISTRATION_VALIDATOR_IMPLEMENTATION`.
- Human correction brief: `APPROVE_REL002_FORWARD_REGISTRATION_STRUCTURAL_BOUNDARY_CORRECTION`.
- Prior approved forward-readiness and dual-pool design reviews in this conversation.
- [Completion template](../templates/PHASE_COMPLETION_TEMPLATE.md).
- Canonical current R3C2 validators and immutable POST-023 authority source.

## 3. Files created

- [Forward validator](../../apps/api/src/forward-registration-readiness.ts).
- [Focused tests](../../apps/api/src/forward-registration-readiness.test.ts).
- [Disposable structural integration](../../scripts/rel002-forward-registration.integration.test.mjs).
- This report.

## 4. Files modified

- [Current R3C2 composition](../../apps/api/src/r3c2-aggregate-readiness.ts): operational registration readiness explicitly selects the new forward validator.

## 5. Key decisions added

Contract identity: `REL002-REGISTRATION-POST-IDENTITY014-AUDIT002-V1`.

Structural validation uses the runtime pool, complete R3C2 readiness and accepted Identity provenance. It validates the five existing child-root artifact bindings and the current Audit002/Identity014 roots through existing approved catalog validators. Unknown contract identities, unsupported majors and malformed authority results fail closed.

Authority validation uses a registration-authenticated client. Its SQL derives only the immutable role/topology/ownership/registration ACL predicates from POST-023, excluding all historical root fingerprint material. Authority validation alone is not structural readiness or execute authorization. A future runner must invoke structural validation on its runtime pool and authority validation on its separate registration pool.

The exact-query projection replaces embedded legacy operational gates only for current R3C1/R3C2B/R3C2C and approved optional Identity extension queries, including their existing normalized forms. The replacement is an unconditional structural ACL-contamination check: absence, zero grants, and subsets of the exact approved schema USAGE / three-table SELECT/INSERT grants are accepted, without requiring provisioning completeness. Wrong grantor, grant options, extra object privileges, column/function/default ACLs remain rejected. Role attributes, connection limits and membership completeness belong exclusively to operational authority. Runtime TEMPORARY remains constrained to DEC-192 PUBLIC authority with no direct runtime TEMPORARY ACL.

Historical query exports, fingerprint translations and callers are unchanged. Complete current structural checks still run; no Audit001 fallback or alternate-hash acceptance is added. Role presence alone never grants operational readiness. Operational readiness requires structural PASS and separate authority PASS; the structural composition never calls the operational registration assertion.

## 6. Open decisions

None for this bounded correction. Dual-pool runner implementation remains a separately scoped task. This implementation does not solve cross-session TOCTOU or confer a quiescent execution-window authorization.

## 7. Inconsistencies found

Full regression retains the previously documented immutable REL-001 durable-release manifest fingerprint mismatch (`aedb6aaa...` actual versus `7fef924f...` historical expected). It was not modified.

## 8. Validation performed

- Initial build rejected the missing forward module; implementation then built successfully.
- Correction TDD: role-independent projection assertions failed before replacing the legacy operational gate, then passed.
- Focused: 15 PASS.
- Combined focused/affected suites: 75 PASS / 1 SKIP (60 affected PASS, 15 focused PASS).
- PG17.11 disposable: 18 PASS.
- PG18.4 disposable: 18 PASS.
- Both versions validate absent, unprovisioned, partial and exact-grant structural states; wrong attributes/missing managed topology do not activate structural authority checks. Wrong attributes/topology operational results are explicitly mocked negative results, not live authority evidence.
- Positive exact authority is mocked. Unprovisioned/partial/absent operational states fail closed. Illegal UPDATE, grant option and wrong-grantor ACL states reject structural validation.
- Actual pre-Audit002 catalog captured within the canonical fixture sequence is rejected by the current two-root contract, independently on PG17 and PG18.
- Both suites reject all five missing artifact bindings and unavailable provenance/current-root/child readiness.
- Positive registration authority is mocked; no registration role was provisioned. Existing authority predicates are reused unchanged; component drift coverage is inherited from the unchanged current validators.
- Full compiled regression: 2172 PASS / 1 documented historical mismatch / 25 SKIP.
- Build, typecheck, scoped TypeScript lint, JavaScript syntax check, diff check and secret-literal scan: PASS.
- Historical 022/023, legacy wrapper and all prior compatibility modules: unchanged versus HEAD.
- 022 SHA256: `52cd6a2bcfc28fe9f15b73e3e0ce94e9aad232ba936214a19a9d041a58e02a5c`.
- 023 SHA256: `46a2fc069d0bdb1b55c745c793f2f043cb6bc07f1d061a949d6889a23e6bf653`.
- PG17 correction evidence: `C:/Users/Pc/AppData/Local/Temp/rel002-forward-registration-YaN3KE/result.json`.
- PG18 correction evidence: `C:/Users/Pc/AppData/Local/Temp/rel002-forward-registration-mZSoHn/result.json`.
- Both final evidence files record `aggregate=PASS` and `clusterStopped=true`.

## 9. Known limitations

No live registration role was created because provisioning is prohibited. Test-only SELECT CTEs alias the existing unused `pg_read_all_data` catalog identity and simulate approved/illegal direct ACLs; production implementation does not alter role visibility or catalogs. Authority results for these simulated states are explicitly mocked. A prior simulation using `postgres` was rejected because it also inherited unrelated ACL identities; unsuccessful evidence was retained. Mocked positive authority and immutable authority-query reuse do not constitute Production validation. The structural chain retains its existing multiple-lease behavior; PASS is not a single shared database snapshot. Neither API creates registration records or supplies execute authority. Earlier unsuccessful local runs and evidence directories were preserved.

## 10. Next brief prerequisites

Review this candidate before separately implementing the approved dual-pool runner. That runner must preserve independent authenticated identities, final live revalidation and explicit external execution/window authorization. Do not use the standalone authority result as a readiness token.

Production connection/mutation, Railway action, registration provisioning, registration dry-run, actual registration, commit and push: NONE.
