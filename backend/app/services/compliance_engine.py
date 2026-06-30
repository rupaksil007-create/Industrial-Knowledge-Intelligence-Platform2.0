import os
import json
import re
import time
import logging
import hashlib
import threading
import pdfplumber
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Set, Optional

from app.core.config import settings
from app.services.vector_store import vector_store
from app.services.audit_logger import (
    log_audit_started,
    log_audit_complete,
    log_audit_cache_hit,
    log_requirement_extracted,
    log_match_accepted,
    log_match_rejected,
    log_no_candidates,
)

logger = logging.getLogger(__name__)

SEMANTIC_THRESHOLD = 0.35
TOP_K_RETRIEVAL = 5

INGESTION_IDLE = "IDLE"
INGESTION_INGESTING = "INGESTING"
INGESTION_READY = "READY"


def normalize_text(text: str) -> str:
    if not text:
        return ""
    # Replace common PDF ligatures & OCR artifacts
    replacements = {
        "(cid:415)": "ti",
        "╞ƒ": "ti",
        "∩¼Ç": "ff",
        "∩¼ü": "fi",
        "∩¼é": "fl",
        "∩¼â": "ffi",
        "∩¼ä": "ffl",
        "├å": "AE",
        "┼ô": "oe",
        "\u00a0": " ",  # Non-breaking space
        "\u2013": "-",  # En dash
        "\u2014": "-",  # Em dash
        "\u201c": '"',  # Left double quote
        "\u201d": '"',  # Right double quote
        "\u2018": "'",  # Left single quote
        "\u2019": "'",  # Right single quote
        "\ufb00": "ff", # unicode ligature ff
        "\ufb01": "fi", # unicode ligature fi
        "\ufb02": "fl", # unicode ligature fl
        "\ufb03": "ffi",# unicode ligature ffi
        "\ufb04": "ffl",# unicode ligature ffl
        "\ufb05": "ft", # unicode ligature ft
        "\ufb06": "st", # unicode ligature st
    }
    for old, new in replacements.items():
        text = text.replace(old, new)

    # Replace spacing issues like 'ac ti vi ties' or 'no ti fy'
    text = re.sub(r"(\w)\s+ti(\w)", r"\1ti\2", text)
    text = re.sub(r"(\w)\s+fi(\w)", r"\1fi\2", text)
    text = re.sub(r"(\w)\s+ff(\w)", r"\1ff\2", text)
    text = re.sub(r"(\w)\s+fl(\w)", r"\1fl\2", text)

    # Normalize multiple whitespace characters and linebreaks
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_pdf_content(pdf_path: str) -> List[Dict[str, Any]]:
    pages_data = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                # Extract text preserving layout/tables
                text = page.extract_text() or ""

                # Extract tables and format them as text
                tables = page.extract_tables()
                if tables:
                    table_texts = []
                    for table in tables:
                        for row in table:
                            row_str = " | ".join(
                                [str(cell) for cell in row if cell is not None]
                            )
                            table_texts.append(row_str)
                    if table_texts:
                        text += "\n" + "\n".join(table_texts)

                # Normalize the extracted text
                normalized = normalize_text(text)

                # Find headings
                headings = []
                lines = text.split("\n")
                for line in lines:
                    line_strip = line.strip()
                    if 3 < len(line_strip) < 120:
                        if line_strip.isupper() or re.match(
                            r"^(?:SECTION|CHAPTER|PART|SOP|\d+\.\d+|\b[IVXLCDM]+\b)\b",
                            line_strip,
                            re.IGNORECASE,
                        ):
                            headings.append(normalize_text(line_strip))

                pages_data.append(
                    {"page_number": page_idx + 1, "text": normalized, "headings": headings}
                )
    except Exception as e:
        logger.error(f"Error parsing PDF {pdf_path}: {e}")
    return pages_data


def _slugify(text: str) -> str:
    """Convert text to a safe slug for gap IDs."""
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def _severity_from_criticality(criticality: float) -> str:
    if criticality >= 1.0:
        return "Critical"
    elif criticality >= 0.9:
        return "High"
    elif criticality >= 0.7:
        return "Medium"
    return "Low"


def _category_type(category: str) -> str:
    """Map category name to a broad type label for summary counts."""
    cat_lower = category.lower()
    if any(
        w in cat_lower
        for w in [
            "safety",
            "emergency",
            "loto",
            "ppe",
            "fire",
            "electrical",
            "chemical",
            "hazards",
        ]
    ):
        return "Safety"
    if any(w in cat_lower for w in ["maintenance", "repair", "service"]):
        return "Maintenance"
    if any(w in cat_lower for w in ["inspection", "testing", "audit", "checklist"]):
        return "Inspection"
    if any(w in cat_lower for w in ["quality", "capa", "iso", "standards"]):
        return "Quality"
    if any(w in cat_lower for w in ["environmental", "ehs", "waste"]):
        return "Environmental"
    if any(w in cat_lower for w in ["training", "competency", "qualification"]):
        return "Training"
    if any(w in cat_lower for w in ["contractor", "visitor", "supplier"]):
        return "Contractor"
    if any(w in cat_lower for w in ["cyber", "security", "network"]):
        return "Cybersecurity"
    return "Regulatory"


def _compute_kb_fingerprint(
    metas: List[Dict[str, Any]], embedding_model: str
) -> Dict[str, Any]:
    doc_ids = sorted(list(set(m.get("doc_id") for m in metas if m and m.get("doc_id"))))
    chunk_count = len(metas)
    doc_count = len(doc_ids)

    chunk_ids = sorted([m.get("chunk_id", "") for m in metas if m])
    hash_input = f"{embedding_model}|{','.join(chunk_ids)}"
    fingerprint = hashlib.sha256(hash_input.encode()).hexdigest()

    return {
        "fingerprint": fingerprint,
        "doc_ids": doc_ids,
        "chunk_count": chunk_count,
        "vector_count": chunk_count,
        "embedding_model": embedding_model,
        "doc_count": doc_count,
    }


def _compute_score(
    category_results: List[Dict[str, Any]],
    all_confidences: List[float],
    doc_count: int,
) -> Tuple[int, str, Dict[str, int]]:
    if not category_results:
        return 0, "NOT AUDITABLE", {
            "doc_coverage": 0,
            "kg_completeness": 100,
            "procedure_completeness": 0,
            "evidence_quality": 0,
        }

    # 1. Document Coverage Score (40% weight)
    avg_coverage = sum(c["coverage_percentage"] for c in category_results) / len(
        category_results
    )
    doc_coverage = int(avg_coverage)

    # 2. Knowledge Graph Completeness Score (30% weight)
    # Scaled by covered categories to prevent 100% scores in empty database runs
    kg_completeness = 100 if doc_coverage > 0 else 0

    # 3. Procedure Completeness Score (20% weight)
    covered_categories_count = sum(
        1 for c in category_results if c["coverage_percentage"] > 0
    )
    procedure_completeness = (
        int((covered_categories_count / len(category_results)) * 100)
        if category_results
        else 0
    )

    # 4. Evidence Quality Score (10% weight)
    evidence_quality = (
        int((sum(all_confidences) / len(all_confidences)) * 100)
        if all_confidences
        else 0
    )

    final_score = int(
        0.40 * doc_coverage
        + 0.30 * kg_completeness
        + 0.20 * procedure_completeness
        + 0.10 * evidence_quality
    )
    final_score = max(0, min(100, final_score))

    # Determine risk level naturally
    if final_score >= 90:
        risk_level = "EXCELLENT"
    elif final_score >= 75:
        risk_level = "GOOD"
    elif final_score >= 50:
        risk_level = "MEDIUM RISK"
    elif final_score >= 25:
        risk_level = "HIGH RISK"
    else:
        risk_level = "CRITICAL RISK"

    return (
        final_score,
        risk_level,
        {
            "doc_coverage": doc_coverage,
            "kg_completeness": kg_completeness,
            "procedure_completeness": procedure_completeness,
            "evidence_quality": evidence_quality,
        },
    )


def sanitize_for_json(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple, set, frozenset)):
        return [sanitize_for_json(v) for v in obj]
    return obj


class ConfidenceCalculator:
    WEIGHTS = {
        "semantic": 0.40,
        "keyword": 0.30,
        "consistency": 0.20,
        "coverage": 0.10,
    }

    @classmethod
    def compute(
        cls,
        semantic_similarity: float,
        query_text: str,
        chunk_text: str,
        category_chunks_count: int,
        total_chunks: int,
        docs_with_evidence: int,
        total_docs: int,
        chroma_distance: float,
    ) -> Tuple[float, Dict[str, float]]:
        semantic_val = max(0.0, min(1.0, semantic_similarity))

        q_words = set(re.findall(r"\b\w{3,}\b", query_text.lower()))
        c_words = set(re.findall(r"\b\w{3,}\b", chunk_text.lower()))
        keyword_val = len(q_words & c_words) / len(q_words) if q_words else 0.0

        consistency_val = (
            docs_with_evidence / total_docs if total_docs > 0 else 0.0
        )
        coverage_val = (
            category_chunks_count / total_chunks if total_chunks > 0 else 0.0
        )

        factors = {
            "semantic": semantic_val,
            "keyword": keyword_val,
            "consistency": consistency_val,
            "coverage": coverage_val,
        }

        confidence = sum(cls.WEIGHTS[k] * v for k, v in factors.items())
        confidence = max(0.0, min(1.0, round(confidence, 4)))
        return confidence, factors


class EvidenceEngine:
    def __init__(self, total_chunks: int, total_docs: int):
        self.total_chunks = total_chunks
        self.total_docs = total_docs

    def retrieve(
        self,
        category: str,
        requirement: str,
        query_text: str,
        doc_ids: Set[str],
    ) -> Tuple[
        Optional[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]
    ]:
        try:
            q_results = vector_store.collection.query(
                query_texts=[query_text],
                n_results=10,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            logger.error(f"Error querying ChromaDB in EvidenceEngine: {e}")
            return None, [], []

        documents = q_results.get("documents", [[]])[0]
        metadatas = q_results.get("metadatas", [[]])[0]
        distances = q_results.get("distances", [[]])[0]

        accepted = []
        rejected = []

        docs_with_evidence_set = set()
        for meta in metadatas:
            if meta and meta.get("doc_name"):
                docs_with_evidence_set.add(meta["doc_name"])

        for i, doc_text in enumerate(documents):
            meta = metadatas[i]
            dist = distances[i] if i < len(distances) else 0.5
            sim = max(0.0, min(1.0, 1.0 - dist))

            conf, factors = ConfidenceCalculator.compute(
                semantic_similarity=sim,
                query_text=query_text,
                chunk_text=doc_text,
                category_chunks_count=len(documents),
                total_chunks=self.total_chunks,
                docs_with_evidence=len(docs_with_evidence_set),
                total_docs=self.total_docs,
                chroma_distance=dist,
            )

            candidate = {
                "doc_id": meta.get("doc_id", ""),
                "doc_name": meta.get("doc_name", "Unknown"),
                "page": meta.get("page", 1),
                "section": meta.get("heading", "General"),
                "sentence": doc_text,
                "confidence": conf,
                "matched_query": query_text,
                "semantic_similarity": sim,
                "distance": dist,
            }

            if conf >= SEMANTIC_THRESHOLD:
                accepted.append(candidate)
                log_match_accepted(
                    category=category,
                    requirement=requirement,
                    query=query_text,
                    chunk_id=meta.get("chunk_id", ""),
                    doc_id=meta.get("doc_id", ""),
                    doc_name=meta.get("doc_name", "Unknown"),
                    page=meta.get("page", 1),
                    semantic_similarity=sim,
                    keyword_score=factors["keyword"],
                    coverage_ratio=factors["coverage"],
                    confidence=conf,
                    threshold=SEMANTIC_THRESHOLD,
                )
            else:
                rejected.append(candidate)
                log_match_rejected(
                    category=category,
                    requirement=requirement,
                    query=query_text,
                    chunk_id=meta.get("chunk_id", ""),
                    doc_id=meta.get("doc_id", ""),
                    doc_name=meta.get("doc_name", "Unknown"),
                    page=meta.get("page", 1),
                    semantic_similarity=sim,
                    threshold=SEMANTIC_THRESHOLD,
                    reason=f"confidence={conf:.4f} < threshold={SEMANTIC_THRESHOLD}",
                )

        if accepted:
            accepted.sort(key=lambda x: x["confidence"], reverse=True)
            return accepted[0], accepted, rejected

        log_no_candidates(category=category, requirement=requirement, query=query_text)
        return None, [], rejected


def analyze_completeness(chunk_text: str, requirement_name: str) -> Tuple[float, List[str], List[str]]:
    weaknesses = []
    remediations = []
    completeness_factor = 1.0

    # 1. Revision History
    rev_pattern = re.compile(r"\b(revision|rev\s*\d+|version|v\d+\.?\d*|effective date|last updated|dated|approved by)\b", re.I)
    if not rev_pattern.search(chunk_text):
        completeness_factor -= 0.08
        weaknesses.append("unclear revision history or document control")
        remediations.append("Establish formal version control, effective dates, and a revision log.")

    # 2. Responsibilities
    resp_pattern = re.compile(r"\b(responsibility|responsible|owner|owned by|assign|designated|duties|shall ensure|manager|officer|technician|personnel)\b", re.I)
    if not resp_pattern.search(chunk_text):
        completeness_factor -= 0.10
        weaknesses.append("unclear responsibilities or role assignment")
        remediations.append("Explicitly designate responsible roles (e.g., Supervisor, Authorized Technician) for execution.")

    # 3. Action Frequency / Inspection Interval
    freq_pattern = re.compile(r"\b(frequency|interval|periodically|weekly|monthly|annually|daily|hourly|shift|every\s+\d+\s+(day|week|month|year|hour))\b", re.I)
    if not freq_pattern.search(chunk_text):
        completeness_factor -= 0.08
        weaknesses.append("missing inspection frequency or review intervals")
        remediations.append("Define specific verification frequencies or task review intervals.")

    # 4. Training Evidence
    train_pattern = re.compile(r"\b(training|certified|certification|qualification|competency|records|logs|database|classroom|practical|exam|test|verify)\b", re.I)
    if not train_pattern.search(chunk_text):
        completeness_factor -= 0.08
        weaknesses.append("insufficient training or competency evidence guidelines")
        remediations.append("Document operators' training curriculum and practical competency validation rules.")

    # 5. Safety Protocols / Emergency Guidelines
    safety_pattern = re.compile(r"\b(verify|verification|emergency|evacuation|muster|alarm|isolated|lockout|hazardous|danger|ppe|mitigation)\b", re.I)
    if not safety_pattern.search(chunk_text):
        completeness_factor -= 0.06
        weaknesses.append("vague emergency instructions or verification protocols")
        remediations.append("Add detailed safe isolation, emergency contact list, or muster point details.")

    completeness_factor = max(0.5, min(1.0, completeness_factor))
    return completeness_factor, weaknesses, remediations


class ComplianceEngine:
    def __init__(self):
        self.report_path = os.path.join(
            settings.BASE_DIR, "data", "compliance_report.json"
        )
        self.current_report = {}
        self._lock = threading.Lock()
        self._ingestion_status = INGESTION_READY
        self._last_fingerprint = ""
        self.is_analyzing = False
        self.load_report()

    def load_report(self):
        try:
            if os.path.exists(self.report_path):
                with open(self.report_path, "r", encoding="utf-8") as f:
                    self.current_report = json.load(f)
                logger.info("Compliance report loaded from disk.")
            else:
                self._build_initial_report()
        except Exception as e:
            logger.error(f"Error loading compliance report: {e}")
            self._build_initial_report()

    def save_report(self):
        try:
            os.makedirs(os.path.dirname(self.report_path), exist_ok=True)
            with open(self.report_path, "w", encoding="utf-8") as f:
                json.dump(self.current_report, f, indent=4, ensure_ascii=False)
            logger.info("Compliance report saved to disk.")
        except Exception as e:
            logger.error(f"Error saving compliance report: {e}")

    def _build_initial_report(self):
        self.current_report = {
            "score": 0,
            "risk_level": "NOT AUDITABLE",
            "audit_status": "Not Auditable",
            "total_gaps": 0,
            "gaps": [],
            "coverage_matrix": {},
            "coverage_details": {},
            "gaps_summary": {
                "missing_procedures": 0,
                "missing_inspections": 0,
                "missing_certifications": 0,
                "missing_safety_records": 0,
            },
            "category_summary": {},
            "historical_scores": [],
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
        self.save_report()

    def get_score_data(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "score": self.current_report.get("score", 0),
                "risk_level": self.current_report.get("risk_level", "NOT AUDITABLE"),
                "total_gaps": self.current_report.get("total_gaps", 0),
                "audit_status": self.current_report.get("audit_status", "Not Auditable"),
            }

    def get_gaps(self) -> List[Dict[str, Any]]:
        with self._lock:
            return self.current_report.get("gaps", [])

    def get_report(self) -> Dict[str, Any]:
        with self._lock:
            return self.current_report

    def get_ingestion_status(self) -> str:
        with self._lock:
            return self._ingestion_status

    def mark_ingestion_started(self):
        with self._lock:
            self._ingestion_status = INGESTION_INGESTING

    def mark_ingestion_complete(self):
        with self._lock:
            self._ingestion_status = INGESTION_READY

    def get_kb_fingerprint(self) -> str:
        with self._lock:
            return self._last_fingerprint

    def invalidate_cache(self):
        with self._lock:
            self._last_fingerprint = ""
            self.current_report = {}
            logger.info("Compliance engine cache invalidated.")

    def trigger_analysis(self):
        with self._lock:
            if self.is_analyzing:
                logger.warning("Compliance analysis already in progress.")
                return
            self.is_analyzing = True

        thread = threading.Thread(target=self._run_analysis_worker)
        thread.daemon = True
        thread.start()

    def _run_analysis_worker(self):
        logger.info("Starting background semantic compliance analysis...")
        try:
            try:
                chunk_count = vector_store.collection.count()
                results = vector_store.collection.get(
                    include=["metadatas", "documents"]
                )
                metadatas = results.get("metadatas", []) or []
                documents = results.get("documents", []) or []
            except Exception as e:
                logger.error(f"Error checking vector store metadata: {e}")
                self._build_empty_report(
                    {"chunk_count": 0, "doc_count": 0, "fingerprint": ""}
                )
                return

            unique_docs = {}
            for meta in metadatas:
                if meta and meta.get("doc_id") and meta.get("doc_name"):
                    unique_docs[meta["doc_id"]] = meta["doc_name"]
            doc_count = len(unique_docs)

            if chunk_count == 0 or doc_count == 0:
                self._build_empty_report(
                    {
                        "chunk_count": chunk_count,
                        "doc_count": doc_count,
                        "fingerprint": "",
                    }
                )
                return

            embedding_model = f"{settings.EMBEDDING_PROVIDER}:{getattr(settings, 'OPENAI_EMBEDDING_MODEL', 'all-MiniLM-L6-v2')}"
            fp_info = _compute_kb_fingerprint(metadatas, embedding_model)
            fingerprint = fp_info["fingerprint"]

            # Execute audit
            report = self._execute_audit(fp_info, unique_docs, metadatas, documents)

            with self._lock:
                self.current_report = report
                self._last_fingerprint = fingerprint
                self.save_report()
            logger.info("Background compliance analysis completed successfully.")
        except Exception as e:
            logger.error(f"Error in background compliance analysis: {e}")
        finally:
            with self._lock:
                self.is_analyzing = False

    def run_analysis_sync(self) -> Dict[str, Any]:
        """Synchronous compliance analysis entry point. Thread-safe."""
        with self._lock:
            try:
                chunk_count = vector_store.collection.count()
                results = vector_store.collection.get(
                    include=["metadatas", "documents"]
                )
                metadatas = results.get("metadatas", []) or []
                documents = results.get("documents", []) or []
            except Exception as e:
                logger.error(f"Error checking vector store metadata: {e}")
                return self._build_empty_report(
                    {"chunk_count": 0, "doc_count": 0, "fingerprint": ""}
                )

            unique_docs = {}
            for meta in metadatas:
                if meta and meta.get("doc_id") and meta.get("doc_name"):
                    unique_docs[meta["doc_id"]] = meta["doc_name"]
            doc_count = len(unique_docs)

            if chunk_count == 0 or doc_count == 0:
                return self._build_empty_report(
                    {
                        "chunk_count": chunk_count,
                        "doc_count": doc_count,
                        "fingerprint": "",
                    }
                )

            embedding_model = f"{settings.EMBEDDING_PROVIDER}:{getattr(settings, 'OPENAI_EMBEDDING_MODEL', 'all-MiniLM-L6-v2')}"
            fp_info = _compute_kb_fingerprint(metadatas, embedding_model)
            fingerprint = fp_info["fingerprint"]

            # Check cache
            if self._last_fingerprint == fingerprint and self.current_report:
                log_audit_cache_hit(fingerprint)
                return sanitize_for_json(self.current_report)

            log_audit_started(
                fingerprint=fingerprint,
                doc_count=doc_count,
                chunk_count=chunk_count,
                embedding_model=embedding_model,
            )

            # Perform audit
            report = self._execute_audit(fp_info, unique_docs, metadatas, documents)

            self.current_report = report
            self._last_fingerprint = fingerprint
            self.save_report()

            log_audit_complete(
                fingerprint=fingerprint,
                score=report["score"],
                total_gaps=report["total_gaps"],
                categories_found=len(report["detected_domains"]),
                categories_not_found=len(report["not_found_domains"]),
                duration_ms=report["audit_metadata"]["audit_duration_ms"],
            )

            return sanitize_for_json(self.current_report)

    def _execute_audit(
        self,
        fp_info: Dict[str, Any],
        unique_docs: Dict[str, str],
        metadatas: List[Dict[str, Any]],
        documents: List[str],
    ) -> Dict[str, Any]:
        t_start = time.monotonic()
        chunk_count = len(documents)
        doc_count = len(unique_docs)

        chunks_for_extraction = []
        for i, meta in enumerate(metadatas):
            if not meta:
                continue
            chunks_for_extraction.append(
                {
                    "doc_id": meta.get("doc_id", ""),
                    "doc_name": meta.get("doc_name", "Unknown"),
                    "page": meta.get("page", 1),
                    "heading": meta.get("heading", "General"),
                    "text": documents[i] if i < len(documents) else "",
                    "chunk_id": meta.get("chunk_id", ""),
                }
            )

        from app.services.requirement_extractor import requirement_extractor

        specs = requirement_extractor.extract(chunks_for_extraction)

        if not specs:
            return self._build_not_found_report(fp_info, unique_docs)

        for spec in specs:
            for src in spec.sources[:1]:
                log_requirement_extracted(
                    doc_id=src.doc_id,
                    source=src.doc_name,
                    requirement=spec.requirement,
                    extraction_method=src.method,
                )

        categories = {}
        for spec in specs:
            categories.setdefault(spec.category, []).append(spec)

        evidence_engine = EvidenceEngine(
            total_chunks=chunk_count,
            total_docs=doc_count,
        )

        category_results = []
        gaps = []
        all_confidences = []

        coverage_matrix = {}
        coverage_details = {}

        for cat_name, cat_specs in categories.items():
            req_results = {}
            docs_matched = set()
            pages_matched = set()
            confidences = []

            for spec in cat_specs:
                req_name = spec.requirement
                query_text = spec.query

                best_ev, accepted, rejected = evidence_engine.retrieve(
                    category=cat_name,
                    requirement=req_name,
                    query_text=query_text,
                    doc_ids=set(unique_docs.keys()),
                )

                if best_ev:
                    comp_factor, weaknesses, remediations = analyze_completeness(
                        best_ev["sentence"], req_name
                    )
                    adjusted_confidence = round(best_ev["confidence"] * comp_factor, 2)

                    req_results[req_name] = {
                        "status": "satisfied",
                        "doc_id": best_ev["doc_id"],
                        "doc_name": best_ev["doc_name"],
                        "page": best_ev["page"],
                        "heading": best_ev["section"],
                        "snippet": best_ev["sentence"],
                        "confidence": adjusted_confidence,
                        "matched_query": best_ev["matched_query"],
                        "semantic_similarity": best_ev["semantic_similarity"],
                    }
                    docs_matched.add(best_ev["doc_name"])
                    pages_matched.add(best_ev["page"])
                    confidences.append(adjusted_confidence)
                    all_confidences.append(adjusted_confidence)

                    if weaknesses:
                        gaps.append(
                            {
                                "id": f"gap_improve_{_slugify(cat_name)}_{_slugify(req_name)}",
                                "severity": "Low" if comp_factor > 0.85 else "Medium",
                                "category": cat_name,
                                "gap": f"Documentation Improvement: {req_name}",
                                "status": "Opportunity for Improvement",
                                "source_document": best_ev["doc_name"],
                                "page": best_ev["page"],
                                "paragraph": "",
                                "document_id": best_ev["doc_id"],
                                "evidence": best_ev["sentence"],
                                "explanation": f"Retrieved operational text covers '{req_name}' but contains weak documentation details: "
                                + ", ".join(weaknesses)
                                + ".",
                                "confidence_score": adjusted_confidence,
                                "semantic_similarity": best_ev["semantic_similarity"],
                                "keyword_score": 0.0,
                                "requirements": [req_name],
                                "recommended_remediation": " ".join(remediations),
                                "nodes_involved": [],
                            }
                        )
                else:
                    req_results[req_name] = {
                        "status": "missing",
                        "doc_id": "",
                        "doc_name": "N/A",
                        "page": 0,
                        "section": "N/A",
                        "snippet": "N/A",
                        "confidence": 0.0,
                        "matched_query": query_text,
                        "semantic_similarity": 0.0,
                    }

            sat_count = sum(
                1 for v in req_results.values() if v["status"] == "satisfied"
            )
            total_reqs = len(req_results)

            if total_reqs > 0:
                total_conf = sum(v.get("confidence", 0.0) for v in req_results.values())
                cov_pct = int(round((total_conf / total_reqs) * 100))
            else:
                cov_pct = 0

            avg_conf = (
                round(sum(confidences) / len(confidences), 4)
                if confidences
                else 0.0
            )

            if cov_pct >= 90:
                cov_level = "Fully Covered"
                audit_conf = "High Confidence"
            elif cov_pct >= 10:
                cov_level = "Partially Covered"
                audit_conf = "Medium Confidence"
            else:
                cov_level = "Missing"
                audit_conf = "Low Confidence"

            missing_reqs = [
                r for r, v in req_results.items() if v["status"] == "missing"
            ]
            sat_reqs = [
                r for r, v in req_results.items() if v["status"] == "satisfied"
            ]

            reason_parts = [f"Matched {sat_count}/{total_reqs} requirements."]
            if sat_reqs:
                reason_parts.append(
                    "Satisfied: " + ", ".join(f"[{r}]" for r in sat_reqs) + "."
                )
            if missing_reqs:
                reason_parts.append(
                    "Missing: " + ", ".join(f"[{r}]" for r in missing_reqs) + "."
                )

            cat_result = {
                "category": cat_name,
                "coverage_level": cov_level,
                "coverage_percentage": cov_pct,
                "audit_confidence": audit_conf,
                "average_confidence": avg_conf,
                "reason_for_decision": " ".join(reason_parts)[:300],
                "documents_matched": sorted(docs_matched),
                "pages_matched": sorted(pages_matched),
                "evidence_snippets_count": sat_count,
                "requirements_satisfied_count": sat_count,
                "requirements_total_count": total_reqs,
                "requirements_status": req_results,
            }
            category_results.append(cat_result)
            coverage_matrix[cat_name] = cov_pct
            coverage_details[cat_name] = cat_result

            # Generate dynamic gaps only when evidence is missing
            severity = (
                "Critical"
                if cat_name
                in [
                    "Lockout/Tagout (LOTO)",
                    "Maintenance Procedures",
                    "Emergency Response",
                    "Confined Space",
                    "Working at Height",
                    "Permit To Work",
                    "Electrical Safety",
                ]
                else "High"
            )

            for req_name, req_val in req_results.items():
                if req_val["status"] == "missing":
                    gaps.append(
                        {
                            "id": f"gap_missing_{_slugify(cat_name)}_{_slugify(req_name)}",
                            "severity": severity,
                            "category": cat_name,
                            "gap": f"Missing {cat_name} - {req_name} Requirement",
                            "status": "Not Found in Knowledge Base",
                            "source_document": "Global Audits",
                            "page": 1,
                            "paragraph": "",
                            "document_id": "",
                            "evidence": "none",
                            "explanation": f"No evidence was found in the operational manuals for mandatory requirement: '{req_name}' in the '{cat_name}' domain.",
                            "confidence_score": 0.0,
                            "semantic_similarity": 0.0,
                            "keyword_score": 0.0,
                            "requirements": [req_name],
                            "recommended_remediation": f"Compile and upload verified operational guidelines covering '{req_name}' procedures within the '{cat_name}' domain.",
                            "nodes_involved": [],
                        }
                    )

        # Knowledge Graph Audit
        from app.services.knowledge_graph import knowledge_graph_service

        try:
            nodes = knowledge_graph_service.nodes
            edges = knowledge_graph_service.edges
        except Exception as kg_err:
            logger.error(f"Failed to load knowledge graph: {kg_err}")
            nodes = {}
            edges = []

        kg_total_checks = 0
        kg_passed_checks = 0

        for node_id, node in nodes.items():
            node_name = node.get("name")
            node_type = node.get("type")
            source_doc = node.get("source_document", "Knowledge Graph")
            page_num = node.get("page_number", 1)

            if node_type == "Equipment":
                kg_total_checks += 1
                has_maintenance = any(
                    (e["source"].lower() == node_id or e["target"].lower() == node_id)
                    and e["type"] == "MAINTAINED_BY"
                    for e in edges
                )
                if has_maintenance:
                    kg_passed_checks += 1
                else:
                    gaps.append(
                        {
                            "id": f"gap_kg_maint_{node_id}",
                            "severity": "High",
                            "category": "Maintenance Procedures",
                            "gap": f"Missing maintained_by relationship for '{node_name}'",
                            "source_document": source_doc,
                            "page": page_num,
                            "evidence": f"Knowledge Graph Entity: Node '{node_name}' (type: Equipment)",
                            "explanation": f"The equipment node '{node_name}' is registered in the Knowledge Graph but lacks a 'MAINTAINED_BY' relationship to any operational department or engineer node.",
                            "confidence_score": 1.0,
                            "recommended_remediation": f"Edit the Knowledge Graph or upload organizational logs to map a maintenance owner to '{node_name}'.",
                            "nodes_involved": [node_name],
                        }
                    )

                kg_total_checks += 1
                has_inspection = any(
                    (e["source"].lower() == node_id or e["target"].lower() == node_id)
                    and e["type"] in ["USES", "REFERENCES"]
                    and "inspect" in e["target"].lower()
                    for e in edges
                )
                if has_inspection:
                    kg_passed_checks += 1
                else:
                    gaps.append(
                        {
                            "id": f"gap_kg_inspect_{node_id}",
                            "severity": "High",
                            "category": "Inspection & Testing",
                            "gap": f"Missing inspection schedule for '{node_name}'",
                            "source_document": source_doc,
                            "page": page_num,
                            "evidence": f"Knowledge Graph Entity: Node '{node_name}' (type: Equipment)",
                            "explanation": f"The equipment node '{node_name}' has no linked checklist, log, or inspection schedule mapping in the schema.",
                            "confidence_score": 1.0,
                            "recommended_remediation": f"Link equipment '{node_name}' to an active weekly or monthly inspection checklist in the operational graph.",
                            "nodes_involved": [node_name],
                        }
                    )

            elif node_type == "Assets":
                kg_total_checks += 1
                has_safety = any(
                    (e["source"].lower() == node_id or e["target"].lower() == node_id)
                    and e["type"] in ["USES", "REFERENCES", "CONNECTED_TO"]
                    for e in edges
                )
                if has_safety:
                    kg_passed_checks += 1
                else:
                    gaps.append(
                        {
                            "id": f"gap_kg_safety_{node_id}",
                            "severity": "High",
                            "category": "Lockout/Tagout (LOTO)",
                            "gap": f"Missing safety procedure link for '{node_name}'",
                            "source_document": source_doc,
                            "page": page_num,
                            "evidence": f"Knowledge Graph Entity: Node '{node_name}' (type: Assets)",
                            "explanation": f"The plant asset '{node_name}' does not connect to any safety hazard protocols or PPE guidelines in the schema.",
                            "confidence_score": 1.0,
                            "recommended_remediation": f"Map asset '{node_name}' to its respective safe operating procedure (SOP) to ensure operator protection.",
                            "nodes_involved": [node_name],
                        }
                    )

            elif node_type == "Systems":
                kg_total_checks += 1
                has_emergency = any(
                    (e["source"].lower() == node_id or e["target"].lower() == node_id)
                    and e["type"] in ["DEPENDS_ON", "CONNECTED_TO", "REFERENCES"]
                    for e in edges
                )
                if has_emergency:
                    kg_passed_checks += 1
                else:
                    gaps.append(
                        {
                            "id": f"gap_kg_emerg_{node_id}",
                            "severity": "High",
                            "category": "Emergency Response",
                            "gap": f"Missing emergency plan association for system '{node_name}'",
                            "source_document": source_doc,
                            "page": page_num,
                            "evidence": f"Knowledge Graph Entity: Node '{node_name}' (type: Systems)",
                            "explanation": f"System node '{node_name}' is not connected to any emergency shutdown, isolation, or safety backup plan in the graph.",
                            "confidence_score": 1.0,
                            "recommended_remediation": f"Connect system '{node_name}' to the emergency shutdown SOP and emergency backup logs in the graph database.",
                            "nodes_involved": [node_name],
                        }
                    )

        # Natural Risk Level calculations & scoring (no score capping overrides)
        final_score, risk_level, score_components = _compute_score(
            category_results, all_confidences, doc_count
        )

        seen_gaps = set()
        dedup_gaps = []
        for gap in gaps:
            key = (gap["gap"], gap["source_document"])
            if key not in seen_gaps:
                seen_gaps.add(key)
                dedup_gaps.append(gap)
        dedup_gaps = dedup_gaps[:100]

        detected_domains = [
            cat for cat, val in coverage_matrix.items() if val > 0
        ]
        not_found_domains = [
            cat for cat, val in coverage_matrix.items() if val == 0
        ]

        # Historical scores
        historical = self.current_report.get("historical_scores", [])
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        historical = [h for h in historical if h["date"] != today_str]
        historical.append({"date": today_str, "score": final_score})
        historical = historical[-5:]

        # Gap summary counters
        missing_procs = sum(
            1
            for g in dedup_gaps
            if "procedure" in g["gap"].lower()
            or "checklist" in g["gap"].lower()
            or "documentation" in g["gap"].lower()
            or "program" in g["gap"].lower()
        )
        missing_insp = sum(
            1
            for g in dedup_gaps
            if "inspection" in g["gap"].lower() or "test" in g["gap"].lower()
        )
        missing_cert = sum(
            1
            for g in dedup_gaps
            if "cert" in g["gap"].lower()
            or "license" in g["gap"].lower()
            or "training" in g["gap"].lower()
            or "qualification" in g["gap"].lower()
        )
        missing_safety = sum(
            1 for g in dedup_gaps if _category_type(g["category"]) == "Safety"
        )

        category_counts = {
            "Safety": sum(
                1 for g in dedup_gaps if _category_type(g["category"]) == "Safety"
            ),
            "Maintenance": sum(
                1
                for g in dedup_gaps
                if _category_type(g["category"]) == "Maintenance"
            ),
            "Inspection": sum(
                1
                for g in dedup_gaps
                if _category_type(g["category"]) == "Inspection"
            ),
            "Operations": sum(
                1
                for g in dedup_gaps
                if _category_type(g["category"]) == "Operations"
            ),
            "Quality": sum(
                1 for g in dedup_gaps if _category_type(g["category"]) == "Quality"
            ),
            "Regulatory": sum(
                1
                for g in dedup_gaps
                if _category_type(g["category"]) == "Regulatory"
            ),
        }

        audit_status = "ACTIVE" if doc_count > 0 else "Not Auditable"
        t_elapsed_ms = (time.monotonic() - t_start) * 1000

        report = {
            "score": final_score,
            "risk_level": risk_level,
            "audit_status": audit_status,
            "total_gaps": len(dedup_gaps),
            "gaps": dedup_gaps,
            "coverage_matrix": coverage_matrix,
            "coverage_details": coverage_details,
            "gaps_summary": {
                "missing_procedures": missing_procs,
                "missing_inspections": missing_insp,
                "missing_certifications": missing_cert,
                "missing_safety_records": missing_safety,
            },
            "category_summary": category_counts,
            "historical_scores": historical,
            "uploaded_documents": [
                unique_docs[did]
                for did in sorted(list(unique_docs.keys()))
                if did in unique_docs
            ],
            "detected_domains": detected_domains,
            "not_found_domains": not_found_domains,
            "kb_fingerprint": fp_info,
            "audit_metadata": {
                "total_chunks_analyzed": chunk_count,
                "total_documents": doc_count,
                "total_requirements": len(specs),
                "total_categories": len(categories),
                "semantic_threshold": SEMANTIC_THRESHOLD,
                "top_k_retrieval": TOP_K_RETRIEVAL,
                "embedding_model": fp_info.get("embedding_model", ""),
                "score_components": score_components,
                "audit_duration_ms": round(t_elapsed_ms, 1),
            },
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }

        return report

    def _build_empty_report(self, fp_info: Dict[str, Any]) -> Dict[str, Any]:
        report = {
            "score": 0,
            "risk_level": "NOT AUDITABLE",
            "audit_status": "Not Auditable",
            "total_gaps": 1,
            "gaps": [
                {
                    "id": "gap_global_empty",
                    "severity": "Critical",
                    "category": "Regulatory",
                    "gap": "No compliance files loaded",
                    "source_document": "System Database",
                    "page": 0,
                    "paragraph": "",
                    "document_id": "",
                    "evidence": "N/A",
                    "missing_evidence": [],
                    "matched_evidence": [],
                    "explanation": "No operational documents or compliance procedures are uploaded to the platform.",
                    "confidence_score": 1.0,
                    "semantic_similarity": 0.0,
                    "keyword_score": 0.0,
                    "requirements": [],
                    "recommended_remediation": "Upload industrial manuals, operating guides, or compliance documents to start the audit.",
                    "nodes_involved": [],
                }
            ],
            "coverage_matrix": {},
            "coverage_details": {},
            "gaps_summary": {
                "missing_procedures": 0,
                "missing_inspections": 0,
                "missing_certifications": 0,
                "missing_safety_records": 0,
            },
            "category_summary": {
                "Safety": 0,
                "Maintenance": 0,
                "Inspection": 0,
                "Operations": 0,
                "Quality": 0,
                "Regulatory": 1,
            },
            "historical_scores": self.current_report.get("historical_scores", []),
            "uploaded_documents": [],
            "detected_domains": [],
            "not_found_domains": [],
            "kb_fingerprint": fp_info,
            "audit_metadata": {
                "total_chunks_analyzed": 0,
                "total_documents": 0,
                "total_requirements": 0,
                "total_categories": 0,
                "semantic_threshold": SEMANTIC_THRESHOLD,
                "top_k_retrieval": TOP_K_RETRIEVAL,
                "embedding_model": fp_info.get("embedding_model", ""),
                "score_components": {},
                "audit_duration_ms": 0,
            },
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
        self.current_report = report
        self.save_report()
        return report

    def _build_not_found_report(
        self,
        fp_info: Dict[str, Any],
        unique_docs: Dict[str, str],
    ) -> Dict[str, Any]:
        doc_names = list(unique_docs.values())
        report = {
            "score": 0,
            "risk_level": "NOT AUDITABLE",
            "audit_status": "ACTIVE",
            "total_gaps": 1,
            "gaps": [
                {
                    "id": "gap_no_requirements",
                    "severity": "High",
                    "category": "Regulatory",
                    "gap": "No Compliance Requirements Detected",
                    "source_document": ", ".join(doc_names[:3]),
                    "page": 0,
                    "paragraph": "",
                    "document_id": "",
                    "evidence": "No compliance headings, clauses, or keywords detected.",
                    "missing_evidence": [],
                    "matched_evidence": [],
                    "explanation": (
                        "The indexed documents do not appear to contain industrial "
                        "compliance content (SOPs, safety procedures, ISO clauses, "
                        "checklists, etc.). No requirements could be extracted."
                    ),
                    "confidence_score": 0.0,
                    "semantic_similarity": 0.0,
                    "keyword_score": 0.0,
                    "requirements": [],
                    "recommended_remediation": (
                        "Upload standard operating procedures, safety manuals, "
                        "ISO documents, or industrial compliance guides."
                    ),
                    "nodes_involved": [],
                }
            ],
            "coverage_matrix": {},
            "coverage_details": {},
            "gaps_summary": {
                "missing_procedures": 0,
                "missing_inspections": 0,
                "missing_certifications": 0,
                "missing_safety_records": 0,
            },
            "category_summary": {
                "Safety": 0,
                "Maintenance": 0,
                "Inspection": 0,
                "Operations": 0,
                "Quality": 0,
                "Regulatory": 1,
            },
            "historical_scores": self.current_report.get("historical_scores", []),
            "uploaded_documents": doc_names,
            "detected_domains": [],
            "not_found_domains": [],
            "kb_fingerprint": fp_info,
            "audit_metadata": {
                "total_chunks_analyzed": fp_info.get("chunk_count", 0),
                "total_documents": fp_info.get("doc_count", 0),
                "total_requirements": 0,
                "total_categories": 0,
                "semantic_threshold": SEMANTIC_THRESHOLD,
                "top_k_retrieval": TOP_K_RETRIEVAL,
                "embedding_model": fp_info.get("embedding_model", ""),
                "score_components": {},
                "audit_duration_ms": 0,
            },
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
        self.current_report = report
        self.save_report()
        return report


compliance_engine = ComplianceEngine()
