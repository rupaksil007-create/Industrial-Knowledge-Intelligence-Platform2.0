# Compliance Engine Validation Report

*Generated: 2026-06-29 17:12:17*

> [!IMPORTANT]
> This report validates the **live evidence-driven compliance engine** against
> synthetic fixture scenarios. It does NOT use real uploaded documents.
> The live analysis always reads ONLY from the current ChromaDB knowledge base.

## Executive Summary

The compliance engine has been refactored to:

1. **Semantic Retrieval**: Embed requirement queries → cosine search in ChromaDB.
2. **Zero Hardcoded Documents**: Live analysis never references fixed file names.
3. **Instant Cache Invalidation**: Every upload/delete triggers fresh analysis.
4. **Evidence-First**: Every finding includes doc, page, heading, snippet, similarity.
5. **Dynamic Scoring**: Score computed from real coverage, KG completeness, confidence.

## Validation Scenarios

### Scenario A — Safety Manual only
**Status:** 🟢 **PASS**

**Fixture Documents:**
- `[FIXTURE] Safety Manual`

| Category | Expected | Actual | Coverage% | Reason |
| --- | --- | --- | --- | --- |
| LOTO | Missing | ✅ Missing | 0% | Matched 0/4. Missing: [procedure], [isolation], [verification], [responsibilities]. |
| Maintenance | Missing | ✅ Missing | 0% | Matched 0/4. Missing: [sop], [schedule], [log], [technician]. |
| Quality Management | Missing | ✅ Missing | 0% | Matched 0/3. Missing: [policy], [capa], [audit]. |
| Emergency Response | Fully Covered | ✅ Fully Covered | 100% | Matched 3/3. Satisfied: [evacuation], [contacts], [protocols]. |
| PPE | Fully Covered | ✅ Fully Covered | 100% | Matched 2/2. Satisfied: [ppe_general], [gear]. |
| Permit To Work | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [permit], [hazards]. |
| Risk Assessment | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [identification], [analysis]. |
| Incident Reporting | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [reporting], [corrective]. |
| Inspection Checklist | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [checklist], [sign_off]. |

#### Matched Evidence
- **Emergency Response** [evacuation]: `[FIXTURE] Safety Manual` (p.3) → *"In case of an emergency evacuation, all personnel must walk to the nearest designated assembly point"* (conf: 1.0)
- **Emergency Response** [contacts]: `[FIXTURE] Safety Manual` (p.3) → *"Call emergency contacts."* (conf: 1.0)
- **Emergency Response** [protocols]: `[FIXTURE] Safety Manual` (p.3) → *"When a fire alarm is activated, follow the evacuation route."* (conf: 1.0)
- **PPE** [ppe_general]: `[FIXTURE] Safety Manual` (p.2) → *"All employees must wear PPE including safety helmet, gloves, and safety shoes."* (conf: 1.0)
- **PPE** [gear]: `[FIXTURE] Safety Manual` (p.2) → *"All employees must wear PPE including safety helmet, gloves, and safety shoes."* (conf: 1.0)

---

### Scenario B — LOTO Procedure only
**Status:** 🟢 **PASS**

**Fixture Documents:**
- `[FIXTURE] LOTO Procedure`

| Category | Expected | Actual | Coverage% | Reason |
| --- | --- | --- | --- | --- |
| LOTO | Fully Covered | ✅ Fully Covered | 100% | Matched 4/4. Satisfied: [procedure], [isolation], [verification], [responsibilities]. |
| Maintenance | Missing | ✅ Missing | 0% | Matched 0/4. Missing: [sop], [schedule], [log], [technician]. |
| Quality Management | Missing | ✅ Missing | 0% | Matched 0/3. Missing: [policy], [capa], [audit]. |
| Emergency Response | Missing | ✅ Missing | 0% | Matched 0/3. Missing: [evacuation], [contacts], [protocols]. |
| PPE | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [ppe_general], [gear]. |
| Permit To Work | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [permit], [hazards]. |
| Risk Assessment | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [identification], [analysis]. |
| Incident Reporting | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [reporting], [corrective]. |
| Inspection Checklist | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [checklist], [sign_off]. |

#### Matched Evidence
- **LOTO** [procedure]: `[FIXTURE] LOTO Procedure` (p.1) → *"This document defines the LOTO procedure for energy isolation."* (conf: 1.0)
- **LOTO** [isolation]: `[FIXTURE] LOTO Procedure` (p.1) → *"This document defines the LOTO procedure for energy isolation."* (conf: 1.0)
- **LOTO** [verification]: `[FIXTURE] LOTO Procedure` (p.2) → *"Verify using isolation verification."* (conf: 1.0)
- **LOTO** [responsibilities]: `[FIXTURE] LOTO Procedure` (p.1) → *"Only authorized employees may perform lockout tagout."* (conf: 0.75)

---

### Scenario C — Maintenance Procedure only
**Status:** 🔴 **FAIL**

**Fixture Documents:**
- `[FIXTURE] Maintenance Procedure`

| Category | Expected | Actual | Coverage% | Reason |
| --- | --- | --- | --- | --- |
| LOTO | Missing | ❌ Partially Covered | 25% | Matched 1/4. Satisfied: [procedure]. Missing: [isolation], [verification], [responsibilities]. |
| Maintenance | Fully Covered | ✅ Fully Covered | 100% | Matched 4/4. Satisfied: [sop], [schedule], [log], [technician]. |
| Quality Management | Missing | ✅ Missing | 0% | Matched 0/3. Missing: [policy], [capa], [audit]. |
| Emergency Response | Missing | ✅ Missing | 0% | Matched 0/3. Missing: [evacuation], [contacts], [protocols]. |
| PPE | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [ppe_general], [gear]. |
| Permit To Work | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [permit], [hazards]. |
| Risk Assessment | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [identification], [analysis]. |
| Incident Reporting | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [reporting], [corrective]. |
| Inspection Checklist | Missing | ❌ Partially Covered | 50% | Matched 1/2. Satisfied: [checklist]. Missing: [sign_off]. |

#### Matched Evidence
- **LOTO** [procedure]: `[FIXTURE] Maintenance Procedure` (p.1) → *"This preventive maintenance SOP guides equipment servicing."* (conf: 1.0)
- **Maintenance** [sop]: `[FIXTURE] Maintenance Procedure` (p.1) → *"This preventive maintenance SOP guides equipment servicing."* (conf: 1.0)
- **Maintenance** [schedule]: `[FIXTURE] Maintenance Procedure` (p.2) → *"The service schedule and lubrication schedule define maintenance intervals."* (conf: 1.0)
- **Maintenance** [log]: `[FIXTURE] Maintenance Procedure` (p.2) → *"Technician records work order details in the maintenance log."* (conf: 1.0)
- **Maintenance** [technician]: `[FIXTURE] Maintenance Procedure` (p.1) → *"A qualified maintenance technician is assigned."* (conf: 1.0)
- **Inspection Checklist** [checklist]: `[FIXTURE] Maintenance Procedure` (p.2) → *"The maintenance checklist must be completed."* (conf: 1.0)

---

### Scenario D — Quality Manual only
**Status:** 🟢 **PASS**

**Fixture Documents:**
- `[FIXTURE] Quality Manual`

| Category | Expected | Actual | Coverage% | Reason |
| --- | --- | --- | --- | --- |
| LOTO | Missing | ✅ Missing | 0% | Matched 0/4. Missing: [procedure], [isolation], [verification], [responsibilities]. |
| Maintenance | Missing | ✅ Missing | 0% | Matched 0/4. Missing: [sop], [schedule], [log], [technician]. |
| Quality Management | Fully Covered | ✅ Fully Covered | 100% | Matched 3/3. Satisfied: [policy], [capa], [audit]. |
| Emergency Response | Missing | ✅ Missing | 0% | Matched 0/3. Missing: [evacuation], [contacts], [protocols]. |
| PPE | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [ppe_general], [gear]. |
| Permit To Work | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [permit], [hazards]. |
| Risk Assessment | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [identification], [analysis]. |
| Incident Reporting | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [reporting], [corrective]. |
| Inspection Checklist | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [checklist], [sign_off]. |

#### Matched Evidence
- **Quality Management** [policy]: `[FIXTURE] Quality Manual` (p.1) → *"Our quality policy sets quality objectives."* (conf: 1.0)
- **Quality Management** [capa]: `[FIXTURE] Quality Manual` (p.2) → *"CAPA tracks non-conformance."* (conf: 1.0)
- **Quality Management** [audit]: `[FIXTURE] Quality Manual` (p.1) → *"ISO quality standard must be maintained."* (conf: 1.0)

---

### Scenario E — All four documents
**Status:** 🔴 **FAIL**

**Fixture Documents:**
- `[FIXTURE] Quality Manual`
- `[FIXTURE] LOTO Procedure`
- `[FIXTURE] Safety Manual`
- `[FIXTURE] Maintenance Procedure`

| Category | Expected | Actual | Coverage% | Reason |
| --- | --- | --- | --- | --- |
| LOTO | Fully Covered | ✅ Fully Covered | 100% | Matched 4/4. Satisfied: [procedure], [isolation], [verification], [responsibilities]. |
| Maintenance | Fully Covered | ✅ Fully Covered | 100% | Matched 4/4. Satisfied: [sop], [schedule], [log], [technician]. |
| Quality Management | Fully Covered | ✅ Fully Covered | 100% | Matched 3/3. Satisfied: [policy], [capa], [audit]. |
| Emergency Response | Fully Covered | ✅ Fully Covered | 100% | Matched 3/3. Satisfied: [evacuation], [contacts], [protocols]. |
| PPE | Fully Covered | ✅ Fully Covered | 100% | Matched 2/2. Satisfied: [ppe_general], [gear]. |
| Permit To Work | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [permit], [hazards]. |
| Risk Assessment | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [identification], [analysis]. |
| Incident Reporting | Missing | ✅ Missing | 0% | Matched 0/2. Missing: [reporting], [corrective]. |
| Inspection Checklist | Missing | ❌ Partially Covered | 50% | Matched 1/2. Satisfied: [checklist]. Missing: [sign_off]. |

#### Matched Evidence
- **LOTO** [procedure]: `[FIXTURE] LOTO Procedure` (p.1) → *"This document defines the LOTO procedure for energy isolation."* (conf: 1.0)
- **LOTO** [isolation]: `[FIXTURE] LOTO Procedure` (p.1) → *"This document defines the LOTO procedure for energy isolation."* (conf: 1.0)
- **LOTO** [verification]: `[FIXTURE] LOTO Procedure` (p.2) → *"Verify using isolation verification."* (conf: 1.0)
- **LOTO** [responsibilities]: `[FIXTURE] LOTO Procedure` (p.1) → *"Only authorized employees may perform lockout tagout."* (conf: 0.75)
- **Maintenance** [sop]: `[FIXTURE] Maintenance Procedure` (p.1) → *"This preventive maintenance SOP guides equipment servicing."* (conf: 1.0)
- **Maintenance** [schedule]: `[FIXTURE] Maintenance Procedure` (p.2) → *"The service schedule and lubrication schedule define maintenance intervals."* (conf: 1.0)
- **Maintenance** [log]: `[FIXTURE] Maintenance Procedure` (p.2) → *"Technician records work order details in the maintenance log."* (conf: 1.0)
- **Maintenance** [technician]: `[FIXTURE] Maintenance Procedure` (p.1) → *"A qualified maintenance technician is assigned."* (conf: 1.0)
- **Quality Management** [policy]: `[FIXTURE] Quality Manual` (p.1) → *"Our quality policy sets quality objectives."* (conf: 1.0)
- **Quality Management** [capa]: `[FIXTURE] Quality Manual` (p.2) → *"CAPA tracks non-conformance."* (conf: 1.0)
- **Quality Management** [audit]: `[FIXTURE] Quality Manual` (p.1) → *"ISO quality standard must be maintained."* (conf: 1.0)
- **Emergency Response** [evacuation]: `[FIXTURE] Safety Manual` (p.3) → *"In case of an emergency evacuation, all personnel must walk to the nearest designated assembly point"* (conf: 1.0)
- **Emergency Response** [contacts]: `[FIXTURE] Safety Manual` (p.3) → *"Call emergency contacts."* (conf: 1.0)
- **Emergency Response** [protocols]: `[FIXTURE] Safety Manual` (p.3) → *"When a fire alarm is activated, follow the evacuation route."* (conf: 1.0)
- **PPE** [ppe_general]: `[FIXTURE] Safety Manual` (p.2) → *"All employees must wear PPE including safety helmet, gloves, and safety shoes."* (conf: 1.0)
- **PPE** [gear]: `[FIXTURE] Safety Manual` (p.2) → *"All employees must wear PPE including safety helmet, gloves, and safety shoes."* (conf: 1.0)
- **Inspection Checklist** [checklist]: `[FIXTURE] Maintenance Procedure` (p.2) → *"The maintenance checklist must be completed."* (conf: 1.0)

---

### Scenario F — Empty knowledge base
**Status:** 🟢 **PASS**

| Category | Expected | Actual | Coverage% | Reason |
| --- | --- | --- | --- | --- |
| LOTO | Missing | ✅ Missing | 0% | No documents. |
| Maintenance | Missing | ✅ Missing | 0% | No documents. |
| Quality Management | Missing | ✅ Missing | 0% | No documents. |
| Emergency Response | Missing | ✅ Missing | 0% | No documents. |
| PPE | Missing | ✅ Missing | 0% | No documents. |
| Permit To Work | Missing | ✅ Missing | 0% | No documents. |
| Risk Assessment | Missing | ✅ Missing | 0% | No documents. |
| Incident Reporting | Missing | ✅ Missing | 0% | No documents. |
| Inspection Checklist | Missing | ✅ Missing | 0% | No documents. |

#### Matched Evidence
*(No evidence matched)*

---

## Conclusion

⚠️ Some scenarios failed — review the table above.

## Live Analysis Notes

- Live analysis uses **semantic embedding retrieval** from ChromaDB — not keyword matching.
- Semantic similarity threshold: **0.35**
- Score formula: 40% doc coverage + 20% KG completeness + 20% breadth + 20% evidence quality
- Cache is invalidated on every upload and delete event.
- Score = 0 / Status = Not Auditable when knowledge base is empty.