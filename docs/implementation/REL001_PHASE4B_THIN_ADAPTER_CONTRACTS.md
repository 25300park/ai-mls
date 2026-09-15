# REL-001 Phase 4B Thin Adapter Contracts

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-184 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / AI Reviewer |
| 기준일 | 2026-09-15 |

## 1. Common contract

Each thin adapter performs only:

```text
canonical handler-specific application-port input
→ existing FEAT-022 application execution boundary
→ validated canonical advisory reference/result
```

It may validate exact input shape and map existing safe FEAT-022 errors to existing Job errors. It may not select provider/model/prompt, access credentials, implement retry/fallback, parse raw provider responses, reconstruct current Session, or mutate domain state.

## 2. Capability contracts

| Port | Input boundary | FEAT-022 capability/output | Result boundary |
|---|---|---|---|
| `ParseListingInputApplicationPort` | tenant/scope, initiating principal provenance, exact immutable listing-input reference/version | `AI-001` / canonical parse schema | accepted advisory reference, checksum and safe evidence refs |
| `DraftListingContentApplicationPort` | tenant/scope, initiating principal provenance, exact immutable listing-content input reference/version | `AI-004` / canonical draft schema | accepted advisory reference, checksum and safe evidence refs |
| `GenerateMatchRecommendationsApplicationPort` | tenant/scope, initiating principal provenance, exact immutable matching input/evidence references/version | `AI-005` / canonical recommendation schema | accepted advisory reference, checksum and safe evidence refs |

The exact transformation from existing Job `inputReferences`/policy/admission references to the single FEAT-022 execution request remains an owner decision. The thin adapters cannot fabricate missing prompt, subject or evidence bindings.

## 3. Tenant/scope and provenance

- trusted Job tenant/scope passes through unchanged
- provider does not own tenant identity
- credentials do not determine tenant
- current Session reconstruction is `0`
- initiating human principal, API-017 executor, FEAT-022 execution, reviewer and provider stay distinct

## 4. Contract readiness

| Capability | Thin adapter behavior | Job-to-advisory binding | Implementation status |
|---|---|---|---|
| AI-001 | CLOSED | `OWNER_DECISION_REQUIRED` | NOT_READY |
| AI-004 | CLOSED | `OWNER_DECISION_REQUIRED` | NOT_READY |
| AI-005 | CLOSED | `OWNER_DECISION_REQUIRED` | NOT_READY |

No Production adapter or handler is created by this documentation decision.
