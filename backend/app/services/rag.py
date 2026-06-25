import logging
import re
from app.core.config import settings
from app.services.vector_store import vector_store, extract_problem_number

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
            "executive summary of only the requested section/problem statement. Do not include information from "
            "other unrelated problem statements even if they are in the context. Avoid raw text excerpts or conversational filler.\n"
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
        
        # Determine if the query targets a specific problem statement
        target_problem = extract_problem_number(query)
        
        # Find the title/heading chunk to use as the main title
        title = None
        for res in search_results:
            heading = res.get("heading", "")
            if "Problem Statement" in heading and ":" in heading and not any(sub in heading.upper() for sub in ["CONTEXT", "CHALLENGE", "TECHNOLOGIES", "DELIVERABLES", "CRITERIA", "BUILD"]):
                title = heading
                break
                
        if not title:
            title = search_results[0].get("heading", "Problem Statement Details")
            
        # Extract sections from any retrieved chunk by looking at heading metadata
        theme = None
        context_parts = []
        challenge = None
        tech_list = []
        deliverables = []
        criteria = None
        
        for res in search_results[:15]:
            heading = res.get("heading", "").upper()
            text = res["text"]
            # Clean section header tag
            clean_text = re.sub(r'^\[Section:.*?\]\s*', '', text).strip()
            
            # Find Theme
            if not theme:
                theme_match = re.search(r'Theme:\s*(.*?)(?:\n|$)', clean_text, re.IGNORECASE)
                if theme_match:
                    theme = theme_match.group(1).strip()
            
            # Find Problem Context
            if "PROBLEM CONTEXT" in heading:
                if clean_text and clean_text not in context_parts:
                    context_parts.append(clean_text)
                    
            # Find Challenge Statement
            if "CHALLENGE STATEMENT" in heading:
                if clean_text and not challenge:
                    challenge = clean_text
                    
            # Find Suggested Technologies
            if "SUGGESTED TECHNOLOGIES" in heading:
                tech_lines = [line.strip(" \t*•-") for line in clean_text.split("\n") if line.strip()]
                for line in tech_lines:
                    if line and line not in tech_list:
                        tech_list.append(line)
                                
            # Find Expected Deliverables
            if "EXPECTED DELIVERABLES" in heading:
                deliv_lines = [line.strip(" \t*•-") for line in clean_text.split("\n") if line.strip()]
                for line in deliv_lines:
                    if line and line not in deliverables:
                        deliverables.append(line)
                                
            # Find Judging Criteria
            if "JUDGING CRITERIA" in heading:
                if clean_text and not criteria:
                    criteria = clean_text
                    
        # Construct summary response
        summary = (
            f"[LOCAL OFFLINE RAG MODE]\n\n"
            f"### Executive Summary: {title}\n\n"
        )
        
        if theme:
            summary += f"**Theme**: {theme}\n\n"
            
        if challenge:
            summary += f"#### Challenge Statement\n{challenge}\n\n"
            
        if context_parts:
            full_context = " ".join(context_parts)
            if len(full_context) > 750:
                full_context = full_context[:750] + "..."
            summary += f"#### Problem Context\n{full_context}\n\n"
            
        if tech_list:
            summary += "#### Suggested Technologies\n"
            for tech in tech_list[:8]:
                summary += f"- {tech}\n"
            summary += "\n"
            
        if deliverables:
            summary += "#### Expected Deliverables\n"
            for d in deliverables[:6]:
                summary += f"- {d}\n"
            summary += "\n"
            
        if criteria:
            # Format criteria cleanly
            clean_crit = criteria.replace("\n", " | ").strip()
            if len(clean_crit) > 200:
                clean_crit = clean_crit[:200] + "..."
            summary += f"#### Judging Criteria\n{clean_crit}\n\n"
            
        summary += f"*Referenced from source document: {search_results[0]['doc_name']} (Page {search_results[0]['page']}).*"
        return summary

# Global instance
rag_service = RAGService()
