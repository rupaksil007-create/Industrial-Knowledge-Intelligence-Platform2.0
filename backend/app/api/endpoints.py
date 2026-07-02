"""
endpoints.py — Production API Endpoints
=========================================
All endpoints are deterministic. No demo values, no hardcoded responses.
"""

import hashlib
import os
import logging
import datetime
from typing import Optional
from fastapi import APIRouter, File, UploadFile, HTTPException, Query
from pydantic import BaseModel, model_validator
from app.core.config import settings
from app.services.pdf_parser import extract_text_from_pdf
from app.services.vector_store import vector_store
from app.services.rag import rag_service
from app.services.compliance_engine import compliance_engine
from app.services.audit_logger import (
    log_upload_started,
    log_upload_parsed,
    log_upload_chunked,
    log_upload_indexed,
    log_upload_failed,
    log_upload_duplicate,
    log_upload_deleted,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE MODELS
# ─────────────────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: Optional[str] = None
    question: Optional[str] = None
    document_name: Optional[str] = None
    upload_date: Optional[str] = None
    document_type: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def check_query_or_question(cls, data):
        if not isinstance(data, dict):
            return data
        if "query" not in data and "question" not in data:
            raise ValueError("Either 'query' or 'question' must be provided in the request body.")
        q_val    = data.get("query")
        quest_val = data.get("question")
        errors = []
        if "query" in data:
            if q_val is None:
                if "question" not in data or quest_val is None:
                    errors.append("The query cannot be null.")
            elif not isinstance(q_val, str):
                errors.append("The query must be a string.")
            elif not q_val.strip():
                errors.append("The query cannot be empty.")
        if "question" in data:
            if quest_val is None:
                if "query" not in data or q_val is None:
                    errors.append("The question cannot be null.")
            elif not isinstance(quest_val, str):
                errors.append("The question must be a string.")
            elif not quest_val.strip():
                errors.append("The question cannot be empty.")
        if errors:
            raise ValueError(" ".join(errors))
        return data


class QueryResponse(BaseModel):
    answer: str
    citations: list[dict]


# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENT UPLOAD
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a PDF document.
    Lifecycle: Save → Parse → Chunk → Embed → Store → VerifyCount → Mark READY.
    Audit button is disabled until this completes (status = READY).
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    filename = file.filename
    doc_id   = hashlib.md5(filename.encode()).hexdigest()

    # Block audit during ingestion
    compliance_engine.mark_ingestion_started()
    log_upload_started(doc_id, filename, 0)  # size updated below

    try:
        # ── 1. Save to disk ────────────────────────────────────────────────
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        contents  = await file.read()
        size_bytes = len(contents)

        with open(file_path, "wb") as buf:
            buf.write(contents)

        logger.info(f"[UPLOAD] Saved {filename} ({size_bytes} bytes) to {file_path}")

        # Check for duplicate and log
        existing_docs = vector_store.list_documents()
        is_duplicate  = any(d.get("id") == doc_id for d in existing_docs)
        if is_duplicate:
            log_upload_duplicate(doc_id, filename)

        # ── 2. Parse text page-by-page ─────────────────────────────────────
        pages_data = extract_text_from_pdf(file_path)

        if not pages_data or all(not page["text"] for page in pages_data):
            if os.path.exists(file_path):
                os.remove(file_path)
            log_upload_failed(doc_id, filename, "No text extracted (standard + OCR both failed)")
            raise HTTPException(
                status_code=422,
                detail="Failed to extract any text from the document (standard or OCR).",
            )

        total_pages  = len(pages_data)
        method_used  = pages_data[0].get("method", "unknown") if pages_data else "unknown"
        upload_date  = datetime.date.today().isoformat()
        doc_type     = filename.split(".")[-1].lower() if "." in filename else "pdf"

        log_upload_parsed(doc_id, filename, total_pages, method_used)

        # ── 3. Index into vector store (chunk + embed + store) ─────────────
        success = vector_store.add_document(
            doc_id=doc_id,
            doc_name=filename,
            pages_data=pages_data,
            upload_date=upload_date,
            doc_type=doc_type,
        )

        if not success:
            if os.path.exists(file_path):
                os.remove(file_path)
            log_upload_failed(doc_id, filename, "Vector store indexing failed")
            raise HTTPException(
                status_code=500,
                detail="Failed to index document in the vector database.",
            )

        # ── 4. Verify vector count ─────────────────────────────────────────
        try:
            raw       = vector_store.collection.get(include=["metadatas"])
            all_metas = raw.get("metadatas") or []
            doc_vectors = sum(
                1 for m in all_metas
                if m and m.get("doc_id") == doc_id
            )
        except Exception as ve:
            logger.warning(f"Could not verify vector count for {filename}: {ve}")
            doc_vectors = -1  # unknown, but indexing reported success

        log_upload_chunked(doc_id, filename, doc_vectors if doc_vectors > 0 else total_pages)
        log_upload_indexed(doc_id, filename, doc_vectors)

        # ── 5. Mark KB ready ───────────────────────────────────────────────
        compliance_engine.mark_ingestion_complete()
        compliance_engine.invalidate_cache()

        return {
            "id":          doc_id,
            "name":        filename,
            "total_pages": total_pages,
            "total_vectors": doc_vectors,
            "method":      method_used,
            "status":      "success",
            "message":     (
                f"Successfully parsed {total_pages} pages and indexed "
                f"{doc_vectors} vectors. Knowledge base is READY."
            ),
        }

    except HTTPException:
        compliance_engine.mark_ingestion_complete()
        raise
    except Exception as exc:
        compliance_engine.mark_ingestion_complete()
        log_upload_failed(doc_id, filename, str(exc))
        logger.error(f"Upload error for {filename}: {exc}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error during upload: {exc}",
        )


from app.services.copilot import copilot_service

# ─────────────────────────────────────────────────────────────────────────────
# QUERY
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/query", response_model=QueryResponse)
async def query_rag(request: QueryRequest):
    """Answer a query using RAG with optional metadata filtering."""
    query_text = request.query or request.question
    if not query_text or not query_text.strip():
        raise HTTPException(status_code=400, detail="Query text cannot be empty.")
    try:
        metadata_filter: dict = {}
        if request.document_name:
            metadata_filter["document_name"] = request.document_name
        if request.upload_date:
            metadata_filter["upload_date"] = request.upload_date
        if request.document_type:
            metadata_filter["document_type"] = request.document_type
        response = rag_service.answer_query(query_text, metadata_filter=metadata_filter)
        return response
    except Exception as exc:
        logger.error(f"RAG query error: {exc}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# EXPERT KNOWLEDGE COPILOT
# ─────────────────────────────────────────────────────────────────────────────

class CopilotMessage(BaseModel):
    role: str
    content: str

class CopilotChatRequest(BaseModel):
    messages: list[CopilotMessage]
    document_name: Optional[str] = None
    upload_date: Optional[str] = None
    document_type: Optional[str] = None

@router.post("/copilot/chat", response_model=QueryResponse)
async def copilot_chat(request: CopilotChatRequest):
    """Expert Knowledge Copilot chat endpoint supporting follow-up memory."""
    try:
        messages_list = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        metadata_filter: dict = {}
        if request.document_name:
            metadata_filter["document_name"] = request.document_name
        if request.upload_date:
            metadata_filter["upload_date"] = request.upload_date
        if request.document_type:
            metadata_filter["document_type"] = request.document_type
            
        response = copilot_service.answer_copilot(messages_list, metadata_filter=metadata_filter)
        return response
    except Exception as exc:
        logger.error(f"Copilot chat error: {exc}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {exc}")



# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/documents")
async def get_documents():
    """List all documents in the knowledge base."""
    try:
        return vector_store.list_documents()
    except Exception as exc:
        logger.error(f"Error listing documents: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve document library: {exc}")


@router.delete("/document/{id}")
async def delete_document(id: str):
    """Delete a document from the vector store and disk files."""
    compliance_engine.mark_ingestion_started()
    try:
        # Look up doc_name before delete for logging
        raw   = vector_store.collection.get(include=["metadatas"])
        metas = raw.get("metadatas") or []
        doc_name = next(
            (m.get("doc_name", id) for m in metas if m and m.get("doc_id") == id),
            id,
        )

        success = vector_store.delete_document(id)
        if not success:
            compliance_engine.mark_ingestion_complete()
            raise HTTPException(status_code=404, detail="Document not found or could not be deleted.")

        log_upload_deleted(id, doc_name)
        compliance_engine.mark_ingestion_complete()
        compliance_engine.invalidate_cache()
        return {"success": True, "message": "Document deleted successfully."}
    except HTTPException:
        raise
    except Exception as exc:
        compliance_engine.mark_ingestion_complete()
        logger.error(f"Error deleting document {id}: {exc}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# RETRIEVAL DEBUG
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/retrieval/debug")
async def debug_retrieval(
    q: str = Query(..., description="Query string to search"),
    document_name: Optional[str] = Query(None),
    upload_date:   Optional[str] = Query(None),
    document_type: Optional[str] = Query(None),
):
    """Debug the hybrid retrieval pipeline (Semantic + BM25 + RRF)."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    try:
        metadata_filter: dict = {}
        if document_name:
            metadata_filter["document_name"] = document_name
        if upload_date:
            metadata_filter["upload_date"] = upload_date
        if document_type:
            metadata_filter["document_type"] = document_type

        results = vector_store.search(
            query=q, n_results=10, metadata_filter=metadata_filter, debug=True
        )
        return {
            "query":              q,
            "expanded_query":     vector_store.expand_query(q),
            "retrieved_chunks":   [item["text"] for item in results],
            "scores": [{
                "final_rrf_display_score": item["score"],
                "raw_rrf_score":           item.get("raw_score", 0.0),
                "semantic_score":          item["semantic_score"],
                "bm25_score":              item["bm25_score"],
            } for item in results],
            "document_names":     [item["doc_name"] for item in results],
            "ranking_explanation": [item["explanation"] for item in results],
        }
    except Exception as exc:
        logger.error(f"Debug retrieval error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ─────────────────────────────────────────────────────────────────────────────
# KNOWLEDGE GRAPH
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/graph/nodes")
async def get_graph_nodes():
    """Get all nodes in the Knowledge Graph."""
    try:
        from app.services.knowledge_graph import knowledge_graph_service
        return knowledge_graph_service.get_all_nodes()
    except Exception as exc:
        logger.error(f"Error getting graph nodes: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/graph/edges")
async def get_graph_edges():
    """Get all edges in the Knowledge Graph."""
    try:
        from app.services.knowledge_graph import knowledge_graph_service
        return knowledge_graph_service.get_all_edges()
    except Exception as exc:
        logger.error(f"Error getting graph edges: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/graph/entity/{name}")
async def get_graph_entity(name: str):
    """Get details and relationships for a specific entity."""
    try:
        from app.services.knowledge_graph import knowledge_graph_service
        info = knowledge_graph_service.get_entity_info(name)
        if not info:
            raise HTTPException(status_code=404, detail=f"Entity '{name}' not found.")
        return info
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error getting entity '{name}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/graph/search")
async def search_graph(q: str = Query(..., description="Graph search query")):
    """Search the Knowledge Graph for entities and relationships."""
    try:
        from app.services.knowledge_graph import knowledge_graph_service
        return knowledge_graph_service.search_graph(q)
    except Exception as exc:
        logger.error(f"Error searching graph: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ─────────────────────────────────────────────────────────────────────────────
# COMPLIANCE ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/ingestion/status")
async def get_ingestion_status():
    """
    Returns ingestion status: IDLE | INGESTING | READY.
    Frontend polls this after upload to know when audit is safe to run.
    """
    try:
        return {
            "status":       compliance_engine.get_ingestion_status(),
            "kb_fingerprint": compliance_engine.get_kb_fingerprint(),
        }
    except Exception as exc:
        logger.error(f"Error getting ingestion status: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/compliance/score")
async def get_compliance_score():
    """Get the overall compliance score and risk level."""
    try:
        return compliance_engine.get_score_data()
    except Exception as exc:
        logger.error(f"Error getting compliance score: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/compliance/gaps")
async def get_compliance_gaps():
    """List all detected compliance gaps with full evidence traces."""
    try:
        return compliance_engine.get_gaps()
    except Exception as exc:
        logger.error(f"Error getting compliance gaps: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/compliance/report")
async def get_compliance_report():
    """Get the complete compliance intelligence report."""
    try:
        return compliance_engine.get_report()
    except Exception as exc:
        logger.error(f"Error getting compliance report: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/compliance/analyze")
async def analyze_compliance():
    """
    Run a full synchronous compliance gap analysis.

    - ONE endpoint.
    - Backend finishes everything before returning.
    - No polling. No background threads. No race conditions.
    - Returns 409 if ingestion is currently in progress.
    - Returns cached report if KB fingerprint has not changed.
    """
    import asyncio

    if compliance_engine.get_ingestion_status() == "INGESTING":
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot run audit while document ingestion is in progress. "
                "Wait for ingestion to complete (status: INGESTING)."
            ),
        )

    try:
        # Run synchronous blocking analysis off the event loop thread
        loop   = asyncio.get_event_loop()
        report = await loop.run_in_executor(None, compliance_engine.run_analysis_sync)
        return report
    except RuntimeError as re_err:
        raise HTTPException(status_code=409, detail=str(re_err))
    except Exception as exc:
        logger.error(f"Compliance analysis error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/compliance/logs")
async def get_compliance_logs(
    log_type: str = Query(
        "audit",
        description="Log type: upload | embedding | audit | matching"
    ),
    tail: int = Query(100, description="Number of most recent lines to return"),
):
    """
    Return the last N lines of a compliance log file as NDJSON records.
    Useful for debugging and auditability.
    """
    from app.services.audit_logger import (
        UPLOAD_LOG_PATH, EMBEDDING_LOG_PATH, AUDIT_LOG_PATH, MATCHING_LOG_PATH
    )
    import json as _json

    path_map = {
        "upload":    UPLOAD_LOG_PATH,
        "embedding": EMBEDDING_LOG_PATH,
        "audit":     AUDIT_LOG_PATH,
        "matching":  MATCHING_LOG_PATH,
    }
    if log_type not in path_map:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid log_type. Must be one of: {list(path_map.keys())}",
        )

    log_path = path_map[log_type]
    try:
        if not log_path.exists():
            return {"log_type": log_type, "records": [], "total": 0}

        with open(log_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        tail_lines = lines[-tail:]
        records = []
        for line in tail_lines:
            line = line.strip()
            if line:
                try:
                    records.append(_json.loads(line))
                except Exception:
                    records.append({"raw": line})

        return {
            "log_type": log_type,
            "records":  records,
            "total":    len(records),
        }
    except Exception as exc:
        logger.error(f"Error reading {log_type} log: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
