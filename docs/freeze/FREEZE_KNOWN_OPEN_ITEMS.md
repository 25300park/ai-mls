# Freeze Known Open Items

| 항목 | 값 |
|---|---|
| Document ID | DOC-FREEZE-007 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Review Board / Product Owner |
| Freeze Date | 2026-07-15 |

This snapshot contains only open items already approved to remain open in Phase 14/15 records. It introduces no new item.

## Approved Open Decisions

| Item | Existing status | Owner | Blocking effect |
|---|---|---|---|
| ADR-003 / DEC-013 PostgreSQL preferred | IN REVIEW / UNDER_REVIEW | Architecture Owner / Database Reviewer | database/provider implementation entry |
| DEC-062 RPO/RTO targets | UNDER_REVIEW | Operations Owner / Business Owner | recovery acceptance and release |
| DEC-065 SLO targets | UNDER_REVIEW | Operations Owner / Business Owner | service acceptance and release |
| `OD-ROLE` named approver/delegate and durable evidence system | KEEP OPEN | User Approver | D0 approval chain and F1/future release evidence |
| `OD-BIZ/ARCH-DATA/AI/WF-API/UI/SEC/OPS/TEST/DEV/GOV` parameter groups | KEEP OPEN | Decision Register class owners | only their stated implementation, test or release gates |

## Approved Assumptions

The following existing assumptions are accepted as open inputs, not validated facts.

| Assumption | Status | Owner | Blocking effect |
|---|---|---|---|
| ASM-001 Supabase service candidate | VALIDATING | Architecture Owner | database/deployment implementation |
| ASM-002 Next.js candidate | VALIDATING | Architecture Owner | UI/toolchain implementation |
| ASM-003 provider abstraction feasibility | VALIDATING | AI Owner | AI provider implementation |
| ASM-005 manual verification capacity | VALIDATING | Product Approver | external sharing/publication operation |
| ASM-007–008 current workflow models | VALIDATING | Business Owner | discovery baseline and KPI commitment |
| ASM-009–011 Philippine source/communication model | VALIDATING | Business Owner | source priority and measured workflow |
| ASM-012 AI provider capability | VALIDATING | AI Owner | provider contract |
| ASM-013 identity provider capability | VALIDATING | Security Reviewer | authentication implementation |
| ASM-014 rbs-homes API/contract availability | VALIDATING | Architecture Owner | connector implementation |

## Future Work

- DEV-001–024 and IMP-001–024 remain `PLANNED`.
- SP-000–010 and REL-001–005 remain planning identities; no date, capacity or release acceptance is frozen.
- Test execution, security/privacy/legal confirmation, performance baseline, backup/restore/DR exercises and operational evidence remain required at their existing gates.
- Hosting, provider, toolchain, staffing/on-call and legacy migration inputs remain governed by existing `OD-*`, ASM, DEC and roadmap records.

## POST-MVP Items

- UI-037 external partner workspace remains `POST-MVP`.
- SEC-034 future ABAC/evolution control remains `POST-MVP`.
- REL-005 is a conditional `POST-MVP` planning envelope.
- External broker contribution, cooperative network, additional connectors/APIs, analytics, marketplace and related business expansion remain within already documented `POST-MVP` authorization gates.
