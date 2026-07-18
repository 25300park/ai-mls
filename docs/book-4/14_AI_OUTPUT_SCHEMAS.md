# AI Output Schemas

| 항목 | 값 |
|---|---|
| Document ID | DOC-AI-015 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Reviewer / Development Reviewer |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Scope and rules

The following JSON Schemas are documentation contracts for AI Result validation. They are not API payloads, production code or final generated validators. `$id` values are logical identifiers. Every output is untrusted and `ADVISORY`; validation success does not grant authority.

Common rules:

- `additionalProperties: false` prevents hidden action/authority fields.
- references identify approved records/versions; they do not embed unrestricted raw/contact/client content.
- confidence has band, reasons and policy version; numeric value is optional and capability-specific.
- output never contains verification approval, permission grant, publication command or authoritative mutation.
- exact enum/version expansion follows approved schema change control.

## Common definitions

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:ai-mls:schema:common:v0.1",
  "$defs": {
    "recordRef": {
      "type": "object",
      "additionalProperties": false,
      "required": ["entityType", "entityId", "version"],
      "properties": {
        "entityType": { "type": "string", "minLength": 1 },
        "entityId": { "type": "string", "minLength": 1 },
        "version": { "type": "string", "minLength": 1 }
      }
    },
    "confidence": {
      "type": "object",
      "additionalProperties": false,
      "required": ["band", "reasonCodes", "policyVersion"],
      "properties": {
        "band": { "enum": ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] },
        "numericValue": { "type": "number" },
        "reasonCodes": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "policyVersion": { "type": "string", "minLength": 1 }
      }
    },
    "evidenceRef": {
      "type": "object",
      "additionalProperties": false,
      "required": ["sourceRef", "evidenceLocator"],
      "properties": {
        "sourceRef": { "$ref": "#/$defs/recordRef" },
        "evidenceLocator": { "type": "string", "minLength": 1 }
      }
    }
  }
}
```

## Listing Parser schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:ai-mls:schema:listing-parser-output:v0.1",
  "title": "ListingParserOutput",
  "type": "object",
  "additionalProperties": false,
  "required": ["capabilityId", "inputRef", "fields", "warnings", "overallConfidence"],
  "properties": {
    "capabilityId": { "const": "AI-001" },
    "inputRef": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/recordRef" },
    "fields": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["fieldName", "valueState", "evidenceRefs", "confidence"],
        "properties": {
          "fieldName": { "type": "string", "minLength": 1 },
          "valueState": { "enum": ["PRESENT", "MISSING", "AMBIGUOUS", "CONFLICTING", "WITHHELD", "NOT_APPLICABLE"] },
          "rawValue": { "type": ["string", "number", "boolean", "null"] },
          "normalizedValue": { "type": ["string", "number", "boolean", "null"] },
          "evidenceRefs": { "type": "array", "items": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/evidenceRef" } },
          "confidence": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/confidence" }
        }
      }
    },
    "warnings": { "type": "array", "items": { "type": "string" } },
    "overallConfidence": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/confidence" }
  }
}
```

## Property Normalization schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:ai-mls:schema:property-normalization-output:v0.1",
  "title": "PropertyNormalizationOutput",
  "type": "object",
  "additionalProperties": false,
  "required": ["capabilityId", "inputRef", "outcome", "candidates", "ambiguities", "overallConfidence"],
  "properties": {
    "capabilityId": { "const": "AI-002" },
    "inputRef": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/recordRef" },
    "outcome": { "enum": ["MATCH_CANDIDATE", "UNRESOLVED", "NEW_MASTER_CANDIDATE", "CONFLICT", "NOT_APPLICABLE"] },
    "candidates": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["entityRef", "entityType", "evidenceRefs", "contradictions", "confidence"],
        "properties": {
          "entityRef": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/recordRef" },
          "entityType": { "enum": ["LOCATION", "PROPERTY", "BUILDING", "TOWER", "FLOOR", "UNIT", "ALIAS"] },
          "evidenceRefs": { "type": "array", "items": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/evidenceRef" } },
          "contradictions": { "type": "array", "items": { "type": "string" } },
          "confidence": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/confidence" }
        }
      }
    },
    "ambiguities": { "type": "array", "items": { "type": "string" } },
    "overallConfidence": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/confidence" }
  }
}
```

## Duplicate Detection schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:ai-mls:schema:duplicate-detection-output:v0.1",
  "title": "DuplicateDetectionOutput",
  "type": "object",
  "additionalProperties": false,
  "required": ["capabilityId", "comparedRefs", "relationship", "recommendation", "signals", "contradictions", "confidence"],
  "properties": {
    "capabilityId": { "const": "AI-003" },
    "comparedRefs": { "type": "array", "minItems": 2, "items": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/recordRef" } },
    "relationship": { "enum": ["SAME_SOURCE_COPY", "SAME_CANDIDATE", "SAME_UNIT_DIFFERENT_OFFER", "SAME_OFFER_DIFFERENT_SOURCE", "RELATED_PROPERTY", "NOT_DUPLICATE", "UNCERTAIN"] },
    "recommendation": { "enum": ["LINK_ONLY", "MERGE_CANDIDATE", "KEEP_SEPARATE", "SAME_UNIT_SEPARATE_OFFERS", "NEEDS_MORE_EVIDENCE"] },
    "signals": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["signalType", "direction", "explanation"],
        "properties": {
          "signalType": { "type": "string", "minLength": 1 },
          "direction": { "enum": ["SUPPORTS", "CONTRADICTS", "NEUTRAL"] },
          "explanation": { "type": "string", "minLength": 1 }
        }
      }
    },
    "contradictions": { "type": "array", "items": { "type": "string" } },
    "confidence": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/confidence" }
  }
}
```

## Requirement Parser schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:ai-mls:schema:requirement-parser-output:v0.1",
  "title": "RequirementParserOutput",
  "type": "object",
  "additionalProperties": false,
  "required": ["capabilityId", "inputRef", "intent", "budget", "locations", "propertyTypes", "preferences", "clarificationNeeds", "overallConfidence"],
  "properties": {
    "capabilityId": { "const": "AI-004" },
    "inputRef": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/recordRef" },
    "intent": { "enum": ["RENT", "BUY", "OTHER", "UNKNOWN"] },
    "budget": {
      "type": "object",
      "additionalProperties": false,
      "required": ["valueState", "confidence"],
      "properties": {
        "valueState": { "enum": ["PRESENT", "MISSING", "AMBIGUOUS", "CONFLICTING"] },
        "currency": { "type": "string" },
        "minimum": { "type": "number" },
        "maximum": { "type": "number" },
        "frequency": { "type": "string" },
        "flexible": { "type": "boolean" },
        "confidence": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/confidence" }
      }
    },
    "locations": { "type": "array", "items": { "type": "object", "additionalProperties": false, "required": ["rawText", "constraintType", "confidence"], "properties": { "rawText": { "type": "string" }, "canonicalCandidateRef": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/recordRef" }, "constraintType": { "enum": ["HARD", "SOFT", "EXCLUDE", "INFORMATIONAL", "UNKNOWN"] }, "confidence": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/confidence" } } } },
    "propertyTypes": { "type": "array", "items": { "type": "string" } },
    "preferences": { "type": "array", "items": { "type": "object", "additionalProperties": false, "required": ["criterion", "constraintType", "confidence"], "properties": { "criterion": { "type": "string" }, "value": { "type": ["string", "number", "boolean", "null"] }, "constraintType": { "enum": ["HARD", "SOFT", "EXCLUDE", "INFORMATIONAL", "UNKNOWN"] }, "confidence": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/confidence" } } } },
    "clarificationNeeds": { "type": "array", "items": { "type": "string" } },
    "overallConfidence": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/confidence" }
  }
}
```

## Matching Result schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:ai-mls:schema:matching-result:v0.1",
  "title": "MatchingResult",
  "type": "object",
  "additionalProperties": false,
  "required": ["capabilityId", "requirementRef", "candidateRef", "cohortRef", "factors", "hardConstraintOutcome", "score", "rank", "explanation", "confidence"],
  "properties": {
    "capabilityId": { "const": "AI-005" },
    "requirementRef": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/recordRef" },
    "candidateRef": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/recordRef" },
    "offerRef": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/recordRef" },
    "cohortRef": { "type": "string", "minLength": 1 },
    "factors": { "type": "array", "items": { "type": "object", "additionalProperties": false, "required": ["factor", "kind", "outcome", "explanation"], "properties": { "factor": { "type": "string" }, "kind": { "enum": ["HARD", "SOFT", "QUALITY", "INFORMATIONAL"] }, "outcome": { "enum": ["PASS", "FAIL", "PARTIAL", "UNKNOWN", "NOT_APPLICABLE"] }, "score": { "type": "number" }, "weight": { "type": "number" }, "explanation": { "type": "string" } } } },
    "hardConstraintOutcome": { "enum": ["PASS", "FAIL", "UNKNOWN"] },
    "score": { "type": "number" },
    "rank": { "type": "integer", "minimum": 1 },
    "explanation": { "type": "string", "minLength": 1 },
    "confidence": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/confidence" }
  }
}
```

## Search Interpretation schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:ai-mls:schema:search-interpretation-output:v0.1",
  "title": "SearchInterpretationOutput",
  "type": "object",
  "additionalProperties": false,
  "required": ["capabilityId", "intent", "filters", "sort", "requestedResultClass", "unresolvedTerms", "warnings", "confidence"],
  "properties": {
    "capabilityId": { "const": "AI-006" },
    "intent": { "enum": ["PROPERTY_DISCOVERY", "REQUIREMENT_SEARCH", "COMPARE", "STATUS_INQUIRY", "OPERATIONAL_LOOKUP", "UNSUPPORTED_WRITE", "UNKNOWN"] },
    "filters": { "type": "array", "items": { "type": "object", "additionalProperties": false, "required": ["field", "operator", "value", "negated"], "properties": { "field": { "type": "string", "minLength": 1 }, "operator": { "enum": ["EQUALS", "IN", "RANGE", "CONTAINS", "NEAR", "EXISTS"] }, "value": { "type": ["string", "number", "boolean", "array", "null"] }, "negated": { "type": "boolean" } } } },
    "sort": { "type": "array", "items": { "type": "object", "additionalProperties": false, "required": ["field", "direction"], "properties": { "field": { "type": "string" }, "direction": { "enum": ["ASC", "DESC"] } } } },
    "requestedResultClass": { "enum": ["INTERNAL_CANDIDATE", "CLIENT_ELIGIBLE", "PUBLISHED", "RESTRICTED_OPERATIONAL"] },
    "unresolvedTerms": { "type": "array", "items": { "type": "string" } },
    "warnings": { "type": "array", "items": { "type": "string" } },
    "confidence": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/confidence" }
  }
}
```

## Confidence Result schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:ai-mls:schema:confidence-result:v0.1",
  "title": "ConfidenceResult",
  "type": "object",
  "additionalProperties": false,
  "required": ["capabilityId", "subjectRef", "overallConfidence", "fieldConfidences", "validationOutcome", "reviewRoute"],
  "properties": {
    "capabilityId": { "enum": ["AI-001", "AI-002", "AI-003", "AI-004", "AI-005", "AI-006", "AI-007"] },
    "subjectRef": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/recordRef" },
    "overallConfidence": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/confidence" },
    "fieldConfidences": { "type": "object", "additionalProperties": { "$ref": "urn:ai-mls:schema:common:v0.1#/$defs/confidence" } },
    "validationOutcome": { "enum": ["VALID_DRAFT", "HUMAN_REVIEW_REQUIRED", "REJECTED", "QUARANTINED"] },
    "reviewRoute": { "enum": ["NORMAL_REVIEW", "SPECIALIST_REVIEW", "SECURITY_REVIEW", "MANUAL_FALLBACK", "NONE_REJECTED"] }
  }
}
```

## Validation order

1. parse as data, never execute output
2. resolve exact schema ID/version
3. reject unknown/additional fields
4. resolve input/evidence references and versions
5. run capability semantic/security/privacy validators
6. validate confidence and route
7. persist advisory AI Result and audit metadata only after policy permits
8. require separate authorized application/human action for any business revision

> **OPEN DECISION:** production schema registry, field vocabularies, numeric bounds, cross-schema compatibility and generated-validator implementation.

