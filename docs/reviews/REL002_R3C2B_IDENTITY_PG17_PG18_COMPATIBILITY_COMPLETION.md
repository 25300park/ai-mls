# R3C2B Identity evidence PG17/PG18 compatibility

Version: v0.1
Status: IN REVIEW
Owner: Architecture Owner
Date: 2026-10-13
Baseline: 234a056746225d529b9dd84e37508c7926513ecc

## 1. Objective
Implement the approved Identity-only post-child R3C2 forward catalog boundary. No Production access, authority change, migration rewrite, registration execution, commit or push.

## 2. Documents read
AO implementation brief; [historical R3C2B query](../../apps/api/src/r3c2b-postgresql-readiness.ts); [aggregate composition](../../apps/api/src/r3c2-aggregate-readiness.ts); [registration projection](../../apps/api/src/registration-readiness-compatibility.ts); [021 proof](REL002_R3G1B_021_VERIFIER_COMPLETION.md); [canonical full fixture](../../apps/api/src/rel002-r3c2-startup-postgresql.integration.test.ts); previous component diagnostic and phase completion template.

## 3. Files created
- [Compatibility boundary](../../apps/api/src/r3c2b-identity-catalog-compatibility.ts).
- [Focused tests](../../apps/api/src/r3c2b-identity-catalog-compatibility.test.ts).
- [Disposable integration and full revalidation](../../scripts/rel002-r3c2b-identity-compatibility.integration.test.mjs).
- This report.

## 4. Files modified
[R3C2 aggregate](../../apps/api/src/r3c2-aggregate-readiness.ts): one import and replacement of the Identity evidence assertion. Identity base/provenance remains required before this assertion; R3C1 and R3C2C remain unchanged. No existing untracked file changed.

## 5. Key decisions added
No new architecture decision. PG17 requires exactly one matching Identity root, authority=true, supported version and all 19 exact component hashes. Only constraints exclude contype=n on PG17; columns.attnotnull remains exact. PG18 requires the unchanged historical fingerprint 88222856a373735336da52e4cae9f2c8. Unknown majors fail closed. The normalized whole hash is evidence only, never a PG17 acceptance shortcut.

The query reuses the existing registration ACL projection and mandatory gate without broadening it. Component acceptance does not depend on registration role existence. Approved managed presence and absence are separately tested. Historical R3C2B consumers and expected hashes remain unchanged.

## 6. Open decisions
OPEN DECISION: separate R3C2C analysis/approval is needed for the first later blocker. No fix is included here. Commit/push approval remains separate.

## 7. Inconsistencies found
Initial local integration omitted Identity006, required by current Identity002 grants; fixture ordering was corrected to canonical prerequisites. Managed grantor setup reuses the existing 021 disposable provider-provenance emulation. Failed owned clusters were stopped and evidence retained. No production guard was changed.

## 8. Validation performed
- Focused: 23 PASS, including each component drift, malformed/cardinality/authority/version failures and historical PG18 exact behavior.
- PG17.11 disposable: 24 PASS. Evidence: C:/Users/Pc/AppData/Local/Temp/rel002-r3c2b-compat-m00D03/result.json.
- PG18.4 disposable: 24 PASS. Evidence: C:/Users/Pc/AppData/Local/Temp/rel002-r3c2b-compat-NrxP4r/result.json.
- Both versions reject NOT NULL removal/addition, nullable column changes, non-n constraint addition/removal/change, index/trigger/function, schema/table owner, schema/table/column ACL, effective privilege, RLS/forceRLS, options/comment, authority and missing-root drift. Managed-role presence cannot bypass unexpected grants.
- Affected and combined prior compatibility suites: 262 PASS.
- Full regression: 2115 PASS / 1 previously approved immutable historical release fingerprint mismatch / 25 SKIP. Log: C:/Users/Pc/AppData/Local/Temp/rel002-r3c2b-regression-0e664652bd3c4464b26af4a07346e81a.log.
- Build and typecheck PASS; scoped TypeScript and JavaScript lint PASS.
- Historical migrations/checksums: 73 tracked artifacts match HEAD. Earlier compatibility modules, registration wrapper, historical R3C2B contracts and verifiers unchanged.

## 9. Known limitations
PG17 full aggregate is BLOCKED after R3C2B PASS. R3C2C has authority=true for both roots but fingerprint mismatch:
- Audit observed e0112f4fbe9d0dc82892dfb08345c2ae; expected 08339b2e6b771fce35d7d60b49a97b02.
- Identity team observed 474c1456def4862e43167f2777a94c23; expected be3dbce8569e67e89c43b75bb6e9abff.

Stopped at that gate; no R3C2C analysis/fix. Evidence: C:/Users/Pc/AppData/Local/Temp/rel002-r3c2b-compat-l4Csov/result.json. Owned clusters stopped. Full sequence includes Identity014 and Audit002; Identity015/016 excluded. Only canonical fixture ledger metadata was inserted; no actual registration/business data.

The prior untracked post-child diagnostic harness is preserved; its old exact source anchor is now obsolete and fails closed. It is not required by this implementation or new integration test.

## 10. Next brief prerequisites
AO review of this bounded candidate and separate R3C2C diagnostic scope. Production readiness is not established by local compatibility. Historical verifiers/hashes must remain immutable. No next blocker work has started; no commit or push.
