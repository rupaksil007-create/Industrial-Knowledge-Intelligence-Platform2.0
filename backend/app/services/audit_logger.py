"""
audit_logger.py — Structured Audit Logging Infrastructure
==========================================================
Creates separate log files for each pipeline stage:
  - upload.log     : Document upload events
  - embedding.log  : Embedding generation events
  - audit.log      : Full compliance audit runs
  - matching.log   : Evidence matching decisions (accepted + rejected)

Every event is written as newline-delimited JSON (NDJSON) so it can be
parsed programmatically.  A human-readable summary line is also emitted
to the main application logger.
"""

import json
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from app.core.config import settings

_lock = threading.Lock()

# ── Log directory ─────────────────────────────────────────────────────────────
LOG_DIR = Path(settings.BASE_DIR) / "data" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

UPLOAD_LOG_PATH   = LOG_DIR / "upload.log"
EMBEDDING_LOG_PATH = LOG_DIR / "embedding.log"
AUDIT_LOG_PATH    = LOG_DIR / "audit.log"
MATCHING_LOG_PATH = LOG_DIR / "matching.log"

_log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _write(path: Path, record: Dict[str, Any]) -> None:
    """Append a JSON record to the given log file (thread-safe)."""
    record.setdefault("ts", _ts())
    line = json.dumps(record, ensure_ascii=False, default=str) + "\n"
    with _lock:
        try:
            with open(path, "a", encoding="utf-8") as f:
                f.write(line)
        except Exception as exc:
            _log.error(f"Failed to write audit log to {path}: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# UPLOAD LOG
# ─────────────────────────────────────────────────────────────────────────────

def log_upload_started(doc_id: str, filename: str, size_bytes: int) -> None:
    _write(UPLOAD_LOG_PATH, {
        "event": "upload_started",
        "doc_id": doc_id,
        "filename": filename,
        "size_bytes": size_bytes,
    })
    _log.info(f"[UPLOAD] Started: {filename} (id={doc_id}, {size_bytes} bytes)")


def log_upload_parsed(doc_id: str, filename: str, total_pages: int, method: str) -> None:
    _write(UPLOAD_LOG_PATH, {
        "event": "upload_parsed",
        "doc_id": doc_id,
        "filename": filename,
        "total_pages": total_pages,
        "method": method,
    })
    _log.info(f"[UPLOAD] Parsed: {filename} — {total_pages} pages via {method}")


def log_upload_chunked(doc_id: str, filename: str, total_chunks: int) -> None:
    _write(UPLOAD_LOG_PATH, {
        "event": "upload_chunked",
        "doc_id": doc_id,
        "filename": filename,
        "total_chunks": total_chunks,
    })
    _log.info(f"[UPLOAD] Chunked: {filename} — {total_chunks} chunks")


def log_upload_indexed(doc_id: str, filename: str, vector_count: int) -> None:
    _write(UPLOAD_LOG_PATH, {
        "event": "upload_indexed",
        "doc_id": doc_id,
        "filename": filename,
        "vector_count": vector_count,
        "status": "READY",
    })
    _log.info(f"[UPLOAD] Indexed: {filename} — {vector_count} vectors stored")


def log_upload_failed(doc_id: str, filename: str, reason: str) -> None:
    _write(UPLOAD_LOG_PATH, {
        "event": "upload_failed",
        "doc_id": doc_id,
        "filename": filename,
        "reason": reason,
    })
    _log.error(f"[UPLOAD] Failed: {filename} — {reason}")


def log_upload_duplicate(doc_id: str, filename: str) -> None:
    _write(UPLOAD_LOG_PATH, {
        "event": "upload_duplicate",
        "doc_id": doc_id,
        "filename": filename,
    })
    _log.warning(f"[UPLOAD] Duplicate detected: {filename} (id={doc_id}) — replacing existing vectors")


def log_upload_deleted(doc_id: str, doc_name: str) -> None:
    _write(UPLOAD_LOG_PATH, {
        "event": "upload_deleted",
        "doc_id": doc_id,
        "doc_name": doc_name,
    })
    _log.info(f"[UPLOAD] Deleted: {doc_name} (id={doc_id})")


# ─────────────────────────────────────────────────────────────────────────────
# EMBEDDING LOG
# ─────────────────────────────────────────────────────────────────────────────

def log_embedding_batch(
    doc_id: str,
    provider: str,
    model: str,
    batch_size: int,
    dimension: int,
    duration_ms: float,
) -> None:
    _write(EMBEDDING_LOG_PATH, {
        "event": "embedding_batch",
        "doc_id": doc_id,
        "provider": provider,
        "model": model,
        "batch_size": batch_size,
        "dimension": dimension,
        "duration_ms": round(duration_ms, 2),
    })
    _log.info(
        f"[EMBED] Batch: provider={provider} model={model} "
        f"batch={batch_size} dim={dimension} {duration_ms:.0f}ms"
    )


def log_embedding_fallback(doc_id: str, from_provider: str, to_provider: str, reason: str) -> None:
    _write(EMBEDDING_LOG_PATH, {
        "event": "embedding_fallback",
        "doc_id": doc_id,
        "from_provider": from_provider,
        "to_provider": to_provider,
        "reason": reason,
    })
    _log.warning(f"[EMBED] Fallback: {from_provider} → {to_provider} — {reason}")


# ─────────────────────────────────────────────────────────────────────────────
# AUDIT LOG
# ─────────────────────────────────────────────────────────────────────────────

def log_audit_started(
    fingerprint: str,
    doc_count: int,
    chunk_count: int,
    embedding_model: str,
) -> None:
    _write(AUDIT_LOG_PATH, {
        "event": "audit_started",
        "fingerprint": fingerprint,
        "doc_count": doc_count,
        "chunk_count": chunk_count,
        "embedding_model": embedding_model,
    })
    _log.info(
        f"[AUDIT] Started — fingerprint={fingerprint} "
        f"docs={doc_count} chunks={chunk_count} model={embedding_model}"
    )


def log_audit_cache_hit(fingerprint: str) -> None:
    _write(AUDIT_LOG_PATH, {
        "event": "audit_cache_hit",
        "fingerprint": fingerprint,
    })
    _log.info(f"[AUDIT] Cache hit — fingerprint={fingerprint} — reusing cached report")


def log_audit_complete(
    fingerprint: str,
    score: int,
    total_gaps: int,
    categories_found: int,
    categories_not_found: int,
    duration_ms: float,
) -> None:
    _write(AUDIT_LOG_PATH, {
        "event": "audit_complete",
        "fingerprint": fingerprint,
        "score": score,
        "total_gaps": total_gaps,
        "categories_found": categories_found,
        "categories_not_found": categories_not_found,
        "duration_ms": round(duration_ms, 2),
    })
    _log.info(
        f"[AUDIT] Complete — score={score} gaps={total_gaps} "
        f"found={categories_found} not_found={categories_not_found} {duration_ms:.0f}ms"
    )


def log_audit_failed(fingerprint: str, reason: str) -> None:
    _write(AUDIT_LOG_PATH, {
        "event": "audit_failed",
        "fingerprint": fingerprint,
        "reason": reason,
    })
    _log.error(f"[AUDIT] Failed — {reason}")


def log_requirement_extracted(
    doc_id: str,
    source: str,
    requirement: str,
    extraction_method: str,
) -> None:
    """Log a dynamically extracted requirement from an uploaded document."""
    _write(AUDIT_LOG_PATH, {
        "event": "requirement_extracted",
        "doc_id": doc_id,
        "source": source,
        "requirement": requirement,
        "extraction_method": extraction_method,
    })


# ─────────────────────────────────────────────────────────────────────────────
# MATCHING LOG
# ─────────────────────────────────────────────────────────────────────────────

def log_match_accepted(
    category: str,
    requirement: str,
    query: str,
    chunk_id: str,
    doc_id: str,
    doc_name: str,
    page: int,
    semantic_similarity: float,
    keyword_score: float,
    coverage_ratio: float,
    confidence: float,
    threshold: float,
) -> None:
    _write(MATCHING_LOG_PATH, {
        "event": "match_accepted",
        "category": category,
        "requirement": requirement,
        "query": query,
        "chunk_id": chunk_id,
        "doc_id": doc_id,
        "doc_name": doc_name,
        "page": page,
        "semantic_similarity": round(semantic_similarity, 4),
        "keyword_score": round(keyword_score, 4),
        "coverage_ratio": round(coverage_ratio, 4),
        "confidence": round(confidence, 4),
        "threshold": threshold,
    })


def log_match_rejected(
    category: str,
    requirement: str,
    query: str,
    chunk_id: str,
    doc_id: str,
    doc_name: str,
    page: int,
    semantic_similarity: float,
    threshold: float,
    reason: str,
) -> None:
    _write(MATCHING_LOG_PATH, {
        "event": "match_rejected",
        "category": category,
        "requirement": requirement,
        "query": query,
        "chunk_id": chunk_id,
        "doc_id": doc_id,
        "doc_name": doc_name,
        "page": page,
        "semantic_similarity": round(semantic_similarity, 4),
        "threshold": threshold,
        "reason": reason,
    })


def log_no_candidates(category: str, requirement: str, query: str) -> None:
    _write(MATCHING_LOG_PATH, {
        "event": "no_candidates",
        "category": category,
        "requirement": requirement,
        "query": query,
        "reason": "ChromaDB returned 0 results for this query",
    })
