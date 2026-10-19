# REL002 Physical Connection Failure Classification

Version: v0.1
Status: IN REVIEW
Owner: Architecture Owner
Date: 2026-10-19
Baseline: `98040aeb6136d074d95dce5bfd2112457164cf69`

## 1. Objective

Implement the approved diagnostic-only connection classification and separate DNS-family inspection. The supplied Production evidence confirms PHYSICAL_CONNECTION fails before readiness SQL. It does not yet establish DNS, routing, TLS, credentials, or startup GUC rejection as the cause.

## 2. Documents read

Current approved classification brief; [operating principles](../governance/AI_MLS_DEVELOPMENT_OPERATING_PRINCIPLES.md); [preceding diagnostic report](REL002_PRODUCTION_STARTUP_DATABASE_READINESS_DIAGNOSTIC_COMPLETION.md); canonical pool source and installed node-postgres/pg-pool error handling.

## 3. Files created

- [Connection diagnostics](../../apps/api/src/production-connection-diagnostics.ts): fixed transport categories, bounded nested-code inspection, and separately invoked DNS-family inspection.
- [Diagnostic tests](../../apps/api/src/production-connection-diagnostics.test.ts).
- This report.

## 4. Files modified

- [Production runtime pool](../../apps/api/src/production-runtime-pool.ts): add transportCode to physical connection failure metadata; retain legacy safe code and SQLSTATE fields.
- [Pool diagnostic tests](../../apps/api/src/production-runtime-database-diagnostics.test.ts): verify nested network failure classification and sanitization.

## 5. Key decisions added

pg-pool forwards client connection errors and can wrap timeout errors with a nested cause. Node connection failures can also be aggregate errors. Classification inspects only own code/errno/cause/errors data properties, with bounded traversal and cycle protection. Numeric errno is mapped through Node's platform error-name map; raw errno/syscall/address/message/name/stack are not emitted. Unknown and mixed/truncated aggregates stay UNKNOWN_CONNECTION_FAILURE. PostgreSQL SQLSTATE remains restricted to the existing class allowlist.

No connection target, family preference, fallback, TLS, timeout, startup option, artifact value, credential, authority, role/ACL, migration or Railway variable was changed. No automatic pooler switch is introduced.

## 6. Open decisions

Actual Production transport classification and same-runtime DNS-family evidence remain pending separately authorized Human execution. The IPv6-routing hypothesis is unproven. Only observed dnsIPv4Available=false, dnsIPv6Available=true, and transportCode=NETWORK_UNREACHABLE together support an IPv6 direct-path reachability explanation; they do not authorize endpoint or architecture changes.

## 7. Inconsistencies found

The previous safe-code allowlist omitted ENETUNREACH and did not inspect nested causes, so READINESS_UNAVAILABLE with null SQLSTATE could conceal a network error. This is a capability gap, not proof that Production encountered ENETUNREACH.

## 8. Validation performed

- Focused mapping, DNS, pool and diagnostic tests: 28 PASS. Coverage includes requested DNS/network/refusal/timeout/reset codes, representative TLS codes, SQLSTATE, nested/aggregate errors, unknown input, accessors, native errno, and sanitized booleans.
- Affected startup/registration/R3C2/strict helper tests: 246 PASS / 3 SKIP.
- REL-001 closure test: 1 PASS, 81 files and unchanged component fingerprints; actual remains `aedb6aaa7b3277125d6115ca63d7bf224895a082d3ce81791d2e22bfce701f96`.
- Build, typecheck, scoped lint, whitespace and secret-literal checks PASS.
- Full regression evidence reused as authorized: 2256 PASS / 1 known historical REL-001 mismatch / 25 SKIP. No new full-suite run; changed diagnostic behavior is covered by focused/affected tests.
- Protected Identity adapter, historical migrations/verifiers, startup serialization, forward contracts, and strict helper remain unchanged.

## 9. Known limitations

DNS tests inject resolver results; no real DNS lookup or Production connection ran. DNS inspection is not called by pool/startup/readiness, so startup timing and decisions remain unchanged. Both false flags mean neither family was observed, which can also result from lookup failure. Address-family availability is not egress reachability. The allowlist cannot classify message-only errors with no recognized code or cause; these remain unknown.

## 10. Next brief prerequisites

Review and separately authorize diagnostic rollout. After the module is available in the intended Railway runtime, the Human may separately approve this credential-free DNS-only command from its application root:

```sh
node --input-type=module -e "import { diagnoseProductionDatabaseDnsFamilies as probe } from './dist/apps/api/src/production-connection-diagnostics.js'; process.stdout.write(JSON.stringify(await probe())+'\n');"
```

It outputs only dnsIPv4Available/dnsIPv6Available booleans and does not create a pool or inspect environment secrets. It was not executed. Laptop DNS results must not be treated as Railway evidence. No deployment, restart, Railway action, credential change, Production connection, commit, or push occurred.
