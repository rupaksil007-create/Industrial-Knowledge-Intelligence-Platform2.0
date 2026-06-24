# Industrial Knowledge Intelligence Platform (IKIP) - Architecture

The Industrial Knowledge Intelligence Platform (IKIP) is built using a **Clean Architecture** model, ensuring that components are highly modular, testable, and loosely coupled.

```mermaid
graph TD
    subgraph Frontend (Next.js 15 + TS + Tailwind)
        UI[Dashboard / Chat / Doc Library]
        APIClient[Fetch Client]
    end

    subgraph Backend (FastAPI Python)
        API[API Endpoints / Controllers]
        
        subgraph Services
            PDF[PDF & OCR Parser]
            VS[Vector Store Service]
            EMB[Embedding Service]
            RAG[RAG QA Engine]
        end
    end

    subgraph Storage Layer
        CHROMA[(ChromaDB Vector DB)]
        DISK[(Uploaded PDFs Storage)]
    end

    UI -->|HTTP Requests| API
    APIClient -->|JSON / Multipart| API
    
    API --> PDF
    API --> VS
    API --> RAG
    
    VS --> EMB
    VS --> CHROMA
    VS --> DISK
    
    RAG --> VS
    RAG --> LLM[LLM: OpenAI / Gemini / Mock]
```

## System Layers

### 1. Presentation Layer (Frontend)
- **Framework**: Next.js 15 (App Router) with TypeScript.
- **Styling**: Tailwind CSS & Shadcn UI.
- **Components**:
  - **Dashboard**: High-level telemetry of the ingestion state (document counts, chunk metrics, query stats).
  - **Chat Interface**: Stream-like interactive QA UI, displaying conversational agents, messages, and formatting Markdown details.
  - **Document Library**: Lists indexed files with size, chunk count, and options to upload new PDFs or delete them.
  - **Citation panel**: Side drawer displaying text snippets, similarity scores, and page numbers matching RAG results.

### 2. Controller Layer (FastAPI API)
- **File**: `backend/app/main.py` and `backend/app/api/endpoints.py`
- Exposes direct, stateless routes for frontend interactions:
  - `POST /upload`: Save files, convert/parse text, and index chunks.
  - `POST /query`: Retrieve chunks, query LLM, and return answers + source citations.
  - `GET /documents`: List database metadata.
  - `DELETE /document/{id}`: Purge document indexes and file binaries.

### 3. Service Layer (Business Logic)
- **PDF Parser & OCR (`pdf_parser.py`)**: Uses `pypdf` for fast text extraction. If text density is too low, converts PDF pages to PIL images via `pdf2image` and runs Tesseract OCR.
- **Embedding Service (`embedding.py`)**: Computes embeddings. Supports local ChromaDB embeddings, OpenAI Embeddings, Gemini Embeddings, and fallback deterministic mock representations for offline setups.
- **Vector Store (`vector_store.py`)**: Wraps ChromaDB APIs, structuring collection indexing, page-by-page text splitting, vector searches, and retrieval.
- **RAG Engine (`rag.py`)**: Integrates retrieval and generation pipelines, supporting OpenAI GPT-4o-mini, Gemini 1.5 Flash, or a mock summary generator.

### 4. Data Layer (Persistence)
- **ChromaDB**: An open-source vector database configured as a local persistent storage client.
- **Upload Storage**: Local disk directory preserving original PDF files.
