import logging
from app.core.config import settings
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)

class RAGService:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower()
        self.openai_key = settings.OPENAI_API_KEY
        self.gemini_key = settings.GEMINI_API_KEY
        self.client = None
        
        logger.info(f"Initializing RAG Service with LLM provider: {self.provider}")
        
        if self.provider == "openai":
            if self.openai_key:
                try:
                    import openai
                    self.client = openai.OpenAI(api_key=self.openai_key)
                    logger.info("OpenAI LLM client configured successfully.")
                except ImportError:
                    logger.error("openai package not found. Falling back to Mock LLM.")
                    self.provider = "mock"
            else:
                logger.warning("OpenAI API key not set. Falling back to Mock LLM.")
                self.provider = "mock"
                
        if self.provider == "gemini":
            if self.gemini_key:
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=self.gemini_key)
                    self.client = genai.GenerativeModel(settings.GEMINI_MODEL)
                    logger.info(f"Gemini LLM model '{settings.GEMINI_MODEL}' configured successfully.")
                except ImportError:
                    logger.error("google-generativeai package not found. Falling back to Mock LLM.")
                    self.provider = "mock"
                except Exception as e:
                    logger.error(f"Failed to initialize Gemini LLM model: {e}. Falling back to Mock LLM.")
                    self.provider = "mock"
            else:
                logger.warning("Gemini API key not set. Falling back to Mock LLM.")
                self.provider = "mock"

    def answer_query(self, query: str, metadata_filter: dict = None) -> dict:
        """
        Retrieves context, constructs a prompt, queries the LLM, and returns the answer with citations.
        """
        # 1. Search Vector DB for context
        search_results = vector_store.search(query, n_results=20, metadata_filter=metadata_filter)
        
        if not search_results:
            return {
                "answer": "No relevant documents have been uploaded yet. Please upload files to the document library first.",
                "citations": []
            }
            
        # 2. Formulate context and citations
        context_blocks = []
        citations = []
        
        for idx, result in enumerate(search_results):
            context_blocks.append(
                f"[Doc {idx+1}]: {result['doc_name']} (Page {result['page']})\n"
                f"Content: {result['text']}\n"
            )
            citations.append({
                "doc_name": result["doc_name"],
                "doc_id": result["doc_id"],
                "page": result["page"],
                "text_snippet": result["text"][:300] + ("..." if len(result["text"]) > 300 else ""),
                "score": result["score"],
                "explanation": result.get("explanation"),
                "vector_score": result.get("vector_score"),
                "bm25_score": result.get("bm25_score"),
                "rrf_score": result.get("rrf_score"),
                "document_boost": result.get("document_boost"),
                "final_score": result.get("final_score")
            })
            
        context_str = "\n---\n".join(context_blocks)
        
        # 3. LLM QA
        prompt = (
            "You are an expert Industrial Knowledge Intelligence Agent. Your goal is to provide concise, professional, "
            "industrial-engineering style answers based on the provided document context.\n\n"
            "INSTRUCTIONS:\n"
            "1. Answer the query using ONLY the provided document contexts. If the context does not contain the answer, "
            "state that the information is not present in the current knowledge base.\n"
            "2. If the user asks to summarize a document, section, or problem statement, provide a clear, structured "
            "executive summary using professional engineering terminology. Avoid raw text excerpts or conversational filler.\n"
            "3. Always preserve source citations and page references in your text. Reference documents using their label, "
            "e.g., [Doc X] (Page Y) or (Document Name, Page Y).\n"
            "4. Structure your response clearly using markdown headings, bullet points, and tables where appropriate to "
            "match the style of engineering specifications or standard operating procedures.\n\n"
            f"Context:\n{context_str}\n\n"
            f"Query: {query}\n\n"
            "Answer:"
        )
        
        answer = ""
        if self.provider == "openai" and self.client:
            try:
                response = self.client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": "You are a professional industrial intelligence assistant."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.2
                )
                answer = response.choices[0].message.content.strip()
            except Exception as e:
                logger.error(f"OpenAI completion failed: {e}. Falling back to mock generator.")
                answer = self._generate_mock_answer(query, search_results)
                
        elif self.provider == "gemini" and self.client:
            try:
                response = self.client.generate_content(
                    prompt,
                    generation_config={"temperature": 0.2}
                )
                answer = response.text.strip()
            except Exception as e:
                logger.error(f"Gemini completion failed: {e}. Falling back to mock generator.")
                answer = self._generate_mock_answer(query, search_results)
                
        else: # provider == "mock"
            answer = self._generate_mock_answer(query, search_results)
            
        return {
            "answer": answer,
            "citations": citations
        }

    def _generate_mock_answer(self, query: str, search_results: list[dict]) -> str:
        """
        Generates a readable local mock response based on the top retrieved passages.
        This allows testing the frontend layout and structure offline without API keys.
        """
        logger.info("Generating synthesized offline response from retrieved documents.")
        
        # Look for exact word matches in search results to build a mock response
        matched_sentences = []
        query_words = [w.lower() for w in query.replace("?", "").split() if len(w) > 3]
        
        for idx, result in enumerate(search_results[:3]):
            text = result["text"]
            sentences = [s.strip() for s in text.split(".") if s.strip()]
            
            for s in sentences:
                s_lower = s.lower()
                # If sentence contains any key query words, consider it relevant
                if any(qw in s_lower for qw in query_words):
                    if s not in matched_sentences:
                        matched_sentences.append(f"{s} (Ref: {result['doc_name']}, Page {result['page']})")
                        
        if matched_sentences:
            body = " ".join(matched_sentences[:4])
            return (
                f"[LOCAL OFFLINE RAG MODE]\n\n"
                f"Based on the knowledge base, I found the following relevant information:\n"
                f"{body}.\n\n"
                f"For further details, please consult the cited pages in the sources panel."
            )
        else:
            # Fallback to general summary of top passages
            summary_parts = []
            for idx, result in enumerate(search_results[:2]):
                summary_parts.append(
                    f"From {result['doc_name']} (Page {result['page']}): \"{result['text'][:150]}...\""
                )
            summary_text = "\n\n".join(summary_parts)
            
            return (
                f"[LOCAL OFFLINE RAG MODE]\n\n"
                f"No direct sentence matches were found for your query terms. However, the most relevant documents found in the database are:\n\n"
                f"{summary_text}\n\n"
                f"Please refine your query or review the document citations on the side."
            )

# Global instance
rag_service = RAGService()
