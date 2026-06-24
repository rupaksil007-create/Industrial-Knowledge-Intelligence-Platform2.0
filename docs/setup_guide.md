# Local Setup & Running Guide

This guide describes how to run the Industrial Knowledge Intelligence Platform (IKIP) locally.

## System Prerequisites (Optional for Scanned PDF OCR support)
To use OCR on scanned PDFs, the system requires these binaries:
1. **Tesseract OCR**:
   - **Windows**: Download installer from UB Mannheim. Add the installation folder (e.g. `C:\Program Files\Tesseract-OCR`) to your system environment variables `PATH`.
   - **macOS**: Run `brew install tesseract`
   - **Linux**: Run `sudo apt-get install tesseract-ocr`
2. **Poppler** (for converting PDF pages to images):
   - **Windows**: Download poppler for Windows, extract it, and add the `bin/` directory to your system `PATH`.
   - **macOS**: Run `brew install poppler`
   - **Linux**: Run `sudo apt-get install poppler-utils`

*Note: If these tools are not installed, the platform will still function using standard text parsing for native PDFs. Scanned documents will report a warning in logs and gracefully output empty content.*

---

## 1. Backend Setup

1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Verify your `.env` configuration. A default `.env` is already configured for local mock execution (no external API keys required). If you wish to use OpenAI or Gemini APIs, update the settings:
   ```env
   EMBEDDING_PROVIDER="openai" # or "gemini"
   LLM_PROVIDER="openai" # or "gemini"
   OPENAI_API_KEY="your-api-key"
   # GEMINI_API_KEY="your-gemini-key"
   ```
5. Run the FastAPI development server:
   ```bash
   python app/main.py
   ```
   The backend will be running on `http://localhost:8000`. You can test it by visiting the API docs at `http://localhost:8000/docs`.

---

## 2. Frontend Setup

1. Open a terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   The dashboard will be active on `http://localhost:3000`.
