# AI-MLS Security Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-047 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 기준일 | 2026-07-24 |

## Control index

| Controls | Primary category | Boundary |
|---|---|---|
| SEC-001/002/033/034 | Authorization | per-request default deny, recertification, deferred ABAC |
| SEC-003~009 | Identity & Authentication | human/service identity, MFA, session and recovery |
| SEC-010/011 | SoD / Business Authority | independent decisions and dynamic conflict checks |
| SEC-012~016 | Classification / Privacy | export, classification, masking, purpose, disposition |
| SEC-017~020 | Operational Protection | encryption, key and secret handling |
| SEC-021~024 | Audit / Event Integrity | append-only evidence, safe logs, detection/correlation |
| SEC-025~030 | Incident / Recovery | containment, recovery, backup and restore integrity |
| SEC-031/032 | AI / Connector Isolation | no AI/connector business authority |

Event identity, classification inheritance, replay protection와 retention boundary는 [Canonical Event Registry](00_EVENT_REGISTRY.md)를 참조한다.

## Authority index

- Business authority: canonical aggregate, authorized command API, approved workflow, authorized human operator.
- No business authority: Projection, Search, Cache, Dashboard, Analytics, AI, Internal Worker, External Connector, Monitoring Service, Rebuild Service.
- Monitoring/Rebuild는 operational authority만 가지며 Approval이나 business state transition을 만들지 않는다.

## Classification index

| Requested level | Canonical value |
|---|---|
| PUBLIC | `PUBLIC_APPROVED` |
| INTERNAL | `INTERNAL` |
| CONFIDENTIAL | `CONFIDENTIAL_BUSINESS` |
| RESTRICTED | `RESTRICTED_PERSONAL` / `RESTRICTED_SECURITY` |

상세 34개 control row, SoD, classification, audit/event 및 Projection security contract는 [Canonical Security Registry](00_SECURITY_REGISTRY.md)를 따른다.

## Cross-references

- [Canonical Event Registry](00_EVENT_REGISTRY.md)
- [Canonical Projection Registry](00_PROJECTION_REGISTRY.md)
- [Book 8 Security Registry](book-8/15_SECURITY_REGISTRY.md)
- [Workflow Registry](00_WORKFLOW_REGISTRY.md)
- [API Registry](00_API_REGISTRY.md)
- [Publication Registry](00_PUBLICATION_REGISTRY.md)
- [Canonical RTM](00_CANONICAL_TRACEABILITY_MATRIX.md)
- [Security Validation Report](reviews/PHASE11_6_SECURITY_VALIDATION.md)
- [Security Coverage Report](reviews/PHASE11_6_SECURITY_COVERAGE.md)
