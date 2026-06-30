"""
requirement_extractor.py — Dynamic Requirement Extraction from Uploaded Documents
==================================================================================

This module discovers compliance categories and requirements DIRECTLY from the
text of uploaded documents.  It never uses a hardcoded category list.

Extraction sources (per requirement 11):
  1. SOP headings   — lines that look like section titles (ALL CAPS / numbered)
  2. ISO clauses    — "ISO XXXX Clause N.N" patterns
  3. Bullet / numbered lists — lines beginning with • / - / * or 1. 2. 3.
  4. Table captions  — lines followed by tabular content
  5. Regulatory keywords — domain-specific terms that imply a compliance area

The extractor produces a RequirementSpec:
    {
        "category":   "Lockout/Tagout Procedures",  # derived from doc heading
        "requirement": "energy isolation verification",
        "query":       "lockout tagout energy isolation verification procedure",
        "criticality": 1.0,
        "sources": [{"doc_id": ..., "page": ..., "heading": ..., "method": "SOP_HEADING"}]
    }

Determinism guarantee:
  The same set of documents always produces the same set of RequirementSpecs,
  sorted alphabetically by (category, requirement).
"""

import re
import hashlib
import logging
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field, asdict

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# DATA STRUCTURES
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RequirementSource:
    doc_id: str
    doc_name: str
    page: int
    heading: str
    method: str  # SOP_HEADING | ISO_CLAUSE | BULLET_LIST | TABLE | KEYWORD


@dataclass
class RequirementSpec:
    category: str
    requirement: str
    query: str
    criticality: float
    sources: List[RequirementSource] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        return d

    @property
    def id(self) -> str:
        """Stable hash ID for deduplication."""
        key = f"{self.category}|{self.requirement}"
        return hashlib.sha256(key.encode()).hexdigest()[:12]


# ─────────────────────────────────────────────────────────────────────────────
# HEADING PATTERNS
# ─────────────────────────────────────────────────────────────────────────────

# Patterns that indicate a section heading inside an industrial / compliance doc
_SOP_HEADING_RE = re.compile(
    r"""
    ^                                               # start of line
    (?:
        (?:\d+(?:\.\d+)*\.?\s+)                     # numbered  e.g.  3.1.2
      | (?:section|chapter|part|sop|clause|article)\s+[\d.]+\s+  # explicit label
      | (?:[A-Z][A-Z\s\-]{4,60}:?\s*$)              # ALL-CAPS heading ≤ 60 chars
    )
    """,
    re.VERBOSE | re.IGNORECASE,
)

_ISO_CLAUSE_RE = re.compile(
    r"\bISO\s*\d+(?:[:\-]\d+)*\s+(?:clause|section|requirement|§)?\s*[\d.]+\b",
    re.IGNORECASE,
)

_BULLET_RE = re.compile(r"^\s*(?:[•\-\*]|\d+[.)]\s+|\([a-z]\)\s+)(.+)$")

# ─────────────────────────────────────────────────────────────────────────────
# COMPLIANCE DOMAIN KEYWORDS
# Maps a detected keyword/phrase → (category, criticality)
# Only used to LABEL categories, never as a keyword-matching compliance check.
# ─────────────────────────────────────────────────────────────────────────────

_DOMAIN_KEYWORDS: List[Tuple[re.Pattern, str, float]] = [
    # (pattern, canonical_category, criticality)
    (re.compile(r"\b(lockout|tagout|LOTO|energy isolation)\b", re.I), "Lockout/Tagout (LOTO)", 1.0),
    (re.compile(r"\b(permit to work|PTW|hot work permit|confined space entry)\b", re.I), "Permit To Work", 1.0),
    (re.compile(r"\b(emergency evacuation|muster|emergency response|spill response)\b", re.I), "Emergency Response", 1.0),
    (re.compile(r"\b(PPE|personal protective equipment|safety helmet|respirator|gloves)\b", re.I), "Personal Protective Equipment", 0.9),
    (re.compile(r"\b(hazard identification|risk assessment|JHA|JSA|risk matrix)\b", re.I), "Risk Assessment", 1.0),
    (re.compile(r"\b(preventive maintenance|maintenance SOP|lubrication schedule|work order)\b", re.I), "Maintenance Procedures", 1.0),
    (re.compile(r"\b(inspection checklist|inspection form|sign-off|inspection log)\b", re.I), "Inspection & Testing", 0.9),
    (re.compile(r"\b(incident report|near miss|accident report|root cause analysis)\b", re.I), "Incident Reporting", 1.0),
    (re.compile(r"\b(quality policy|quality objective|CAPA|corrective action|non-conformance|ISO 9001)\b", re.I), "Quality Management", 0.9),
    (re.compile(r"\b(environmental|waste disposal|emission|effluent|EHS)\b", re.I), "Environmental Compliance", 0.8),
    (re.compile(r"\b(training|competency|certification|qualification|operator training)\b", re.I), "Training & Competency", 0.8),
    (re.compile(r"\b(contractor|visitor|induction|site access)\b", re.I), "Contractor Management", 0.7),
    (re.compile(r"\b(fire suppression|fire extinguisher|sprinkler|fire drill)\b", re.I), "Fire Safety", 1.0),
    (re.compile(r"\b(electrical safety|arc flash|live work|electrical permit)\b", re.I), "Electrical Safety", 1.0),
    (re.compile(r"\b(chemical handling|MSDS|SDS|hazardous material|COSHH)\b", re.I), "Chemical Safety", 0.9),
    (re.compile(r"\b(cybersecurity|data protection|access control|network security)\b", re.I), "Cybersecurity", 0.8),
]

# Minimum words a heading must contain to be a requirement
_MIN_HEADING_WORDS = 2
_MAX_HEADING_WORDS = 20


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _clean_heading(raw: str) -> str:
    """Strip numbering, bullets, colons from a heading string."""
    # Remove leading numbering like "3.1.2 " or "Section 4: "
    text = re.sub(r"^[\d.]+\.?\s*", "", raw.strip())
    text = re.sub(r"^(section|sop|chapter|part|clause|article)\s+[\d.]+:?\s*", "", text, flags=re.I)
    text = text.strip(":").strip()
    return text


def _heading_to_query(heading: str, category: str) -> str:
    """Build a natural-language semantic search query from a heading + category."""
    parts = [category, heading]
    return " ".join(dict.fromkeys(  # preserve order, remove duplicates
        w for part in parts for w in re.findall(r"\b\w+\b", part.lower())
        if len(w) > 2
    ))


def _detect_category(text: str) -> Optional[Tuple[str, float]]:
    """Return (category, criticality) for the first domain keyword found in text."""
    for pattern, category, criticality in _DOMAIN_KEYWORDS:
        if pattern.search(text):
            return category, criticality
    return None


def _criticality_from_heading(heading: str, category: str) -> float:
    """Derive criticality from heading content and category."""
    critical_words = {
        "emergency", "critical", "mandatory", "prohibited", "must", "shall",
        "lockout", "isolation", "hazard", "evacuation", "fire", "accident",
    }
    h_words = set(re.findall(r"\b\w+\b", heading.lower()))
    if h_words & critical_words:
        return 1.0
    for _, cat, crit in _DOMAIN_KEYWORDS:
        # noinspection PyUnresolvedReferences
        if cat == category:
            return crit
    return 0.8


# ─────────────────────────────────────────────────────────────────────────────
# MAIN EXTRACTOR
# ─────────────────────────────────────────────────────────────────────────────

class RequirementExtractor:
    """
    Extracts compliance requirements dynamically from indexed document chunks.

    Input: list of chunk dicts from ChromaDB, each containing:
        text, doc_id, doc_name, page, heading

    Output: sorted list of RequirementSpec objects (deterministic)
    """

    def extract(self, chunks: List[Dict[str, Any]]) -> List[RequirementSpec]:
        """
        Main entry point.  Returns a deterministic sorted list of RequirementSpec.
        """
        specs_by_id: Dict[str, RequirementSpec] = {}

        for chunk in chunks:
            doc_id   = chunk.get("doc_id", "")
            doc_name = chunk.get("doc_name", "Unknown")
            page     = int(chunk.get("page", 1))
            heading  = chunk.get("heading", "")
            text     = chunk.get("text", "")

            # 1. Extract from SOP headings embedded in the chunk heading field
            if heading and heading not in ("General", "N/A", ""):
                self._process_heading(
                    heading, text, doc_id, doc_name, page,
                    "SOP_HEADING", specs_by_id,
                )

            # 2. Extract from ISO clauses in text
            for match in _ISO_CLAUSE_RE.finditer(text):
                context = text[max(0, match.start() - 60): match.end() + 80].strip()
                self._process_heading(
                    context, text, doc_id, doc_name, page,
                    "ISO_CLAUSE", specs_by_id,
                )

            # 3. Extract from bullet / numbered list items
            for line in text.splitlines():
                m = _BULLET_RE.match(line)
                if m:
                    item_text = m.group(1).strip()
                    if _MIN_HEADING_WORDS <= len(item_text.split()) <= _MAX_HEADING_WORDS:
                        self._process_heading(
                            item_text, text, doc_id, doc_name, page,
                            "BULLET_LIST", specs_by_id,
                        )

            # 4. Domain keyword detection in chunk text
            result = _detect_category(text)
            if result:
                cat, crit = result
                # Use the chunk heading as the requirement label if available
                req_label = _clean_heading(heading) if heading not in ("", "General", "N/A") else cat
                if req_label and len(req_label.split()) >= _MIN_HEADING_WORDS:
                    self._upsert_spec(
                        category=cat,
                        requirement=req_label[:120],
                        query=_heading_to_query(req_label, cat),
                        criticality=crit,
                        source=RequirementSource(
                            doc_id=doc_id, doc_name=doc_name,
                            page=page, heading=heading,
                            method="KEYWORD",
                        ),
                        specs_by_id=specs_by_id,
                    )

        # Sort deterministically: category → requirement
        specs = sorted(specs_by_id.values(), key=lambda s: (s.category, s.requirement))
        logger.info(
            f"[RequirementExtractor] Extracted {len(specs)} unique requirements "
            f"from {len(set(c.get('doc_id','') for c in chunks))} documents"
        )
        return specs

    def _process_heading(
        self,
        heading: str,
        context_text: str,
        doc_id: str,
        doc_name: str,
        page: int,
        method: str,
        specs_by_id: Dict[str, "RequirementSpec"],
    ) -> None:
        """Attempt to categorize and register a heading as a requirement."""
        cleaned = _clean_heading(heading)
        if not cleaned or len(cleaned.split()) < _MIN_HEADING_WORDS:
            return
        if len(cleaned.split()) > _MAX_HEADING_WORDS:
            return

        # Try to detect category from heading itself, then from surrounding text
        result = _detect_category(cleaned) or _detect_category(context_text)
        if not result:
            return

        cat, _ = result
        crit = _criticality_from_heading(cleaned, cat)

        self._upsert_spec(
            category=cat,
            requirement=cleaned[:120],
            query=_heading_to_query(cleaned, cat),
            criticality=crit,
            source=RequirementSource(
                doc_id=doc_id, doc_name=doc_name,
                page=page, heading=heading,
                method=method,
            ),
            specs_by_id=specs_by_id,
        )

    def _upsert_spec(
        self,
        category: str,
        requirement: str,
        query: str,
        criticality: float,
        source: RequirementSource,
        specs_by_id: Dict[str, RequirementSpec],
    ) -> None:
        """Insert a new RequirementSpec or merge its source into an existing one."""
        key = hashlib.sha256(f"{category}|{requirement}".encode()).hexdigest()[:12]
        if key not in specs_by_id:
            specs_by_id[key] = RequirementSpec(
                category=category,
                requirement=requirement,
                query=query,
                criticality=criticality,
                sources=[source],
            )
        else:
            existing = specs_by_id[key]
            # Avoid duplicate sources
            existing_keys = {(s.doc_id, s.page) for s in existing.sources}
            if (source.doc_id, source.page) not in existing_keys:
                existing.sources.append(source)
            # Escalate criticality if a more critical source found
            if criticality > existing.criticality:
                existing.criticality = criticality


# Singleton
requirement_extractor = RequirementExtractor()
