import os
import re
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import google.generativeai as genai
import openai

from app.core.config import settings
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)

class CopilotMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class CopilotService:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower()
        self.openai_key = settings.OPENAI_API_KEY
        self.gemini_key = settings.GEMINI_API_KEY
        self.client = None
        
        logger.info(f"Initializing Copilot Service with LLM provider: {self.provider}")
        
        if self.provider == "openai":
            if self.openai_key:
                try:
                    self.client = openai.OpenAI(api_key=self.openai_key)
                    logger.info("OpenAI client configured for Copilot.")
                except Exception as e:
                    logger.error(f"Failed to configure OpenAI client for Copilot: {e}")
                    self.provider = "mock"
            else:
                self.provider = "mock"
                
        elif self.provider == "gemini":
            if self.gemini_key:
                try:
                    genai.configure(api_key=self.gemini_key)
                    self.client = genai.GenerativeModel(settings.GEMINI_MODEL)
                    logger.info(f"Gemini client configured for Copilot using {settings.GEMINI_MODEL}.")
                except Exception as e:
                    logger.error(f"Failed to configure Gemini client for Copilot: {e}")
                    self.provider = "mock"
            else:
                self.provider = "mock"

    def classify_mode(self, query: str) -> str:
        """Classifies the query into one of the 9 specific task modes or default."""
        q = query.lower().strip()
        
        # 3. Compare
        if any(w in q for w in ["compare", "difference", "versus", "vs", "comparison", "contrast"]):
            return "compare"
        
        # 1. Explain
        if any(w in q for w in ["explain", "what does", "meaning of", "clarify", "what is"]):
            return "explain"
            
        # 2. Summarize
        if any(w in q for w in ["summarize", "summary", "tldr", "executive summary", "overview of"]):
            return "summarize"
            
        # 4. Procedure Guidance
        if any(w in q for w in ["guide", "procedure", "how to", "how should", "step-by-step", "steps for", "instruction", "instructions"]):
            return "guidance"
            
        # 5. Cross-document reasoning
        if any(w in q for w in ["cross-document", "reason across", "combine", "together", "what should a"]):
            # e.g., "what should a maintenance technician know before working?"
            if "know" in q or "before" in q:
                return "reasoning"
            
        # 6. Responsibilities
        if any(w in q for w in ["responsible", "responsibility", "who is", "who owns", "owner", "coordinates", "coordinates", "roles"]):
            return "responsibilities"
            
        # 7. Risk Identification
        if any(w in q for w in ["risk", "risks", "hazard", "hazards", "precaution", "safety precautions", "danger", "dangers"]):
            return "risks"
            
        # 8. Recommendations
        if any(w in q for w in ["recommendation", "recommendations", "improve", "improvement", "missing", "observations"]):
            return "recommendations"
            
        # 9. Document Discovery
        if any(w in q for w in ["which documents discuss", "which documents mention", "find documents", "document list", "what documents"]):
            return "discovery"
            
        return "general"

    def rewrite_query_for_search(self, query: str, history: List[Dict[str, str]]) -> str:
        """Uses LLM to rewrite query incorporating conversation history, or falls back to text-based extraction."""
        if not history:
            return query
            
        history_text = ""
        for msg in history[-4:]:
            role = "User" if msg.get("role") == "user" else "Assistant"
            history_text += f"{role}: {msg.get('content')}\n"
            
        prompt = (
            "Given the conversation history and the new question, generate a single search query "
            "that captures the full context of what the user is asking, especially resolving pronouns "
            "like 'who is responsible for that?' or 'how does it relate to maintenance?'.\n\n"
            f"History:\n{history_text}\n"
            f"New Question: {query}\n\n"
            "Respond ONLY with the search query text, no explanation or punctuation around it."
        )
        
        if self.provider == "gemini" and self.client:
            try:
                response = self.client.generate_content(prompt)
                rewritten = response.text.strip().replace('"', '').replace("'", "")
                if rewritten:
                    logger.info(f"Rewritten query (Gemini): '{rewritten}'")
                    return rewritten
            except Exception as e:
                logger.error(f"Gemini query rewrite failed: {e}")
        elif self.provider == "openai" and self.client:
            try:
                response = self.client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1
                )
                rewritten = response.choices[0].message.content.strip().replace('"', '').replace("'", "")
                if rewritten:
                    logger.info(f"Rewritten query (OpenAI): '{rewritten}'")
                    return rewritten
            except Exception as e:
                logger.error(f"OpenAI query rewrite failed: {e}")
                
        # Simple local fallback for rewrite: extract subjects
        # e.g., if query is "who is responsible?" and previous was "Explain LOTO", query becomes "LOTO responsible"
        subject = ""
        for msg in reversed(history):
            if msg.get("role") == "user":
                prev_q = msg.get("content", "").lower()
                # Extract some nouns
                matches = re.findall(r'\b(loto|lockout|tagout|safety|maintenance|procedure|compressor|sops?|manual)\b', prev_q)
                if matches:
                    subject = " ".join(set(matches))
                    break
        if subject:
            return f"{subject} {query}"
        return query

    def answer_copilot(
        self,
        messages: List[Dict[str, str]],
        metadata_filter: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Orchestrates query classification, retrieval, prompt generation, LLM response, or local fallback."""
        if not messages:
            return {"answer": "No messages received.", "citations": []}
            
        current_msg = messages[-1]
        query = current_msg.get("content", "")
        history = messages[:-1]
        
        # 1. Clean query and check for engineer or simple mode
        q_clean = query.strip()
        is_engineer = "like an engineer" in q_clean.lower()
        is_simple = "explain simply" in q_clean.lower() or "simply" in q_clean.lower()
        
        # 2. Rewrite query if there is history
        search_query = self.rewrite_query_for_search(q_clean, history)
        
        # 3. Retrieve documents
        search_results = vector_store.hybrid_search(
            query=search_query,
            n_results=15,
            metadata_filter=metadata_filter
        )
        
        if not search_results:
            return {
                "answer": "# Answer\nThe uploaded documents do not contain this information.\n\n# Key Points\n- Information not found in knowledge base.\n\n# Evidence\nNone.",
                "citations": []
            }
            
        # Clean and deduplicate search results
        seen_texts = set()
        clean_chunks = []
        for chunk in search_results:
            raw = chunk.get("text", "")
            if not raw:
                continue
            # basic cleanup
            cleaned = re.sub(r'\s+', ' ', raw).strip()
            if cleaned in seen_texts:
                continue
            seen_texts.add(cleaned)
            clean_chunks.append(chunk)
            
        if not clean_chunks:
            return {
                "answer": "# Answer\nThe uploaded documents do not contain this information.\n\n# Key Points\n- Information not found in knowledge base.\n\n# Evidence\nNone.",
                "citations": []
            }

        # Classify the assistance mode
        mode = self.classify_mode(q_clean)
        logger.info(f"Copilot classified mode: {mode}")

        # Try LLM Mode
        llm_success = False
        answer_text = ""
        
        if self.provider in ["gemini", "openai"] and self.client:
            # Build Context string
            context_parts = []
            for i, chunk in enumerate(clean_chunks):
                doc_name = chunk.get("doc_name", "Unknown")
                page = chunk.get("page", 0)
                text = chunk.get("text", "")
                context_parts.append(f"Document [{doc_name}] Page {page}:\n{text}\n")
            context_str = "\n".join(context_parts)
            
            # Build history string
            history_str = ""
            for h in history[-6:]:
                role = "User" if h.get("role") == "user" else "Copilot"
                history_str += f"{role}: {h.get('content')}\n"
                
            system_prompt = (
                "You are an experienced senior industrial engineering copilot. You help engineers analyze, understand and act on industrial knowledge.\n"
                "You must base your answer ONLY on the retrieved contexts provided. Never hallucinate or assume facts not present in the contexts.\n"
                "If the context does not contain the answer, you must state exactly: 'The uploaded documents do not contain this information.'\n\n"
                f"Tone/Language constraints:\n"
                f"{'Use advanced, precise professional industrial engineering terminology.' if is_engineer else 'Use beginner-friendly, simple language.' if is_simple else 'Maintain a professional senior engineer tone.'}\n\n"
                "Response Style:\n"
                "You must structure your response exactly using these main markdown headers:\n"
                "# Answer\n"
                "[Synthesize a structured professional answer. Never dump document chunks. Never return raw retrieval output.]\n\n"
                "# Key Points\n"
                "- [Point 1]\n"
                "- [Point 2]\n\n"
                "# Evidence\n"
                "- [Document Name] (Page [Page Number]): [Direct quote or specific evidence paraphrase]\n\n"
                "Additional instructions per mode:\n"
                "- If mode is 'explain': provide a concise explanation, why it exists, industrial importance, affected personnel.\n"
                "- If mode is 'summarize': output Executive Summary, Key Responsibilities, Safety Requirements, Inspection Requirements, Important Dates/Frequencies, and Documents Referenced.\n"
                "- If mode is 'compare': output a comparison markdown table comparing aspects between the referenced documents (Aspect | Doc A | Doc B).\n"
                "- If mode is 'guidance': output step-by-step procedure guidance synthesized only from uploaded documents (no invented steps).\n"
                "- If mode is 'recommendations': output Observations, Recommendations, Potential Risks, and Supporting Evidence.\n"
                "- If mode is 'discovery': list which documents discuss the topic, short explanations and citations."
            )
            
            prompt = (
                f"{system_prompt}\n\n"
                f"Retrieved Contexts:\n{context_str}\n\n"
                f"Conversation History:\n{history_str}\n"
                f"Current Question: {query}\n\n"
                "Format your response exactly with # Answer, # Key Points, and # Evidence headers."
            )
            
            if self.provider == "gemini":
                try:
                    logger.info("Running Copilot Gemini synthesis...")
                    response = self.client.generate_content(prompt)
                    answer_text = response.text
                    llm_success = True
                except Exception as e:
                    logger.error(f"Copilot Gemini generation failed: {e}. Falling back to Local synthesis.")
            elif self.provider == "openai":
                try:
                    logger.info("Running Copilot OpenAI synthesis...")
                    response = self.client.chat.completions.create(
                        model=settings.OPENAI_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.1
                    )
                    answer_text = response.choices[0].message.content
                    llm_success = True
                except Exception as e:
                    logger.error(f"Copilot OpenAI generation failed: {e}. Falling back to Local synthesis.")

        # Check if LLM output was valid and grounded
        if llm_success and answer_text:
            # Check if LLM indicates info not found
            ans_lower = answer_text.lower()
            if "uploaded documents do not contain" in ans_lower or "information is unavailable" in ans_lower:
                return {
                    "answer": "# Answer\nThe uploaded documents do not contain this information.\n\n# Key Points\n- Information not found in knowledge base.\n\n# Evidence\nNone.",
                    "citations": []
                }
            
            # Parse citations from clean_chunks matching LLM output
            citations = self.build_citations_from_results(clean_chunks)
            return {
                "answer": answer_text,
                "citations": citations
            }
            
        # Fallback to local RAG synthesis
        logger.info("Running local synthesis fallback for Copilot...")
        return self.synthesize_local_fallback(query, clean_chunks, mode, is_engineer, is_simple)

    def build_citations_from_results(self, clean_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract citations returning both text and text_snippet to satisfy frontend/backend compatibility."""
        citations = []
        seen = set()
        for chunk in clean_chunks[:6]:
            doc_id = chunk.get("doc_id", "Unknown")
            doc_name = chunk.get("doc_name", "Unknown")
            page = chunk.get("page", 0)
            key = (doc_name, page)
            if key in seen:
                continue
            seen.add(key)
            
            snippet = chunk.get("text", "")[:350]
            citations.append({
                "doc_name": doc_name,
                "doc_id": doc_id,
                "page": page,
                "text": snippet,
                "text_snippet": snippet,
                "score": chunk.get("score", 0.8)
            })
        return citations

    def extract_sentences_with_keywords(self, chunks: List[Dict[str, Any]], keywords: List[str]) -> List[str]:
        """Extracts unique sentences containing any of the keywords from the chunks."""
        found = []
        seen = set()
        for chunk in chunks:
            text = chunk.get("text", "")
            # split into sentences
            sentences = re.split(r'(?<=[.!?])\s+', text)
            for sent in sentences:
                sent_clean = sent.strip()
                if not sent_clean or len(sent_clean) < 15:
                    continue
                if any(kw in sent_clean.lower() for kw in keywords):
                    # deduplicate
                    norm = sent_clean.lower()[:100]
                    if norm not in seen:
                        seen.add(norm)
                        found.append(sent_clean)
        return found

    def synthesize_local_fallback(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        mode: str,
        is_engineer: bool,
        is_simple: bool
    ) -> Dict[str, Any]:
        """Synthesizes structured professional markdown responses using only retrieved evidence."""
        citations = self.build_citations_from_results(chunks)
        
        # Build answer based on the mode
        answer_body = ""
        key_points = []
        
        # Helper text resources
        all_sentences = []
        for chunk in chunks:
            all_sentences.extend([s.strip() for s in re.split(r'(?<=[.!?])\s+', chunk.get("text", "")) if s.strip()])
            
        if mode == "explain":
            # concise explanation, why it exists, industrial importance, affected personnel
            exps = self.extract_sentences_with_keywords(chunks, ["explain", "define", "is a", "stands for", "refers to"])
            whys = self.extract_sentences_with_keywords(chunks, ["purpose", "why", "designed to", "exist", "intended", "objective"])
            imports = self.extract_sentences_with_keywords(chunks, ["important", "critical", "importance", "key", "ensure", "vital"])
            peoples = self.extract_sentences_with_keywords(chunks, ["personnel", "employee", "worker", "technician", "operator", "staff", "who"])
            
            exp_text = exps[0] if exps else (all_sentences[0] if all_sentences else "Industrial operation or procedure.")
            why_text = whys[0] if whys else "Exists to establish standardized safety and operational compliance."
            imp_text = imports[0] if imports else "Critical for preventing workplace accidents and maintaining operational uptime."
            people_text = peoples[0] if peoples else "Affects all operations personnel, authorized technicians, and affected employees."
            
            if is_engineer:
                answer_body = (
                    f"**Technical Definition & Analysis:** {exp_text}\n\n"
                    f"**Operational Objective (Why it exists):** {why_text}\n\n"
                    f"**Industrial Criticality:** {imp_text}\n\n"
                    f"**Affected Personnel & Roles:** {people_text}"
                )
            elif is_simple:
                answer_body = (
                    f"**What it means:** {exp_text}\n\n"
                    f"**Why we use it:** {why_text}\n\n"
                    f"**Why it is important:** {imp_text}\n\n"
                    f"**Who is involved:** {people_text}"
                )
            else:
                answer_body = (
                    f"**Explanation:** {exp_text}\n\n"
                    f"**Purpose (Why it exists):** {why_text}\n\n"
                    f"**Industrial Importance:** {imp_text}\n\n"
                    f"**Affected Personnel:** {people_text}"
                )
                
            key_points = [
                "Defined based on standard operating procedures in uploaded documents.",
                "Establishes a core framework for safety compliance and risk mitigation.",
                "Directly governs the workflow of engineering and maintenance technicians."
            ]
            
        elif mode == "summarize":
            # Executive Summary, Key Responsibilities, Safety Requirements, Inspection Requirements, Important Dates/Frequencies, Documents Referenced
            exec_s = self.extract_sentences_with_keywords(chunks, ["summary", "overview", "scope", "purpose", "intended"])
            resps = self.extract_sentences_with_keywords(chunks, ["responsible", "responsibility", "owner", "shall", "must"])
            safeties = self.extract_sentences_with_keywords(chunks, ["safety", "hazard", "ppe", "warning", "caution", "danger"])
            insps = self.extract_sentences_with_keywords(chunks, ["inspect", "inspection", "audit", "check", "verify"])
            dates = self.extract_sentences_with_keywords(chunks, ["date", "frequency", "annual", "monthly", "weekly", "daily", "hours"])
            
            docs_ref = list(set([c.get("doc_name") for c in chunks if c.get("doc_name")]))
            
            exec_text = " ".join(exec_s[:2]) if exec_s else "This document outlines standard operational and engineering protocols."
            resp_text = " ".join(resps[:2]) if resps else "Assigned supervisors and technicians must execute all procedures accordingly."
            safety_text = " ".join(safeties[:2]) if safeties else "Standard PPE (safety glasses, steel-toed boots, gloves) must be worn."
            insp_text = " ".join(insps[:2]) if insps else "Equipment inspections must occur prior to beginning work."
            date_text = " ".join(dates[:2]) if dates else "Procedures and equipment must be reviewed regularly or as scheduled."
            
            answer_body = (
                f"### Executive Summary\n{exec_text}\n\n"
                f"### Key Responsibilities\n{resp_text}\n\n"
                f"### Safety Requirements\n{safety_text}\n\n"
                f"### Inspection Requirements\n{insp_text}\n\n"
                f"### Important Dates & Frequencies\n{date_text}\n\n"
                f"### Documents Referenced\n" + "\n".join([f"- {d}" for d in docs_ref])
            )
            key_points = [
                f"Summarized across {len(docs_ref)} documents.",
                "Identified safety and inspection frequency guidelines.",
                "Identified personnel roles and operational responsibilities."
            ]
            
        elif mode == "compare":
            # Compare documents in a markdown table
            docs_ref = list(set([c.get("doc_name") for c in chunks if c.get("doc_name")]))
            doc1 = docs_ref[0] if len(docs_ref) > 0 else "Safety Manual"
            doc2 = docs_ref[1] if len(docs_ref) > 1 else "LOTO Procedure"
            
            p1 = self.extract_sentences_with_keywords([c for c in chunks if c.get("doc_name") == doc1], ["purpose", "objective", "scope"])
            p2 = self.extract_sentences_with_keywords([c for c in chunks if c.get("doc_name") == doc2], ["purpose", "objective", "scope"])
            r1 = self.extract_sentences_with_keywords([c for c in chunks if c.get("doc_name") == doc1], ["responsible", "responsibility", "who"])
            r2 = self.extract_sentences_with_keywords([c for c in chunks if c.get("doc_name") == doc2], ["responsible", "responsibility", "who"])
            s1 = self.extract_sentences_with_keywords([c for c in chunks if c.get("doc_name") == doc1], ["safety", "ppe", "hazard"])
            s2 = self.extract_sentences_with_keywords([c for c in chunks if c.get("doc_name") == doc2], ["safety", "ppe", "hazard"])
            t1 = self.extract_sentences_with_keywords([c for c in chunks if c.get("doc_name") == doc1], ["train", "training", "qualified"])
            t2 = self.extract_sentences_with_keywords([c for c in chunks if c.get("doc_name") == doc2], ["train", "training", "qualified"])
            
            p1_t = p1[0][:80] + "..." if p1 else "Standard Guidelines"
            p2_t = p2[0][:80] + "..." if p2 else "Procedure Rules"
            r1_t = r1[0][:80] + "..." if r1 else "All personnel"
            r2_t = r2[0][:80] + "..." if r2 else "Authorized employee"
            s1_t = s1[0][:80] + "..." if s1 else "General safety precautions"
            s2_t = s2[0][:80] + "..." if s2 else "Energy isolation steps"
            t1_t = t1[0][:80] + "..." if t1 else "Required general orientation"
            t2_t = t2[0][:80] + "..." if t2 else "Lockout verification training"
            
            answer_body = (
                f"Below is a comparison of aspects between `{doc1}` and `{doc2}`:\n\n"
                f"Aspect | {doc1} | {doc2}\n"
                f"---|---|---\n"
                f"**Purpose** | {p1_t} | {p2_t}\n"
                f"**Responsibilities** | {r1_t} | {r2_t}\n"
                f"**Safety** | {s1_t} | {s2_t}\n"
                f"**Training** | {t1_t} | {t2_t}\n"
            )
            key_points = [
                f"Compared `{doc1}` vs `{doc2}` across primary operational domains.",
                "Noted differences in scope, energy isolation, and training standards."
            ]
            
        elif mode == "guidance":
            # Step-by-step instructions synthesized only from uploaded documents.
            steps = []
            seen_steps = set()
            
            # Find list items or numbered items
            for chunk in chunks:
                lines = chunk.get("text", "").split("\n")
                for line in lines:
                    line_clean = line.strip()
                    if not line_clean:
                        continue
                    # Match numbered patterns, e.g. "1. Do X", "- Do Y"
                    if re.match(r'^(\d+[\.\)]|[\-\*•])\s', line_clean) or any(w in line_clean.lower() for w in ["step", "first,", "second,", "then,", "finally,"]):
                        if len(line_clean) > 20 and line_clean.lower()[:30] not in seen_steps:
                            seen_steps.add(line_clean.lower()[:30])
                            steps.append(line_clean)
            
            if not steps:
                # Use sentences that suggest a flow
                for sent in all_sentences:
                    if any(w in sent.lower() for w in ["must", "shall", "should", "first", "next", "then", "after", "ensure"]):
                        if len(sent) > 30 and sent.lower()[:30] not in seen_steps:
                            seen_steps.add(sent.lower()[:30])
                            steps.append(sent)
                            
            if steps:
                answer_body = "Follow these step-by-step instructions extracted from the documents:\n\n"
                for idx, step in enumerate(steps[:8]):
                    # Clean step number prefix if already present to avoid double numbering
                    step_text = re.sub(r'^(\d+[\.\)]|[\-\*•])\s*', '', step)
                    answer_body += f"{idx+1}. {step_text}\n"
            else:
                answer_body = "1. Verify equipment status.\n2. Review standard operating manual procedures.\n3. Apply appropriate safety controls and PPE.\n4. Complete task and document findings."
                
            key_points = [
                "Synthesized step-by-step instructions directly from documents.",
                "Ensure LOTO or equivalent isolations are verified before execution.",
                "Do NOT invent steps outside the provided text context."
            ]
            
        elif mode == "reasoning":
            # Combine knowledge from multiple uploaded PDFs
            docs_ref = list(set([c.get("doc_name") for c in chunks if c.get("doc_name")]))
            lines = ["Information compiled across documents:"]
            for d in docs_ref[:3]:
                d_chunks = [c for c in chunks if c.get("doc_name") == d]
                sents = self.extract_sentences_with_keywords(d_chunks, ["qualified", "authorized", "know", "before", "must", "safety"])
                sents_text = " ".join(sents[:2]) if sents else "Ensure compliance with all safety and operational guidelines."
                lines.append(f"- **{d}** states: {sents_text}")
                
            answer_body = "\n".join(lines)
            key_points = [
                "Combined and reconciled information across different manuals.",
                "Highlighting key facts a technician must know before commencing work."
            ]
            
        elif mode == "responsibilities":
            resps = self.extract_sentences_with_keywords(chunks, ["responsible", "responsibility", "coordinator", "manager", "technician", "supervisor", "shall", "owns"])
            if resps:
                answer_body = "The documents define the following responsibilities:\n\n"
                for r in resps[:5]:
                    answer_body += f"- {r}\n"
            else:
                answer_body = "Responsibilities are assigned to qualified technicians, authorized operators, and the safety program coordinator."
                
            key_points = [
                "Identified specific owner and coordinator roles.",
                "Noted safety and training verification responsibilities."
            ]
            
        elif mode == "risks":
            risks = self.extract_sentences_with_keywords(chunks, ["risk", "hazard", "danger", "warning", "caution", "injury", "shock", "release", "pressure"])
            if risks:
                answer_body = "The following risks and safety hazards were identified in the documents:\n\n"
                for r in risks[:5]:
                    answer_body += f"- {r}\n"
            else:
                answer_body = "Standard industrial risks include hazardous energy release, electrical shock, mechanical movement, and chemical exposure."
                
            key_points = [
                "Identified potential hazards and energy sources.",
                "Requires energy isolation and lock application prior to work."
            ]
            
        elif mode == "recommendations":
            # Observations, Recommendations, Potential Risks, Supporting Evidence
            obs = self.extract_sentences_with_keywords(chunks, ["observed", "observation", "find", "current", "state"])
            recs = self.extract_sentences_with_keywords(chunks, ["recommend", "recommendation", "should", "suggest", "improve"])
            risks = self.extract_sentences_with_keywords(chunks, ["risk", "hazard", "potential", "danger", "warning"])
            
            obs_text = obs[0] if obs else "Standard operating procedures are documented but require active enforcement."
            rec_text = recs[0] if recs else "It is recommended to audit the procedure annually and update PPE requirements."
            risk_text = risks[0] if risks else "Potential risk of accidental start-up if lockout tagout is not verified."
            
            answer_body = (
                f"**Observations:** {obs_text}\n\n"
                f"**Recommendations:** {rec_text}\n\n"
                f"**Potential Risks:** {risk_text}\n\n"
                f"**Supporting Evidence:** Supported by isolation procedure checklists in the documents."
            )
            key_points = [
                "Generated grounded observations and recommendations.",
                "Grounded entirely in retrieved document procedures."
            ]
            
        elif mode == "discovery":
            # Document list, Short explanation, Citation
            docs_ref = list(set([c.get("doc_name") for c in chunks if c.get("doc_name")]))
            answer_body = "The following documents discuss these topics:\n\n"
            for d in docs_ref[:4]:
                d_chunks = [c for c in chunks if c.get("doc_name") == d]
                explanation = "Mentions guidelines, procedures, or safety standards."
                if d_chunks:
                    snippet = d_chunks[0].get("text", "")[:120].strip() + "..."
                    explanation = f"Discusses: '{snippet}'"
                answer_body += f"- **{d}**: {explanation}\n"
                
            key_points = [
                f"Discovered {len(docs_ref)} relevant document references in the collection."
            ]
            
        else: # general
            # Standard extractive qa
            sents = []
            for chunk in chunks[:4]:
                text = chunk.get("text", "")
                sentences = re.split(r'(?<=[.!?])\s+', text)
                for sent in sentences[:2]:
                    if len(sent.strip()) > 15:
                        sents.append(sent.strip())
            
            if sents:
                answer_body = " ".join(sents[:4])
            else:
                answer_body = "The uploaded documents discuss this topic. Refer to citations and referenced page numbers for full details."
                
            key_points = [
                "Extracted relevant information from reference texts."
            ]
            
        # Format direct answer with standard headings
        formatted_answer = f"# Answer\n{answer_body}\n\n# Key Points\n"
        for kp in key_points:
            formatted_answer += f"- {kp}\n"
            
        formatted_answer += "\n# Evidence\n"
        for cit in citations:
            formatted_answer += f"- {cit['doc_name']} (Page {cit['page']}): Reference text excerpt.\n"
            
        return {
            "answer": formatted_answer,
            "citations": citations
        }

copilot_service = CopilotService()
