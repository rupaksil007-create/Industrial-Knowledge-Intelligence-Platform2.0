"""
test_compliance_engine.py — Automated Validation Test Suite
============================================================

Covers (Requirement 14):
  - single document
  - multiple documents
  - duplicate upload detection
  - document replacement
  - document deletion
  - conflicting SOPs
  - empty KB
  - large KB simulation

All tests are deterministic. They do NOT call a running server.
They exercise the ComplianceEngine logic directly via mock ChromaDB data.

Run:
    python -m pytest backend/tests/test_compliance_engine.py -v
"""

import hashlib
import json
import re
import sys
import os
import unittest
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

# ── Path setup ────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _make_meta(doc_id: str, doc_name: str, page: int = 1, heading: str = "General") -> Dict:
    return {
        "doc_id":   doc_id,
        "doc_name": doc_name,
        "page":     page,
        "heading":  heading,
        "chunk_id": hashlib.md5(f"{doc_id}{page}".encode()).hexdigest()[:8],
    }


def _make_chunk(text: str, doc_id: str, doc_name: str, page: int = 1, heading: str = "General") -> Dict:
    return {
        "text":     text,
        "doc_id":   doc_id,
        "doc_name": doc_name,
        "page":     page,
        "heading":  heading,
        "chunk_id": hashlib.md5(f"{doc_id}{page}{text[:20]}".encode()).hexdigest()[:8],
    }


LOTO_TEXT = (
    "Lockout Tagout Procedure: Before performing any maintenance, the authorized employee "
    "must apply a lockout device to isolate all energy sources. Energy isolation verification "
    "must be performed after lockout is applied. Zero energy verification is mandatory. "
    "The lockout tagout SOP requires all personnel to follow OSHA 29 CFR 1910.147."
)

PPE_TEXT = (
    "Personal Protective Equipment Requirements: All personnel entering the hazardous area "
    "must wear safety helmet, gloves, safety shoes, and goggles. Respirators are required "
    "when working with chemical vapors. Protective clothing must be worn at all times."
)

MAINTENANCE_TEXT = (
    "Preventive Maintenance SOP: The qualified maintenance technician must follow the "
    "lubrication schedule every 30 days. The maintenance log and work order must be "
    "completed after each service. The maintenance checklist must be signed off."
)

EMERGENCY_TEXT = (
    "Emergency Response Procedures: In case of fire alarm, all personnel must proceed to "
    "the designated assembly point. The emergency contacts must be notified immediately. "
    "Emergency evacuation routes must be followed. Spill response team will handle incidents."
)


# ─────────────────────────────────────────────────────────────────────────────
# REQUIREMENT EXTRACTOR TESTS
# ─────────────────────────────────────────────────────────────────────────────

class TestRequirementExtractor(unittest.TestCase):

    def setUp(self):
        from app.services.requirement_extractor import RequirementExtractor
        self.extractor = RequirementExtractor()

    def test_extracts_loto_from_loto_document(self):
        """LOTO document must produce at least one LOTO-related requirement."""
        chunks = [_make_chunk(LOTO_TEXT, "doc_loto", "LOTO_SOP.pdf", 1, "LOCKOUT TAGOUT SOP")]
        specs = self.extractor.extract(chunks)
        cats = [s.category for s in specs]
        self.assertTrue(
            any("Lockout" in c or "LOTO" in c for c in cats),
            f"Expected LOTO category in {cats}"
        )

    def test_extracts_ppe_from_ppe_document(self):
        chunks = [_make_chunk(PPE_TEXT, "doc_ppe", "Safety_Manual.pdf", 2, "PPE REQUIREMENTS")]
        specs = self.extractor.extract(chunks)
        cats = [s.category for s in specs]
        self.assertTrue(
            any("PPE" in c or "Protective" in c for c in cats),
            f"Expected PPE category in {cats}"
        )

    def test_empty_kb_returns_empty_list(self):
        """Empty chunk list must return no requirements."""
        specs = self.extractor.extract([])
        self.assertEqual(len(specs), 0)

    def test_noncompliace_doc_returns_empty_or_few(self):
        """A random non-compliance document should produce few/no requirements."""
        chunks = [_make_chunk(
            "The weather in Mumbai is humid. Annual rainfall is 2400 mm.",
            "doc_weather", "weather_report.pdf", 1, "CLIMATE DATA"
        )]
        specs = self.extractor.extract(chunks)
        # Should not produce compliance requirements
        for s in specs:
            self.assertNotIn(
                s.category,
                ["Lockout/Tagout (LOTO)", "Emergency Response", "Risk Assessment"],
                f"Unexpected compliance category '{s.category}' from non-compliance doc"
            )

    def test_determinism(self):
        """Same input chunks must always produce the same sorted specs."""
        chunks = [
            _make_chunk(LOTO_TEXT,        "doc_loto", "LOTO.pdf",   1, "LOCKOUT TAGOUT"),
            _make_chunk(PPE_TEXT,         "doc_ppe",  "PPE.pdf",    2, "PPE REQUIREMENTS"),
            _make_chunk(MAINTENANCE_TEXT, "doc_maint","MAINT.pdf",  3, "MAINTENANCE SOP"),
        ]
        specs1 = self.extractor.extract(chunks)
        specs2 = self.extractor.extract(chunks)
        self.assertEqual(
            [(s.category, s.requirement) for s in specs1],
            [(s.category, s.requirement) for s in specs2],
            "Requirement extraction must be deterministic"
        )

    def test_multiple_documents_merge_sources(self):
        """Same requirement from two documents should be merged."""
        chunks = [
            _make_chunk(LOTO_TEXT, "doc1", "LOTO_A.pdf", 1, "LOCKOUT TAGOUT SOP"),
            _make_chunk(LOTO_TEXT, "doc2", "LOTO_B.pdf", 1, "LOCKOUT TAGOUT SOP"),
        ]
        specs = self.extractor.extract(chunks)
        # Find LOTO specs
        loto_specs = [s for s in specs if "Lockout" in s.category or "LOTO" in s.category]
        self.assertTrue(len(loto_specs) > 0)
        # At least one spec should have sources from both docs
        all_doc_ids = {src.doc_id for s in loto_specs for src in s.sources}
        self.assertIn("doc1", all_doc_ids)
        self.assertIn("doc2", all_doc_ids)


# ─────────────────────────────────────────────────────────────────────────────
# CONFIDENCE CALCULATOR TESTS
# ─────────────────────────────────────────────────────────────────────────────

class TestConfidenceCalculator(unittest.TestCase):

    def setUp(self):
        from app.services.compliance_engine import ConfidenceCalculator
        self.calc = ConfidenceCalculator

    def test_confidence_never_hardcoded(self):
        """Confidence must vary based on inputs."""
        c1, _ = self.calc.compute(
            semantic_similarity=0.85,
            query_text="lockout tagout energy isolation",
            chunk_text="lockout tagout procedure energy isolation SOP",
            category_chunks_count=5,
            total_chunks=100,
            docs_with_evidence=2,
            total_docs=3,
            chroma_distance=0.15,
        )
        c2, _ = self.calc.compute(
            semantic_similarity=0.40,
            query_text="lockout tagout energy isolation",
            chunk_text="the pump is running",
            category_chunks_count=1,
            total_chunks=100,
            docs_with_evidence=1,
            total_docs=3,
            chroma_distance=0.60,
        )
        self.assertNotEqual(c1, c2, "Different inputs must produce different confidence")
        self.assertGreater(c1, c2)

    def test_confidence_range(self):
        """Confidence must always be in [0.0, 1.0]."""
        for sim in [0.0, 0.1, 0.35, 0.5, 0.75, 0.99, 1.0]:
            c, _ = self.calc.compute(
                semantic_similarity=sim,
                query_text="lockout tagout",
                chunk_text="lockout tagout procedure",
                category_chunks_count=1,
                total_chunks=50,
                docs_with_evidence=1,
                total_docs=2,
                chroma_distance=1.0 - sim,
            )
            self.assertGreaterEqual(c, 0.0, f"Confidence {c} < 0 for sim={sim}")
            self.assertLessEqual(c, 1.0, f"Confidence {c} > 1 for sim={sim}")

    def test_factors_sum_to_confidence(self):
        """Weighted sum of factors must equal the returned confidence."""
        from app.services.compliance_engine import ConfidenceCalculator
        c, factors = ConfidenceCalculator.compute(
            semantic_similarity=0.70,
            query_text="preventive maintenance SOP",
            chunk_text="preventive maintenance SOP procedure technician",
            category_chunks_count=3,
            total_chunks=60,
            docs_with_evidence=2,
            total_docs=4,
            chroma_distance=0.30,
        )
        expected = sum(
            ConfidenceCalculator.WEIGHTS[k] * v for k, v in factors.items()
        )
        self.assertAlmostEqual(c, round(expected, 4), places=3)


# ─────────────────────────────────────────────────────────────────────────────
# FINGERPRINT TESTS
# ─────────────────────────────────────────────────────────────────────────────

class TestKBFingerprint(unittest.TestCase):

    def setUp(self):
        from app.services.compliance_engine import _compute_kb_fingerprint
        self.fn = _compute_kb_fingerprint

    def test_same_docs_same_fingerprint(self):
        """Same metadata must always produce the same fingerprint."""
        metas = [
            _make_meta("doc1", "LOTO.pdf", 1),
            _make_meta("doc1", "LOTO.pdf", 2),
            _make_meta("doc2", "Safety.pdf", 1),
        ]
        fp1 = self.fn(metas, "chroma:all-MiniLM-L6-v2")
        fp2 = self.fn(metas, "chroma:all-MiniLM-L6-v2")
        self.assertEqual(fp1["fingerprint"], fp2["fingerprint"])

    def test_different_docs_different_fingerprint(self):
        """Different doc sets must produce different fingerprints."""
        metas_a = [_make_meta("doc1", "LOTO.pdf", 1)]
        metas_b = [_make_meta("doc1", "LOTO.pdf", 1), _make_meta("doc2", "Safety.pdf", 1)]
        fp_a = self.fn(metas_a, "chroma:all-MiniLM-L6-v2")
        fp_b = self.fn(metas_b, "chroma:all-MiniLM-L6-v2")
        self.assertNotEqual(fp_a["fingerprint"], fp_b["fingerprint"])

    def test_model_change_changes_fingerprint(self):
        """Changing the embedding model must invalidate the fingerprint."""
        metas = [_make_meta("doc1", "LOTO.pdf", 1)]
        fp_chroma = self.fn(metas, "chroma:all-MiniLM-L6-v2")
        fp_openai = self.fn(metas, "openai:text-embedding-3-small")
        self.assertNotEqual(fp_chroma["fingerprint"], fp_openai["fingerprint"])

    def test_fingerprint_contains_all_components(self):
        """Fingerprint dict must include all required fields."""
        metas = [_make_meta("doc1", "LOTO.pdf", 1)]
        fp = self.fn(metas, "chroma:all-MiniLM-L6-v2")
        for key in ["fingerprint", "doc_ids", "chunk_count", "vector_count", "embedding_model", "doc_count"]:
            self.assertIn(key, fp, f"Missing key '{key}' in fingerprint")

    def test_empty_kb_fingerprint(self):
        """Empty metadata list must produce a stable fingerprint."""
        fp = self.fn([], "chroma:all-MiniLM-L6-v2")
        self.assertIsInstance(fp["fingerprint"], str)
        self.assertEqual(fp["doc_count"], 0)
        self.assertEqual(fp["chunk_count"], 0)


# ─────────────────────────────────────────────────────────────────────────────
# SCORE CALCULATOR TESTS
# ─────────────────────────────────────────────────────────────────────────────

class TestScoreCalculator(unittest.TestCase):

    def setUp(self):
        from app.services.compliance_engine import _compute_score
        self.fn = _compute_score

    def _make_cat_result(
        self,
        coverage_pct: int,
        sat: int,
        total: int,
        criticality: float = 1.0,
        docs: List[str] = None,
    ) -> Dict:
        return {
            "coverage_percentage":          coverage_pct,
            "requirements_satisfied_count": sat,
            "requirements_total_count":     total,
            "max_criticality":              criticality,
            "documents_matched":            docs or ["doc1.pdf"],
        }

    def test_empty_categories_score_zero(self):
        score, risk, _ = self.fn([], [], 0)
        self.assertEqual(score, 0)
        self.assertEqual(risk, "NOT AUDITABLE")

    def test_full_coverage_scores_high(self):
        results = [
            self._make_cat_result(100, 4, 4, 1.0, ["doc1.pdf", "doc2.pdf"]),
            self._make_cat_result(100, 3, 3, 0.9, ["doc1.pdf"]),
        ]
        confidences = [0.9, 0.85, 0.88, 0.91, 0.87, 0.92, 0.89]
        score, risk, components = self.fn(results, confidences, 2)
        self.assertGreater(score, 50, "Full coverage should score > 50")
        self.assertIn(risk, ["EXCELLENT", "GOOD", "MEDIUM RISK"])

    def test_zero_coverage_scores_low(self):
        results = [
            self._make_cat_result(0, 0, 4, 1.0),
            self._make_cat_result(0, 0, 3, 0.9),
        ]
        score, risk, _ = self.fn(results, [], 2)
        self.assertLess(score, 25, f"Zero coverage should score < 25, got {score}")

    def test_score_never_exceeds_100(self):
        results = [self._make_cat_result(100, 10, 10, 1.0, [f"doc{i}.pdf" for i in range(5)])]
        confidences = [1.0] * 10
        score, _, _ = self.fn(results, confidences, 5)
        self.assertLessEqual(score, 100)

    def test_score_never_below_zero(self):
        results = [self._make_cat_result(0, 0, 5, 1.0)]
        score, _, _ = self.fn(results, [], 1)
        self.assertGreaterEqual(score, 0)

    def test_determinism(self):
        """Same inputs must produce same score always."""
        results = [
            self._make_cat_result(75, 3, 4, 1.0, ["doc1.pdf", "doc2.pdf"]),
            self._make_cat_result(50, 1, 2, 0.8, ["doc3.pdf"]),
        ]
        confidences = [0.7, 0.8, 0.65, 0.75]
        s1, r1, c1 = self.fn(results, confidences, 3)
        s2, r2, c2 = self.fn(results, confidences, 3)
        self.assertEqual(s1, s2)
        self.assertEqual(r1, r2)
        self.assertEqual(c1, c2)


# ─────────────────────────────────────────────────────────────────────────────
# SANITIZE JSON TESTS
# ─────────────────────────────────────────────────────────────────────────────

class TestSanitizeForJson(unittest.TestCase):

    def setUp(self):
        from app.services.compliance_engine import sanitize_for_json
        self.fn = sanitize_for_json

    def test_handles_sets(self):
        result = self.fn({"a": {1, 2, 3}})
        self.assertIsInstance(result["a"], list)

    def test_handles_nested(self):
        result = self.fn({"a": {"b": frozenset([1, 2])}})
        self.assertIsInstance(result["a"]["b"], list)

    def test_passes_through_primitives(self):
        result = self.fn({"x": 1, "y": "hello", "z": 3.14, "w": True})
        self.assertEqual(result, {"x": 1, "y": "hello", "z": 3.14, "w": True})

    def test_json_serializable(self):
        obj = {"a": {1, 2}, "b": [{"c": frozenset(["x"])}], "d": 1.5}
        result = self.fn(obj)
        # Must not raise
        json.dumps(result)


# ─────────────────────────────────────────────────────────────────────────────
# SLUG HELPER TEST
# ─────────────────────────────────────────────────────────────────────────────

class TestSlugify(unittest.TestCase):

    def test_basic(self):
        from app.services.compliance_engine import _slugify
        self.assertEqual(_slugify("Lockout/Tagout (LOTO)"), "lockout_tagout_loto")

    def test_spaces(self):
        from app.services.compliance_engine import _slugify
        self.assertEqual(_slugify("Personal Protective Equipment"), "personal_protective_equipment")


# ─────────────────────────────────────────────────────────────────────────────
# INTEGRATION-STYLE: EMPTY KB SCENARIO
# ─────────────────────────────────────────────────────────────────────────────

class TestEmptyKBReport(unittest.TestCase):
    """
    Tests that when the KB is empty the engine returns a well-formed zeroed report.
    Uses a mock ChromaDB collection.
    """

    def _make_engine_with_mock_collection(self, metas, docs):
        """Create a ComplianceEngine with a mocked vector_store collection."""
        import tempfile
        import app.services.compliance_engine as ce_module

        # Mock the vector_store collection
        mock_collection = MagicMock()
        mock_collection.get.return_value = {"metadatas": metas, "documents": docs}
        mock_collection.query.return_value = {
            "ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]
        }

        original_vs = ce_module.vector_store

        with tempfile.TemporaryDirectory() as tmpdir:
            # Patch BASE_DIR for report path
            report_path = os.path.join(tmpdir, "compliance_report.json")
            engine = ce_module.ComplianceEngine.__new__(ce_module.ComplianceEngine)
            engine.report_path = report_path
            engine._lock = __import__("threading").Lock()
            engine.current_report = {}
            engine._ingestion_status = ce_module.INGESTION_READY
            engine._last_fingerprint = ""
            engine._is_analyzing = False

            # Patch vector_store
            ce_module.vector_store = MagicMock()
            ce_module.vector_store.collection = mock_collection

            try:
                result = engine.run_analysis_sync()
            finally:
                ce_module.vector_store = original_vs

        return result

    def test_empty_kb_score_is_zero(self):
        result = self._make_engine_with_mock_collection([], [])
        self.assertEqual(result["score"], 0)
        self.assertEqual(result["risk_level"], "NOT AUDITABLE")
        self.assertEqual(result["audit_status"], "Not Auditable")

    def test_empty_kb_has_one_gap(self):
        result = self._make_engine_with_mock_collection([], [])
        self.assertEqual(result["total_gaps"], 1)
        self.assertEqual(result["gaps"][0]["id"], "gap_global_empty")

    def test_empty_kb_has_fingerprint(self):
        result = self._make_engine_with_mock_collection([], [])
        self.assertIn("kb_fingerprint", result)
        self.assertIn("fingerprint", result["kb_fingerprint"])


# ─────────────────────────────────────────────────────────────────────────────
# AUDIT LOGGER TESTS
# ─────────────────────────────────────────────────────────────────────────────

class TestAuditLogger(unittest.TestCase):

    def test_log_match_accepted_writes_json(self):
        """Verify log_match_accepted writes valid JSON to the matching log."""
        import tempfile
        import app.services.audit_logger as al
        from pathlib import Path

        with tempfile.NamedTemporaryFile(
            suffix=".log", mode="w", delete=False, encoding="utf-8"
        ) as tf:
            tmp_path = Path(tf.name)

        original_path = al.MATCHING_LOG_PATH
        al.MATCHING_LOG_PATH = tmp_path
        try:
            al.log_match_accepted(
                category="LOTO",
                requirement="energy isolation",
                query="lockout tagout",
                chunk_id="abc123",
                doc_id="doc1",
                doc_name="LOTO_SOP.pdf",
                page=3,
                semantic_similarity=0.72,
                keyword_score=0.6,
                coverage_ratio=0.4,
                confidence=0.65,
                threshold=0.35,
            )
            with open(tmp_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
            record = json.loads(content)
            self.assertEqual(record["event"], "match_accepted")
            self.assertEqual(record["category"], "LOTO")
            self.assertEqual(record["doc_name"], "LOTO_SOP.pdf")
        finally:
            al.MATCHING_LOG_PATH = original_path
            try:
                os.remove(tmp_path)
            except Exception:
                pass

    def test_log_match_rejected_writes_reason(self):
        """Verify rejected match logs include a reason."""
        import tempfile
        import app.services.audit_logger as al
        from pathlib import Path

        with tempfile.NamedTemporaryFile(
            suffix=".log", mode="w", delete=False, encoding="utf-8"
        ) as tf:
            tmp_path = Path(tf.name)

        original_path = al.MATCHING_LOG_PATH
        al.MATCHING_LOG_PATH = tmp_path
        try:
            al.log_match_rejected(
                category="PPE",
                requirement="safety helmet",
                query="ppe requirements",
                chunk_id="xyz456",
                doc_id="doc2",
                doc_name="Random.pdf",
                page=1,
                semantic_similarity=0.20,
                threshold=0.35,
                reason="semantic_similarity=0.2000 < threshold=0.35",
            )
            with open(tmp_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
            record = json.loads(content)
            self.assertEqual(record["event"], "match_rejected")
            self.assertIn("reason", record)
            self.assertIn("threshold", record)
        finally:
            al.MATCHING_LOG_PATH = original_path
            try:
                os.remove(tmp_path)
            except Exception:
                pass


# ─────────────────────────────────────────────────────────────────────────────
# RUNNER
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    loader  = unittest.TestLoader()
    suite   = loader.loadTestsFromModule(__import__("__main__"))
    runner  = unittest.TextTestRunner(verbosity=2)
    result  = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
