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

logger = logging.getLogger(__name__)
router = APIRouter()

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
        
        # Check that at least one of 'query' or 'question' is supplied
        if "query" not in data and "question" not in data:
            raise ValueError("Either 'query' or 'question' must be provided in the request body.")
            
        # Get query and question values
        q_val = data.get("query")
        quest_val = data.get("question")
        
        errors = []
        if "query" in data:
            if q_val is None:
                # If question is also provided and valid, that's fine. Otherwise, query cannot be null.
                if "question" not in data or quest_val is None:
                    errors.append("The query cannot be null.")
            elif not isinstance(q_val, str):
                errors.append("The query must be a string.")
            elif not q_val.strip():
                errors.append("The query cannot be empty.")
                
        if "question" in data:
            if quest_val is None:
                # If query is also provided and valid, that's fine. Otherwise, question cannot be null.
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

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a PDF document, parse text (with OCR fallback), and index chunks into ChromaDB with metadata.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    try:
        # 1. Create a safe filename and path
        filename = file.filename
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        
        # Save file to disk
        with open(file_path, "wb") as buffer:
            contents = await file.read()
            buffer.write(contents)
            
        logger.info(f"File saved to {file_path}")
        
        # Generate a unique doc_id based on filename hash to prevent duplicate listings
        doc_id = hashlib.md5(filename.encode()).hexdigest()
        
        # 2. Extract text page-by-page
        pages_data = extract_text_from_pdf(file_path)
        
        if not pages_data or all(not page["text"] for page in pages_data):
            # Clean up file on failure
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=422, detail="Failed to extract any text from the document (standard or OCR).")
            
        # Capture metadata
        upload_date = datetime.date.today().isoformat()
        doc_type = filename.split('.')[-1].lower() if '.' in filename else 'pdf'
        
        # 3. Add to vector store with metadata
        success = vector_store.add_document(
            doc_id=doc_id, 
            doc_name=filename, 
            pages_data=pages_data,
            upload_date=upload_date,
            doc_type=doc_type
        )
        
        if not success:
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=500, detail="Failed to index document in the vector database.")
            
        total_pages = len(pages_data)
        method_used = pages_data[0].get("method", "unknown") if pages_data else "unknown"
        
        return {
            "id": doc_id,
            "name": filename,
            "total_pages": total_pages,
            "method": method_used,
            "status": "success",
            "message": f"Successfully parsed and indexed {total_pages} pages."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error handling upload: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error during upload: {str(e)}")

@router.post("/query", response_model=QueryResponse)
async def query_rag(request: QueryRequest):
    """
    Answer a query using the documents indexed in the knowledge base (RAG) with optional metadata filtering.
    """
    query_text = request.query or request.question
    if not query_text or not query_text.strip():
        raise HTTPException(status_code=400, detail="Query text cannot be empty.")
        
    try:
        # Populate optional filters
        metadata_filter = {}
        if request.document_name:
            metadata_filter["document_name"] = request.document_name
        if request.upload_date:
            metadata_filter["upload_date"] = request.upload_date
        if request.document_type:
            metadata_filter["document_type"] = request.document_type

        response = rag_service.answer_query(query_text, metadata_filter=metadata_filter)
        return response
    except Exception as e:
        logger.error(f"Error executing RAG query: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/documents")
async def get_documents():
    """
    List all documents in the knowledge base.
    """
    try:
        return vector_store.list_documents()
    except Exception as e:
        logger.error(f"Error listing documents: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve document library: {str(e)}")

@router.delete("/document/{id}")
async def delete_document(id: str):
    """
    Delete a document from the vector store and clean up its disk files.
    """
    try:
        success = vector_store.delete_document(id)
        if not success:
            raise HTTPException(status_code=404, detail="Document not found or could not be deleted.")
        return {"success": True, "message": "Document deleted successfully."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document {id}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/retrieval/debug")
async def debug_retrieval(
    q: str = Query(..., description="Query query string to search"),
    document_name: str = Query(None, description="Optional document name to filter by"),
    upload_date: str = Query(None, description="Optional upload date (YYYY-MM-DD) to filter by"),
    document_type: str = Query(None, description="Optional document type to filter by")
):
    """
    Debug and analyze the hybrid retrieval pipeline (Semantic + BM25 + RRF + boosts).
    """
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
        
    try:
        metadata_filter = {}
        if document_name:
            metadata_filter["document_name"] = document_name
        if upload_date:
            metadata_filter["upload_date"] = upload_date
        if document_type:
            metadata_filter["document_type"] = document_type
            
        # Search the database with debug details enabled
        results = vector_store.search(
            query=q,
            n_results=10, # Top 10 matches for debug analysis
            metadata_filter=metadata_filter,
            debug=True
        )
        
        retrieved_chunks = []
        scores = []
        document_names = []
        ranking_explanations = []
        
        for item in results:
            retrieved_chunks.append(item["text"])
            scores.append({
                "final_rrf_display_score": item["score"],
                "raw_rrf_score": item.get("raw_score", 0.0),
                "semantic_score": item["semantic_score"],
                "bm25_score": item["bm25_score"]
            })
            document_names.append(item["doc_name"])
            ranking_explanations.append(item["explanation"])
            
        return {
            "query": q,
            "expanded_query": vector_store.expand_query(q),
            "retrieved_chunks": retrieved_chunks,
            "scores": scores,
            "document_names": document_names,
            "ranking_explanation": ranking_explanations
        }
    except Exception as e:
        logger.error(f"Error in debug retrieval endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/graph/nodes")
async def get_graph_nodes():
    """
    Get all nodes in the Knowledge Graph.
    """
    try:
        from app.services.knowledge_graph import knowledge_graph_service
        return knowledge_graph_service.get_all_nodes()
    except Exception as e:
        logger.error(f"Error getting graph nodes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/graph/edges")
async def get_graph_edges():
    """
    Get all edges (relationships) in the Knowledge Graph.
    """
    try:
        from app.services.knowledge_graph import knowledge_graph_service
        return knowledge_graph_service.get_all_edges()
    except Exception as e:
        logger.error(f"Error getting graph edges: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/graph/entity/{name}")
async def get_graph_entity(name: str):
    """
    Get details and relationships for a specific entity by name.
    """
    try:
        from app.services.knowledge_graph import knowledge_graph_service
        info = knowledge_graph_service.get_entity_info(name)
        if not info:
            raise HTTPException(status_code=404, detail=f"Entity '{name}' not found in the Knowledge Graph.")
        return info
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting entity info for '{name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/graph/search")
async def search_graph(q: str = Query(..., description="Query string for graph search")):
    """
    Search the Knowledge Graph for entities and relationships.
    Supports queries like:
    - 'Show relationships for Pump-4'
    - 'What systems depend on Boiler-12'
    - 'Show connected assets'
    - Or any keyword search
    """
    try:
        from app.services.knowledge_graph import knowledge_graph_service
        return knowledge_graph_service.search_graph(q)
    except Exception as e:
        logger.error(f"Error searching graph: {e}")
        raise HTTPException(status_code=500, detail=str(e))

