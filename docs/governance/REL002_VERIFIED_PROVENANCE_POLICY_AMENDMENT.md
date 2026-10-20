# REL002 verified provenance policy amendment

Status: APPROVED by the current explicit AO policy decision.
Scope: REL002 forward Production strict-readiness helper only.

Accept exactly NATIVE_MIGRATION_LEDGER_VERIFIED and HISTORICAL_MIGRATION_ATTESTATION_VERIFIED from the independently enforced forward readiness receipt. Preserve the observed class in output; never relabel historical provenance as native. Reject missing, empty, unknown, unverified and all other values.

This forward decision supersedes the helper's earlier native-only restriction for this scope. Historical evidence, migrations, verifiers, fingerprints and database history remain immutable. No native ledger evidence may be fabricated. No Production mutation or registration authority is conferred.

All configuration, identity, Full R3C2, provenance-verification, artifact, registration-session, backend-separation, target, authority, receipt-flag, writes=0 and pool-cleanup gates remain required. The helper-only trace label is VERIFIED_PROVENANCE to reflect the two distinct accepted classes accurately. Registration dry-run, actual registration, deployment and Production readiness execution still require separate authorization.
