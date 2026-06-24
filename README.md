# Industrial Knowledge Intelligence Platform (IKIP)

A production-grade, full-stack platform built with Clean Architecture, designed to parse technical manuals, engineering specifications, and standard operating procedures (SOPs), and serve them via a RAG (Retrieval-Augmented Generation) pipeline with page-level citations.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS v4, Lucide Icons, Cybernetic/Industrial aesthetic dark dashboard.
- **Backend**: FastAPI Python, ChromaDB Vector database, pypdf + pdfplumber document parsing.
- **OCR Engine**: Tesseract OCR & Poppler (automatic fallback for scanned PDFs).
- **RAG Models**: OpenAI Embeddings/LLMs, Google Gemini Embeddings/LLMs, and Local Offline Mock fallbacks.

---

## 📁 Project Structure

```text
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI Router & Endpoint Controllers
│   │   ├── core/         # Settings Configuration (Pydantic)
│   │   ├── services/     # RAG, Vector Store, Embeddings, and OCR Services
│   │   └── main.py       # FastAPI Entrypoint
│   ├── requirements.txt  # Python Dependencies
│   ├── .env.example      # Example Environment Variables
│   └── .env              # Active Local Settings
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js App Router Pages, CSS Layouts
│   │   └── components/   # UI Layout & Display Elements
│   ├── package.json      # Node Package Manifest
│   ├── tsconfig.json     # TypeScript Config
│   ├── .env.example      # Example Client-side Variables
│   └── .env.local        # Active Client-side Variables
├── docs/
│   ├── architecture.md   # System Design & Data Workflows
│   ├── api_reference.md  # API Specs for Upload, Query, Library
│   └── setup_guide.md    # Guide for Running Locally & OCR Setups
└── README.md             # Project Master Guide
```

---

## 🚀 Quick Start Guide

### Step 1: Run the Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the development server:
   ```bash
   python app/main.py
   ```
   The API will be available at `http://localhost:8000`. You can inspect the interactive docs at `http://localhost:8000/docs`.

### Step 2: Run the Frontend
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node packages:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The industrial dashboard will load at `http://localhost:3000`.

---

## 📖 Complete Documentation
For full architectural details, API specifications, and installation tips (including Tesseract OCR setup guides), refer to the files in the `/docs` directory:
- 🗺️ **[System Architecture](file:///docs/architecture.md)**
- 🔌 **[API Reference](file:///docs/api_reference.md)**
- ⚙️ **[Local Setup Guide](file:///docs/setup_guide.md)**
