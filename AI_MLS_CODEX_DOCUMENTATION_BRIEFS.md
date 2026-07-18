# AI MLS Platform Architecture Bible
## Codex Command Brief Master Set

**Project:** mrHOMES AI MLS  
**Purpose:** Create all architecture and development-standard documents before source-code development  
**Execution rule:** Run one brief at a time, in the listed order  
**Output language:** Korean for explanatory documents, English for technical identifiers, filenames, schemas, and code examples  
**Code restriction:** Do not implement production features during documentation phases

| Item | Value |
|---|---|
| Document ID | DOC-CORE-004 |
| Version | v1.0 |
| Status | FROZEN |
| Owner | Architecture Owner |

---

# 0. Global Codex Operating Brief

Use this brief once before all documentation work.

```text
You are working on the mrHOMES AI MLS documentation project.

Primary objective:
Create the complete AI MLS Platform Architecture Bible before production coding begins.

Core product definition:
The AI MLS is an internal property intelligence platform that discovers or receives property candidates from multiple sources, structures and normalizes them, matches them to client requirements, supports staff verification, and allows only verified and approved listings to be shared with clients or published to rbs-homes.com.

Non-negotiable principles:
1. AI recommends; humans approve.
2. Unverified candidates remain internal.
3. Discovered, verified, and publishable data must be separated.
4. Every important record must preserve source provenance.
5. Client-sharing permission and public-publication permission are separate.
6. Contact information is restricted and access-logged.
7. Raw data has a retention period.
8. Important state changes require audit logs.
9. Connectors are separate from the AI MLS core.
10. No autonomous Facebook or Viber scraping is included in MVP.
11. No production feature code is to be implemented during the documentation phase.
12. Every architectural decision must be traceable.

Working rules:
- Read all existing documents before creating or modifying any document.
- Do not delete existing documents unless explicitly instructed.
- Do not silently change previously approved decisions.
- Use consistent terminology across all documents.
- Add cross-references between related documents.
- Use Mermaid diagrams where useful.
- Use tables for rules, states, permissions, APIs, and data fields.
- Mark unresolved decisions as OPEN DECISION.
- Mark assumptions as ASSUMPTION.
- Mark future functionality as POST-MVP.
- Use version number v0.1 during drafting.
- At the end of each brief, create a completion report.
- Stop after completing the requested brief.
- Do not begin the next brief automatically.

Required completion report format:
1. Objective
2. Documents read
3. Files created
4. Files modified
5. Key decisions added
6. Open decisions
7. Inconsistencies found
8. Validation performed
9. Known limitations
10. Next brief prerequisites
```

---

# 1. Brief A0 — Documentation Workspace Foundation

```text
Create the documentation workspace for the AI MLS Platform Architecture Bible.

Objectives:
- Create a clean documentation structure.
- Establish master navigation.
- Define terminology and versioning.
- Prepare ADR and review workflows.

Create:
- README.md
- AGENTS.md
- docs/00_MASTER_INDEX.md
- docs/00_DOCUMENT_GOVERNANCE.md
- docs/00_GLOSSARY.md
- docs/00_VERSION_HISTORY.md
- docs/adr/README.md
- docs/reviews/README.md
- docs/templates/ADR_TEMPLATE.md
- docs/templates/REVIEW_TEMPLATE.md
- docs/templates/PHASE_COMPLETION_TEMPLATE.md

Requirements:
- README.md must explain the product, documentation-first process, and phase sequence.
- AGENTS.md must contain Codex rules, source-of-truth priority, prohibited actions, and completion-report rules.
- MASTER_INDEX must list every planned book and appendix.
- DOCUMENT_GOVERNANCE must define document owner, status values, review flow, versioning, change control, and freeze rules.
- GLOSSARY must define at least:
  AI MLS, candidate listing, verified listing, publishable listing, property, tower, unit entity, listing offer, source record, contact, client requirement, match result, verification, publication approval, connector, collector, provenance, confidence score, audit log.
- ADR template must include context, decision, alternatives, consequences, security impact, privacy impact, and status.
- Use statuses: DRAFT, IN REVIEW, APPROVED, FROZEN, SUPERSEDED.

Do not:
- Create application source code.
- Create final database schema.
- Create final API endpoints.

Acceptance criteria:
- All documents are linked from MASTER_INDEX.
- Terminology is consistent.
- Governance explains how v1.0 will be frozen.
- Completion report is created at docs/reviews/A0_COMPLETION.md.
```

---

# 2. Brief A1 — Book 0: Project Constitution

```text
Create Book 0: AI MLS Project Constitution.

Read:
- README.md
- AGENTS.md
- docs/00_MASTER_INDEX.md
- docs/00_DOCUMENT_GOVERNANCE.md
- docs/00_GLOSSARY.md

Create:
- docs/book-0/00_PROJECT_CONSTITUTION.md
- docs/book-0/01_MISSION_VISION_VALUES.md
- docs/book-0/02_PRODUCT_PRINCIPLES.md
- docs/book-0/03_AI_PRINCIPLES.md
- docs/book-0/04_DATA_PRINCIPLES.md
- docs/book-0/05_SECURITY_PRIVACY_PRINCIPLES.md
- docs/book-0/06_DEVELOPMENT_PRINCIPLES.md
- docs/book-0/07_DECISION_RULES.md
- docs/book-0/08_DEFINITION_OF_DONE.md

Required content:
- Mission and long-term vision for mrHOMES AI MLS.
- Clear product identity: internal Property Intelligence Platform first, cooperative MLS later.
- Immutable principles.
- Human-in-the-loop rules.
- Rules separating discovered, verified, customer-shareable, and publishable data.
- AI authority boundaries.
- Data provenance and retention rules.
- Privacy and security rules.
- Rules for source collection.
- Rules for changing architecture.
- Definition of Done for documents and future software features.

Mandatory constitutional rules:
1. AI cannot approve publication.
2. Unverified records cannot be externally exposed.
3. Source evidence must be retained or referenced.
4. Contact data must be access-controlled.
5. Every publication must trace back to verification and permission.
6. Source collectors must remain isolated from the core.
7. Platform changes require an ADR.
8. No automatic public posting without human approval.
9. No third-party account credentials may be placed in prompts.
10. No connector may be implemented without source-policy approval.

Add:
- A concise constitution summary at the top.
- A precedence rule explaining which document wins when documents conflict.
- A change-control section requiring review and version updates.

Acceptance criteria:
- Constitution can guide developers without additional interpretation.
- No contradiction exists between files.
- All terms use the glossary.
- Completion report: docs/reviews/A1_COMPLETION.md.
```

---

# 3. Brief A2 — Book 1: Business Strategy

```text
Create Book 1: Business Strategy for the AI MLS Platform.

Read:
- Book 0
- Master Index
- Glossary
- Existing MVP master plan if present

Create:
- docs/book-1/00_BUSINESS_STRATEGY_INDEX.md
- docs/book-1/01_PROBLEM_STATEMENT.md
- docs/book-1/02_CURRENT_WORKFLOW_ANALYSIS.md
- docs/book-1/03_TARGET_USERS_AND_PERSONAS.md
- docs/book-1/04_VALUE_PROPOSITION.md
- docs/book-1/05_US_MLS_COMPARISON.md
- docs/book-1/06_PHILIPPINE_MARKET_CONTEXT.md
- docs/book-1/07_BUSINESS_MODEL.md
- docs/book-1/08_PRODUCT_SCOPE_AND_NON_GOALS.md
- docs/book-1/09_SUCCESS_METRICS.md
- docs/book-1/10_LONG_TERM_ROADMAP.md

Required business model:
- Primary initial value: reduce staff search time.
- Internal use first.
- Verified information only for external use.
- Future broker contribution network.
- Possible future revenue:
  brokerage improvement, broker membership, enterprise subscription, analytics, API access, developer partnerships.

Required personas:
- Collector
- Agent
- Senior Agent
- Manager
- Administrator
- External Broker, POST-MVP
- Client/Tenant/Buyer

US MLS comparison must distinguish:
- cooperative broker network;
- member-submitted authoritative listing data;
- common rules and governance;
- standard data exchange;
- mrHOMES candidate-discovery model;
- future path toward a cooperative network.

Define MVP KPIs:
- search time per client request;
- time to first shortlist;
- parse accuracy;
- duplicate reduction;
- verified-available rate;
- viewing conversion;
- closing contribution by source;
- unauthorized publication count.

Do not:
- Present speculative market numbers as fact.
- Define implementation-level schemas.

Acceptance criteria:
- Business objectives are measurable.
- MVP and future platform are clearly separated.
- Non-goals prevent scope creep.
- Completion report: docs/reviews/A2_COMPLETION.md.
```

---

# 4. Brief A3 — Book 2: System Architecture

```text
Create Book 2: System Architecture.

Read:
- Book 0
- Book 1
- Existing ADRs
- Glossary

Create:
- docs/book-2/00_ARCHITECTURE_INDEX.md
- docs/book-2/01_ARCHITECTURE_OVERVIEW.md
- docs/book-2/02_CONTEXT_DIAGRAM.md
- docs/book-2/03_CONTAINER_ARCHITECTURE.md
- docs/book-2/04_MODULE_ARCHITECTURE.md
- docs/book-2/05_DATA_FLOW_ARCHITECTURE.md
- docs/book-2/06_EVENT_AND_JOB_ARCHITECTURE.md
- docs/book-2/07_INTEGRATION_ARCHITECTURE.md
- docs/book-2/08_FAILURE_ISOLATION.md
- docs/book-2/09_SCALABILITY_AND_EVOLUTION.md
- docs/book-2/10_ARCHITECTURE_DECISIONS_SUMMARY.md

Required modules:
- Authentication and Authorization
- Source Registry
- Intake
- Raw Source Store
- AI Parsing
- Property Normalization
- Candidate Listings
- Duplicate Engine
- Contact Management
- Client Requirements
- Matching Engine
- Verification
- Customer Proposal
- Publication Approval
- rbs-homes Integration
- Audit
- Reporting
- Administration
- Connector Boundary

Required architecture principles:
- Modular monolith for MVP unless existing repo dictates otherwise.
- Connectors and collectors isolated from core.
- AI providers behind an abstraction layer.
- Background jobs for parsing, rematching, retention, expiration, publication retry.
- No direct AI write to authoritative states without application validation.
- No direct collector access to publication functions.

Create Mermaid diagrams:
- System context
- Container architecture
- Main discovery-to-publication data flow
- Failure isolation
- Future external broker architecture

Record ADR proposals for:
- ADR-001 Separate AI MLS repository
- ADR-002 Modular monolith MVP
- ADR-003 PostgreSQL preferred
- ADR-004 Human approval for publication
- ADR-005 Connector isolation
- ADR-006 Provider-independent AI layer

Acceptance criteria:
- Every major module has responsibility, inputs, outputs, and boundaries.
- Architecture supports both manual intake and future connectors.
- Completion report: docs/reviews/A3_COMPLETION.md.
```

---

# 5. Brief Phase 4 — Book 3: Data and Database Architecture

```text
Create Book 3: Data and Database Architecture.

Read:
- Books 0–2
- Glossary
- ADRs

Create:
- docs/book-3/00_DATA_ARCHITECTURE_INDEX.md
- docs/book-3/01_DATA_DOMAIN_MODEL.md
- docs/book-3/02_ENTITY_RELATIONSHIP_MODEL.md
- docs/book-3/03_DATABASE_STANDARDS.md
- docs/book-3/04_SOURCE_AND_RAW_DATA_MODEL.md
- docs/book-3/05_PROPERTY_MASTER_MODEL.md
- docs/book-3/06_CANDIDATE_AND_OFFER_MODEL.md
- docs/book-3/07_CONTACT_MODEL.md
- docs/book-3/08_CLIENT_AND_REQUIREMENT_MODEL.md
- docs/book-3/09_MATCHING_MODEL.md
- docs/book-3/10_VERIFICATION_AND_PERMISSION_MODEL.md
- docs/book-3/11_PUBLICATION_MODEL.md
- docs/book-3/12_AUDIT_AND_HISTORY_MODEL.md
- docs/book-3/13_RETENTION_AND_DELETION_MODEL.md
- docs/book-3/14_INDEXING_AND_SEARCH_STRATEGY.md
- docs/book-3/15_DATABASE_DICTIONARY.md

Required entities:
- users, roles, teams
- source_registry, source_policy_reviews
- raw_source_items, raw_source_attachments
- properties, property_aliases, towers, unit_entities
- listing_candidates, listing_offers, listing_sources
- contacts, contact_channels, contact_verifications, contact_interactions
- clients, client_requirements
- match_results, match_score_details
- verification_tasks, verification_logs
- permissions, publication_approvals, published_listing_links
- status_history, audit_logs
- ai_jobs, ai_results, prompt_versions
- retention_jobs, system_errors

Critical modeling rules:
- Physical unit/entity is separate from source post.
- Candidate listing is separate from listing offer.
- One unit may have multiple offers and contacts.
- Verification is time-bound.
- Customer-sharing permission and publication permission are separate.
- Published records reference approval and verification evidence.
- Raw content has retention_until.
- Contact fields may require encryption and searchable hashes.

Output:
- Mermaid ERD.
- Table-by-table data dictionary.
- Primary keys, foreign keys, unique constraints, indexes.
- Status fields and audit requirements.
- Candidate examples.

Do not:
- Generate executable production migrations yet.
- Use ambiguous generic columns without explanation.

Acceptance criteria:
- Model supports duplicates without deleting provenance.
- All lifecycle transitions are representable.
- Data dictionary is implementation-ready.
- Completion report: docs/reviews/PHASE4_COMPLETION.md.
```

---

# 6. Brief Phase 5 — Book 4: AI Architecture

```text
Create Book 4: AI Architecture.

Read:
- Books 0–4
- Data dictionary
- Product principles

Create:
- docs/book-4/00_AI_ARCHITECTURE_INDEX.md
- docs/book-4/01_AI_ROLE_AND_BOUNDARIES.md
- docs/book-4/02_PROVIDER_ABSTRACTION.md
- docs/book-4/03_LISTING_PARSER.md
- docs/book-4/04_PROPERTY_NORMALIZATION.md
- docs/book-4/05_DUPLICATE_DETECTION.md
- docs/book-4/06_REQUIREMENT_PARSER.md
- docs/book-4/07_MATCHING_AND_RANKING.md
- docs/book-4/08_NATURAL_LANGUAGE_SEARCH.md
- docs/book-4/09_CONFIDENCE_AND_VALIDATION.md
- docs/book-4/10_HUMAN_REVIEW.md
- docs/book-4/11_PROMPT_VERSIONING.md
- docs/book-4/12_AI_OBSERVABILITY.md
- docs/book-4/13_AI_JSON_SCHEMAS.md
- docs/book-4/14_PROMPT_LIBRARY.md

Required AI functions:
- Extract structured fields from copied posts.
- Suggest canonical property names.
- Score duplicate probability.
- Parse natural-language client requirements.
- Rank candidate matches.
- Generate explanations and summaries.

Prohibited AI functions:
- Approve a listing.
- Infer publication permission.
- Publish externally.
- Expose unrestricted contact details.
- Directly modify authoritative state.
- Control Facebook or Viber accounts.
- Bypass application validation.

For every AI feature document:
- business purpose;
- inputs;
- output schema;
- validation rules;
- confidence fields;
- error handling;
- human-review condition;
- logging and metrics;
- privacy concerns;
- fallback behavior.

Create JSON schema examples for:
- listing parse result;
- property normalization suggestion;
- duplicate score;
- client requirement parse;
- match explanation.

Acceptance criteria:
- All AI outputs are deterministic in structure.
- Every output is validated before persistence.
- Human-review thresholds are defined.
- Completion report: docs/reviews/PHASE5_COMPLETION.md.
```

---

# 7. Brief Phase 6 — Book 5: Workflow and Lifecycle Bible

```text
Create Book 5: Workflow and Lifecycle Bible.

Read:
- Books 0–5
- Data model
- AI architecture

Create:
- docs/book-5/00_WORKFLOW_INDEX.md
- docs/book-5/01_LISTING_DISCOVERY_WORKFLOW.md
- docs/book-5/02_RAW_INTAKE_WORKFLOW.md
- docs/book-5/03_PARSE_AND_REVIEW_WORKFLOW.md
- docs/book-5/04_DUPLICATE_REVIEW_WORKFLOW.md
- docs/book-5/05_CLIENT_REQUIREMENT_WORKFLOW.md
- docs/book-5/06_MATCHING_WORKFLOW.md
- docs/book-5/07_CONTACT_AND_VERIFICATION_WORKFLOW.md
- docs/book-5/08_CUSTOMER_PROPOSAL_WORKFLOW.md
- docs/book-5/09_PUBLICATION_APPROVAL_WORKFLOW.md
- docs/book-5/10_EXPIRATION_AND_REVERIFICATION.md
- docs/book-5/11_ERROR_AND_EXCEPTION_WORKFLOWS.md
- docs/book-5/12_STATUS_DICTIONARY.md
- docs/book-5/13_STATE_TRANSITION_RULES.md

Required listing lifecycle:
DISCOVERED
PARSED
REVIEW_PENDING
REVIEWED
DUPLICATE
TO_CONTACT
CONTACTED
VERIFIED_AVAILABLE
VERIFIED_UNAVAILABLE
PERMISSION_PENDING
APPROVED_INTERNAL
APPROVED_PUBLICATION
PUBLISHED
EXPIRED
REJECTED

For each transition define:
- current state;
- target state;
- authorized role;
- mandatory fields;
- validation;
- side effects;
- audit event;
- rollback or correction path.

Required Mermaid diagrams:
- Listing lifecycle
- Client requirement to proposal
- Verification process
- Publication approval
- Expiration and re-verification

Acceptance criteria:
- No state can bypass verification and approval.
- Every exceptional condition has a defined route.
- Completion report: docs/reviews/PHASE6_COMPLETION.md.
```

---

# 8. Brief Phase 7 — Book 6: API and Integration Bible

```text
Create Book 6: API and Integration Bible.

Read:
- Books 0–6
- Data dictionary
- Workflows

Create:
- docs/book-6/00_API_INDEX.md
- docs/book-6/01_API_STANDARDS.md
- docs/book-6/02_AUTH_AND_IDENTITY_API.md
- docs/book-6/03_SOURCE_AND_INTAKE_API.md
- docs/book-6/04_PROPERTY_AND_CANDIDATE_API.md
- docs/book-6/05_CONTACT_API.md
- docs/book-6/06_CLIENT_AND_REQUIREMENT_API.md
- docs/book-6/07_MATCHING_API.md
- docs/book-6/08_VERIFICATION_API.md
- docs/book-6/09_PUBLICATION_API.md
- docs/book-6/10_ADMIN_AND_AUDIT_API.md
- docs/book-6/11_BACKGROUND_JOB_CONTRACTS.md
- docs/book-6/12_CONNECTOR_CONTRACT.md
- docs/book-6/13_RBS_HOMES_INTEGRATION.md
- docs/book-6/14_API_MAP.md

For each endpoint define:
- method and route;
- purpose;
- authorized roles;
- request schema;
- response schema;
- validation;
- status transition;
- audit requirement;
- idempotency requirement;
- common errors.

Define:
- pagination;
- filtering;
- sorting;
- error envelope;
- correlation IDs;
- API versioning;
- rate limits;
- webhooks or events if needed;
- retry policy;
- idempotency keys for publication.

Do not:
- Write implementation code.
- Assume an rbs-homes API exists unless marked ASSUMPTION.

Acceptance criteria:
- API supports all MVP workflows.
- Publication cannot bypass approval.
- Connector contract cannot access private core functions directly.
- Completion report: docs/reviews/PHASE7_COMPLETION.md.
```

---

# 9. Brief A8 — Book 7: UI/UX Bible

```text
Create Book 7: UI/UX Bible.

Read:
- Books 0–7
- Personas
- Workflows
- Roles and API map

Create:
- docs/book-7/00_UI_UX_INDEX.md
- docs/book-7/01_DESIGN_PRINCIPLES.md
- docs/book-7/02_INFORMATION_ARCHITECTURE.md
- docs/book-7/03_NAVIGATION_AND_ROLES.md
- docs/book-7/04_DASHBOARD.md
- docs/book-7/05_MANUAL_INTAKE.md
- docs/book-7/06_RAW_SOURCE_ITEMS.md
- docs/book-7/07_CANDIDATE_LISTINGS.md
- docs/book-7/08_PROPERTY_MASTER.md
- docs/book-7/09_DUPLICATE_REVIEW.md
- docs/book-7/10_CLIENT_REQUIREMENTS.md
- docs/book-7/11_MATCH_RESULTS.md
- docs/book-7/12_VERIFICATION_BOARD.md
- docs/book-7/13_CONTACTS.md
- docs/book-7/14_CUSTOMER_PROPOSAL.md
- docs/book-7/15_PUBLICATION_APPROVAL.md
- docs/book-7/16_SOURCE_MANAGEMENT.md
- docs/book-7/17_ADMIN_AND_AUDIT.md
- docs/book-7/18_SYSTEM_HEALTH.md
- docs/book-7/19_COMPONENT_CATALOG.md
- docs/book-7/20_ACCESSIBILITY_AND_MOBILE.md

For each screen define:
- purpose;
- authorized roles;
- main components;
- fields;
- actions;
- states;
- loading/empty/error states;
- mobile behavior;
- audit-sensitive actions;
- related API;
- acceptance criteria.

Include textual wireframes.
Use Mermaid user-flow diagrams where appropriate.

UX requirements:
- Unverified information must be visually distinct.
- Restricted contact data must be masked.
- Publication approval must show verification and permission evidence.
- Staff should save a copied listing in under 30 seconds.
- Client requirement entry should take under two minutes.
- Main review screens must be mobile-usable.

Acceptance criteria:
- Every MVP workflow has screens.
- No screen exposes restricted data to unauthorized roles.
- Completion report: docs/reviews/A8_COMPLETION.md.
```

---

# 10. Brief A9 — Book 8: Security, Privacy, and Compliance Bible

```text
Create Book 8: Security, Privacy, and Compliance Bible.

Read:
- Books 0–8
- Data model
- Roles
- Workflows

Create:
- docs/book-8/00_SECURITY_INDEX.md
- docs/book-8/01_SECURITY_MODEL.md
- docs/book-8/02_THREAT_MODEL.md
- docs/book-8/03_AUTHENTICATION.md
- docs/book-8/04_AUTHORIZATION.md
- docs/book-8/05_CONTACT_DATA_PROTECTION.md
- docs/book-8/06_ENCRYPTION_AND_SECRETS.md
- docs/book-8/07_AUDIT_AND_MONITORING.md
- docs/book-8/08_DATA_CLASSIFICATION.md
- docs/book-8/09_PRIVACY_PRINCIPLES.md
- docs/book-8/10_RETENTION_AND_DELETION.md
- docs/book-8/11_SOURCE_COLLECTION_COMPLIANCE.md
- docs/book-8/12_INCIDENT_RESPONSE.md
- docs/book-8/13_BACKUP_AND_RECOVERY.md
- docs/book-8/14_SECURITY_TEST_REQUIREMENTS.md

Threats to cover:
- unauthorized contact access;
- credential exposure;
- source-policy violations;
- accidental external publication;
- privilege escalation;
- audit-log tampering;
- raw-data over-retention;
- AI prompt leakage;
- malicious or malformed source content;
- duplicate or stale listing publication;
- connector compromise;
- mini-PC collector compromise.

Define:
- role permission matrix;
- field masking;
- encryption requirements;
- secret storage;
- session policy;
- audit events;
- retention examples;
- incident severity and response;
- backup and restore requirements.

Do not:
- Claim legal compliance is guaranteed.
- Store sensitive credentials in examples.

Acceptance criteria:
- Controls map to system modules and workflows.
- Privacy principles are enforceable by design.
- Completion report: docs/reviews/A9_COMPLETION.md.
```

---

# 11. Brief A10 — Book 9: Deployment, Infrastructure, and Operations Bible

```text
Create Book 9: Deployment, Infrastructure, and Operations Bible.

Read:
- Books 0–9
- System architecture
- Security requirements

Create:
- docs/book-9/00_OPERATIONS_INDEX.md
- docs/book-9/01_ENVIRONMENT_STRATEGY.md
- docs/book-9/02_DEPLOYMENT_ARCHITECTURE.md
- docs/book-9/03_FRONTEND_DEPLOYMENT.md
- docs/book-9/04_API_AND_WORKER_DEPLOYMENT.md
- docs/book-9/05_DATABASE_AND_STORAGE.md
- docs/book-9/06_MINI_PC_AND_COLLECTOR_BOUNDARY.md
- docs/book-9/07_NETWORK_AND_TAILSCALE.md
- docs/book-9/08_CONFIGURATION_AND_SECRETS.md
- docs/book-9/09_LOGGING_AND_MONITORING.md
- docs/book-9/10_BACKUP_AND_RESTORE.md
- docs/book-9/11_FAILURE_RECOVERY.md
- docs/book-9/12_RELEASE_AND_ROLLBACK.md
- docs/book-9/13_OPERATIONAL_RUNBOOKS.md
- docs/book-9/14_SERVICE_LEVEL_TARGETS.md

Define environments:
- local
- test
- staging
- production

Document recommended deployment:
- Next.js/Vercel or equivalent frontend;
- Node.js API;
- background worker;
- PostgreSQL/Supabase;
- private object storage;
- optional mini-PC collectors;
- Tailscale for private infrastructure.

Define:
- health checks;
- queue monitoring;
- parse failure alerts;
- publication failure alerts;
- backup schedule;
- restore test;
- deployment checklist;
- rollback checklist.

Acceptance criteria:
- Collector failure cannot take down core.
- Production deployment is reproducible.
- Completion report: docs/reviews/A10_COMPLETION.md.
```

---

# 12. Brief A11 — Book 10: Test and Quality Bible

```text
Create Book 10: Test and Quality Bible.

Read:
- Books 0–10
- Definition of Done
- API map
- UI specification
- Security requirements

Create:
- docs/book-10/00_TEST_INDEX.md
- docs/book-10/01_TEST_STRATEGY.md
- docs/book-10/02_UNIT_TEST_SPEC.md
- docs/book-10/03_INTEGRATION_TEST_SPEC.md
- docs/book-10/04_E2E_TEST_SPEC.md
- docs/book-10/05_AI_EVALUATION_SPEC.md
- docs/book-10/06_SECURITY_TEST_SPEC.md
- docs/book-10/07_PERFORMANCE_TEST_SPEC.md
- docs/book-10/08_DATA_QUALITY_TEST_SPEC.md
- docs/book-10/09_UAT_PLAN.md
- docs/book-10/10_RELEASE_GATE.md
- docs/book-10/11_TEST_DATA_STRATEGY.md

Required E2E scenarios:
- login and role restriction;
- manual intake;
- parse and correction;
- property normalization;
- duplicate review;
- client requirement creation;
- matching;
- verification;
- customer proposal;
- publication approval;
- expiration and unpublish;
- contact access logging;
- retention cleanup.

AI evaluation metrics:
- extraction accuracy;
- canonical-property accuracy;
- duplicate precision/recall;
- requirement parsing accuracy;
- match relevance;
- confidence calibration;
- invalid JSON rate.

Acceptance criteria:
- Every MVP feature has a test level.
- Release gate blocks critical failures.
- Completion report: docs/reviews/A11_COMPLETION.md.
```

---

# 13. Brief A12 — Book 11: Codex Developer Bible

```text
Create Book 11: Codex Developer Bible.

Read:
- All previous books
- AGENTS.md
- Governance
- ADRs

Create:
- docs/book-11/00_DEVELOPER_INDEX.md
- docs/book-11/01_REPOSITORY_STRUCTURE.md
- docs/book-11/02_CODING_STANDARDS.md
- docs/book-11/03_NAMING_CONVENTIONS.md
- docs/book-11/04_GIT_WORKFLOW.md
- docs/book-11/05_MIGRATION_RULES.md
- docs/book-11/06_API_IMPLEMENTATION_RULES.md
- docs/book-11/07_FRONTEND_IMPLEMENTATION_RULES.md
- docs/book-11/08_AI_IMPLEMENTATION_RULES.md
- docs/book-11/09_SECURITY_IMPLEMENTATION_RULES.md
- docs/book-11/10_TEST_IMPLEMENTATION_RULES.md
- docs/book-11/11_PHASE_EXECUTION_PROTOCOL.md
- docs/book-11/12_PHASE_COMPLETION_REPORT.md
- docs/book-11/13_CODE_REVIEW_CHECKLIST.md
- docs/book-11/14_DEFINITION_OF_DONE.md

Mandatory Codex rules:
- Read architecture docs before editing.
- Implement one phase only.
- Do not change frozen decisions without ADR.
- Do not implement autonomous scraping without approval.
- Use migrations for DB changes.
- Validate AI output.
- Add tests for every behavior.
- Preserve provenance and audit logs.
- Never bypass role or publication controls.
- Stop after phase completion report.

Define:
- branch naming;
- commit style;
- change summary;
- test commands;
- rollback notes;
- required screenshots or evidence;
- criteria for marking a phase complete.

Acceptance criteria:
- Codex can execute a development phase without inventing architecture.
- Completion report: docs/reviews/A12_COMPLETION.md.
```

---

# 14. Brief A13 — Book 12: Master Development Roadmap

```text
Create Book 12: Master Development Roadmap.

Read:
- All completed books
- MVP master plan
- Definition of Done

Create:
- docs/book-12/00_ROADMAP_INDEX.md
- docs/book-12/01_MVP_PHASE_MAP.md
- docs/book-12/02_PHASE_0_FOUNDATION.md
- docs/book-12/03_PHASE_1_AUTH_AND_ROLES.md
- docs/book-12/04_PHASE_2_SOURCE_AND_INTAKE.md
- docs/book-12/05_PHASE_3_AI_PARSING.md
- docs/book-12/06_PHASE_4_PROPERTY_MASTER.md
- docs/book-12/07_PHASE_5_CANDIDATES_AND_DUPLICATES.md
- docs/book-12/08_PHASE_6_CLIENT_REQUIREMENTS.md
- docs/book-12/09_PHASE_7_MATCHING.md
- docs/book-12/10_PHASE_8_REVIEW_AND_SHORTLIST.md
- docs/book-12/11_PHASE_9_VERIFICATION.md
- docs/book-12/12_PHASE_10_CUSTOMER_PROPOSAL.md
- docs/book-12/13_PHASE_11_PUBLICATION.md
- docs/book-12/14_PHASE_12_REPORTING.md
- docs/book-12/15_PHASE_13_SECURITY_AND_RETENTION.md
- docs/book-12/16_PHASE_14_TEST_AND_RELEASE.md
- docs/book-12/17_PHASE_15_CONTROLLED_PILOT.md
- docs/book-12/18_POST_MVP_ROADMAP.md
- docs/book-12/19_DEPENDENCY_MATRIX.md

For each phase define:
- goal;
- prerequisites;
- in scope;
- out of scope;
- database changes;
- API changes;
- UI changes;
- AI changes;
- security requirements;
- tests;
- acceptance criteria;
- rollback considerations;
- completion evidence.

Post-MVP:
- browser save extension;
- permitted website connectors;
- Viber collector;
- analytics;
- external broker contribution;
- cooperative MLS governance.

Acceptance criteria:
- Dependencies are explicit.
- No phase depends on undefined functionality.
- Completion report: docs/reviews/A13_COMPLETION.md.
```

---

# 15. Brief R1 — Architecture Review

```text
Perform a full Architecture Review of the AI MLS Platform Architecture Bible.

Read:
- All documents
- All ADRs
- All completion reports

Create:
- docs/reviews/R1_ARCHITECTURE_REVIEW.md
- docs/reviews/R1_INCONSISTENCY_REGISTER.md
- docs/reviews/R1_OPEN_DECISIONS.md
- docs/reviews/R1_TRACEABILITY_MATRIX.md
- docs/reviews/R1_RECOMMENDED_CHANGES.md

Review dimensions:
1. Product consistency
2. Terminology consistency
3. Workflow completeness
4. Data-model completeness
5. API coverage
6. UI coverage
7. Role and permission consistency
8. AI boundary compliance
9. Privacy and security coverage
10. Deployment feasibility
11. Test coverage
12. Phase dependency consistency

Traceability matrix:
- business requirement;
- workflow;
- data entity;
- API;
- UI screen;
- role;
- test;
- development phase.

Do not modify approved documents during this brief.
Only report findings and recommended changes.

Classify issues:
- CRITICAL
- HIGH
- MEDIUM
- LOW
- EDITORIAL

Acceptance criteria:
- Every critical workflow is traceable end-to-end.
- All contradictions are listed.
- Completion report: docs/reviews/R1_COMPLETION.md.
```

---

# 16. Brief R2 — Review Corrections

```text
Apply approved Architecture Review corrections.

Read:
- R1 review documents
- User-approved correction list

Tasks:
- Modify only approved documents.
- Add or update ADRs where architecture changes.
- Update version history.
- Update traceability matrix.
- Resolve approved inconsistencies.
- Leave rejected recommendations documented.

Create:
- docs/reviews/R2_CORRECTION_REPORT.md
- docs/reviews/R2_REMAINING_OPEN_ITEMS.md

Acceptance criteria:
- No CRITICAL issue remains.
- HIGH issues are either resolved or explicitly accepted.
- All modifications are traceable.
- Completion report: docs/reviews/R2_COMPLETION.md.
```

---

# 17. Brief F1 — Architecture Freeze v1.0

```text
Prepare the AI MLS Platform Architecture Bible v1.0 for freeze.

Read:
- All corrected documents
- ADRs
- Review reports
- Version history

Tasks:
- Change approved document statuses from DRAFT/IN REVIEW to FROZEN.
- Set version to 1.0.
- Create a manifest with file names and checksums.
- Create the final master index.
- List all accepted open items as POST-MVP or deferred.
- Define the architecture change process after freeze.
- Confirm Codex development source-of-truth order.

Create:
- docs/AI_MLS_ARCHITECTURE_BIBLE_V1_MANIFEST.md
- docs/AI_MLS_ARCHITECTURE_BIBLE_V1_FINAL_INDEX.md
- docs/ARCHITECTURE_FREEZE_V1.md
- docs/CHANGE_CONTROL_AFTER_FREEZE.md
- docs/reviews/F1_FREEZE_REPORT.md

Freeze source-of-truth order:
1. Project Constitution
2. Approved ADRs
3. Frozen Architecture Bible documents
4. Master Development Roadmap
5. Phase-specific Codex brief
6. Existing source code

Acceptance criteria:
- Every frozen file has version and status.
- No unresolved critical decision remains.
- Codex can start Phase 0 without guessing.
- Completion report: docs/reviews/F1_COMPLETION.md.
```

---

# 18. Brief D0 — Codex Development Kickoff

```text
Start AI MLS Development Phase 0 only.

Before coding:
- Read AGENTS.md.
- Read Project Constitution.
- Read all approved ADRs.
- Read Architecture Freeze v1.0.
- Read Developer Bible.
- Read Phase 0 roadmap document.
- Inspect the existing repository.

Objective:
Create the repository and development foundation exactly as specified.

Allowed:
- project scaffolding;
- configuration;
- environment templates;
- linting;
- formatting;
- test framework;
- directory structure;
- health-check skeleton;
- documentation links.

Not allowed:
- business features;
- source connectors;
- AI parser;
- listing workflows;
- database feature tables beyond approved Phase 0 scope.

After work:
- run tests;
- run lint;
- run build;
- provide git diff summary;
- create docs/phases/PHASE_0_COMPLETION.md;
- stop.

Do not begin Phase 1.
```

---

# Recommended Execution Sequence

```text
A0  Documentation Workspace
A1  Project Constitution
A2  Business Strategy
A3  System Architecture
Phase 4  Data Architecture
Phase 5  AI Architecture
Phase 6  Workflow Bible
Phase 7  API Bible
A8  UI/UX Bible
A9  Security and Privacy Bible
A10 Deployment and Operations Bible
A11 Test and Quality Bible
A12 Codex Developer Bible
A13 Master Development Roadmap
R1  Architecture Review
R2  Approved Corrections
F1  Architecture Freeze v1.0
D0  Codex Development Kickoff
```

# User Review Gates

Codex must stop for user review after:

- A1 Project Constitution
- Phase 4 Data Architecture
- Phase 6 Workflow Bible
- A9 Security and Privacy Bible
- A13 Master Roadmap
- R1 Architecture Review
- F1 Architecture Freeze

No next gate-sensitive brief should start without user approval.
