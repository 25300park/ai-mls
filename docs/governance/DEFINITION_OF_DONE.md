# AI-MLS Platform Definition of Done (DoD)

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Mandatory |
| Document Lifecycle | APPROVED |
| Effective From | SP-004 |

## Objective

A Sprint is considered complete only when every item in this checklist has been satisfied. Partial completion is not considered "Done."

## 1. Scope

- [ ] Sprint scope matches the approved Architecture Bible.
- [ ] No functionality outside the approved sprint scope has been implemented.
- [ ] No future sprint work has been started.

## 2. Architecture

- [ ] Architecture Bible remains unchanged unless explicitly approved.
- [ ] Feature IDs are fully implemented.
- [ ] API IDs are fully implemented.
- [ ] Workflow IDs are fully implemented.
- [ ] Security controls required by the sprint are implemented.
- [ ] AI capability mappings are complete where applicable.

## 3. Code Quality

All must pass:

- [ ] Lint
- [ ] Type Check
- [ ] Build
- [ ] Aggregate Verify

No warnings may be ignored without documented approval.

## 4. Testing

- [ ] Sprint acceptance tests added.
- [ ] Existing regression tests pass.
- [ ] Total test suite passes.
- [ ] No failing or skipped mandatory tests.

## 5. Security

- [ ] Gitleaks: Actual Secrets = 0.
- [ ] Gitleaks: Unexplained Findings = 0.
- [ ] Dependency Audit: Known Vulnerabilities = 0.
- [ ] No credentials committed.
- [ ] No `.env` modifications unless explicitly approved.
- [ ] No NAS or infrastructure configuration changes unless included in sprint scope.

## 6. Data Integrity

- [ ] Idempotency preserved.
- [ ] Immutable Audit preserved.
- [ ] Provenance preserved.
- [ ] Classification inheritance preserved.
- [ ] Safe error contracts maintained.

## 7. Repository

- [ ] Working tree is clean.
- [ ] One logical completion commit created.
- [ ] Commit message follows sprint convention.
- [ ] No temporary files remain.
- [ ] No probe files remain.

## 8. Documentation

Sprint completion report includes:

- [ ] Scope implemented
- [ ] Files created
- [ ] Files modified
- [ ] Feature IDs
- [ ] API IDs
- [ ] Workflow IDs
- [ ] AI Capability IDs, if applicable
- [ ] Security controls applied
- [ ] Test summary
- [ ] Build summary
- [ ] Gitleaks summary
- [ ] Dependency audit summary
- [ ] Deferred decisions
- [ ] Remaining risks

## 9. Architecture Review

Architecture Owner confirms:

- [ ] Sprint acceptance
- [ ] Implementation consistency
- [ ] Traceability
- [ ] Security compliance
- [ ] AI boundary compliance

## 10. Exit Criteria

A Sprint is officially complete only when all of the following are true:

- [ ] Scope complete
- [ ] Tests passing
- [ ] Security gates passing
- [ ] Documentation complete
- [ ] Repository clean
- [ ] Architecture Owner approval received

Only after these conditions are met may the next Sprint begin.
