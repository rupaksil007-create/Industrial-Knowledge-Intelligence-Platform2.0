# Backend API Reference

This reference details the REST API endpoints exposed by the Industrial Knowledge Intelligence Platform (IKIP) server.

The default local endpoint is `http://localhost:8000`.

---

## 1. Document Upload

Ingests a PDF file, parses it (falling back to OCR if scanned), chunks the text, computes embeddings, and indexes them in ChromaDB.

* **Endpoint**: `POST /upload`
* **Content-Type**: `multipart/form-data`
* **Request Parameters**:
  * `file`: Binary PDF file.
* **Success Response (Code: 200 OK)**:
  ```json
  {
    "id": "1a2b3c4d5e6f...",
    "name": "manual_turbine_v3.pdf",
    "total_pages": 12,
    "method": "standard", // or "ocr"
    "status": "success",
    "message": "Successfully parsed and indexed 12 pages."
  }
  ```
* **Error Responses**:
  * `400 Bad Request`: "Only PDF files are supported."
  * `422 Unprocessable Entity`: "Failed to extract any text from the document."
  * `500 Internal Server Error`: "Failed to index document in the vector database."

---

## 2. RAG Query

Queries the knowledge base using vector search and generates a RAG-based answer with source citations.

* **Endpoint**: `POST /query`
* **Content-Type**: `application/json`
* **Request Body**:
  ```json
  {
    "query": "What is the recommended operating pressure for the coolant pump?"
  }
  ```
* **Success Response (Code: 200 OK)**:
  ```json
  {
    "answer": "According to the Coolant System Operation Manual, the recommended operating pressure for the coolant pump is 4.5 bar under normal load conditions, and should not exceed 5.0 bar (page 7).",
    "citations": [
      {
        "doc_name": "coolant_system_manual.pdf",
        "doc_id": "8b9c10d...",
        "page": 7,
        "text_snippet": "...The operational guidelines specify that the coolant pump pressure must reside at 4.5 bar (±0.2 bar). Exceeding 5.0 bar triggers the pressure relief safety valve...",
        "score": 0.892
      }
    ]
  }
  ```
* **Error Responses**:
  * `400 Bad Request`: "Query cannot be empty."
  * `500 Internal Server Error`: "Internal server error."

---

## 3. List Documents

Retrieves the list of all indexed documents and their summary metadata.

* **Endpoint**: `GET /documents`
* **Success Response (Code: 200 OK)**:
  ```json
  [
    {
      "id": "1a2b3c4d5e6f...",
      "name": "manual_turbine_v3.pdf",
      "total_pages": 12,
      "total_chunks": 32,
      "size_bytes": 1048576 // 1 MB
    },
    {
      "id": "8b9c10d...",
      "name": "coolant_system_manual.pdf",
      "total_pages": 8,
      "total_chunks": 18,
      "size_bytes": 524288 // 512 KB
    }
  ]
  ```

---

## 4. Delete Document

Removes the document's vector index from ChromaDB and purges its stored source PDF.

* **Endpoint**: `DELETE /document/{id}`
* **URL Parameters**:
  * `id` (string): The MD5 hex hash (doc_id) of the document.
* **Success Response (Code: 200 OK)**:
  ```json
  {
    "success": true,
    "message": "Document deleted successfully."
  }
  ```
* **Error Responses**:
  * `404 Not Found`: "Document not found or could not be deleted."
  * `500 Internal Server Error`: "Internal server error."
