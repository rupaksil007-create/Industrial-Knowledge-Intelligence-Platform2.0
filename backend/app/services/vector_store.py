import logging
import os
import re
import math
import datetime
from collections import Counter
from chromadb import PersistentClient
from app.core.config import settings
from app.services.embedding import embedding_service

logger = logging.getLogger(__name__)

class BM25:
    """
    In-memory BM25 Search Implementation for Hybrid Search Reranking.
    """
    def __init__(self, documents: list[str], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.doc_len = []
        self.avg_doc_len = 0.0
        self.doc_freqs = Counter()
        self.idf = {}
        self.term_freqs = []
        self.N = len(documents)
        
        # Tokenize documents
        for doc in documents:
            tokens = self._tokenize(doc)
            self.doc_len.append(len(tokens))
            self.term_freqs.append(Counter(tokens))
            self.doc_freqs.update(set(tokens))
            
        self.avg_doc_len = sum(self.doc_len) / max(self.N, 1)
        
        # Calculate IDF (BM25 formula)
        for term, freq in self.doc_freqs.items():
            self.idf[term] = math.log((self.N - freq + 0.5) / (freq + 0.5) + 1.0)
            
    def _tokenize(self, text: str) -> list[str]:
        # Return lowercased alphanumeric words
        return re.findall(r'\b\w+\b', text.lower())
        
    def get_score(self, query_tokens: list[str], index: int) -> float:
        score = 0.0
        doc_len = self.doc_len[index]
        tf_map = self.term_freqs[index]
        
        for token in query_tokens:
            if token not in self.idf:
                continue
            tf = tf_map[token]
            idf = self.idf[token]
            
            # BM25 weight
            numerator = tf * (self.k1 + 1)
            denominator = tf + self.k1 * (1 - self.b + self.b * (doc_len / self.avg_doc_len))
            score += idf * (numerator / denominator)
        return score

class VectorStore:
    def __init__(self):
        logger.info(f"Initializing ChromaDB PersistentClient at {settings.CHROMA_PERSIST_DIR}")
        self.client = PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        self.collection_name = "industrial_knowledge"
        
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=embedding_service,
            metadata={"hnsw:space": "cosine"}
        )
        logger.info(f"ChromaDB Collection '{self.collection_name}' ready.")

    def chunk_document_pages(self, pages_data: list[dict], chunk_size: int = 1000, chunk_overlap: int = 200) -> list[dict]:
        """
        Splits text from pages into chunks.
        Preserves headings and section titles by grouping text blocks and
        injecting heading context into each generated chunk.
        """
        chunks = []
        
        # Common structural headings pattern (e.g. "Section 2.1", "Problem Statement 8", "1.0 INTRODUCTION")
        heading_pattern = re.compile(
            r'^((?:Section|SOP|Chapter|Problem Statement|Part|Heading)\s+\d+|^\d+(\.\d+)*)\b.*$', 
            re.IGNORECASE
        )
        
        current_heading = "General Overview"
        
        for page_obj in pages_data:
            page_num = page_obj["page"]
            text = page_obj["text"] or ""
            
            lines = text.split("\n")
            page_sections = []
            current_section_lines = []
            
            for line in lines:
                stripped = line.strip()
                if not stripped:
                    continue
                
                # Check if the line constitutes a heading
                is_heading = False
                if heading_pattern.match(stripped) or (stripped.isupper() and len(stripped) < 85 and not stripped.endswith(".")):
                    is_heading = True
                
                if is_heading:
                    if current_section_lines:
                        section_text = " ".join(current_section_lines)
                        page_sections.append((current_heading, section_text))
                        current_section_lines = []
                    current_heading = stripped
                else:
                    current_section_lines.append(stripped)
            
            # Append remaining content on the page
            if current_section_lines:
                section_text = " ".join(current_section_lines)
                page_sections.append((current_heading, section_text))
                
            # Chunk the section texts preserving headings & overlap
            for heading, section_text in page_sections:
                if not section_text:
                    continue
                
                start = 0
                while start < len(section_text):
                    end = start + chunk_size
                    if end < len(section_text):
                        # Try to split cleanly at a space
                        last_space = section_text.rfind(" ", end - 100, end)
                        if last_space != -1:
                            end = last_space
                            
                    chunk_body = section_text[start:end].strip()
                    if chunk_body:
                        # Prepend section heading context
                        full_chunk_text = f"[Section: {heading}]\n{chunk_body}"
                        chunks.append({
                            "text": full_chunk_text,
                            "heading": heading,
                            "page": page_num
                        })
                    
                    start = end - chunk_overlap
                    if start >= len(section_text) or chunk_size <= chunk_overlap:
                        break
                        
        return chunks

    def add_document(self, doc_id: str, doc_name: str, pages_data: list[dict], upload_date: str = None, doc_type: str = None) -> bool:
        """
        Chunks and indexes a document in ChromaDB, including metadata.
        """
        try:
            if not upload_date:
                upload_date = datetime.date.today().isoformat()
            if not doc_type:
                doc_type = doc_name.split('.')[-1].lower() if '.' in doc_name else 'pdf'
                
            chunks = self.chunk_document_pages(
                pages_data, 
                settings.CHUNK_SIZE, 
                settings.CHUNK_OVERLAP
            )
            
            if not chunks:
                logger.warning(f"No text extracted or chunked for document: {doc_name}")
                return False
                
            logger.info(f"Adding {len(chunks)} chunks to ChromaDB for document {doc_name} (date: {upload_date}, type: {doc_type})")
            
            documents = []
            ids = []
            metadatas = []
            
            for idx, chunk in enumerate(chunks):
                chunk_id = f"{doc_id}_chunk_{idx}"
                documents.append(chunk["text"])
                ids.append(chunk_id)
                metadatas.append({
                    "doc_id": doc_id,
                    "doc_name": doc_name,
                    "page": chunk["page"],
                    "chunk_index": idx,
                    "upload_date": upload_date,
                    "doc_type": doc_type,
                    "heading": chunk["heading"]
                })
                
            # Add to collection
            self.collection.add(
                documents=documents,
                ids=ids,
                metadatas=metadatas
            )
            logger.info(f"Successfully indexed document: {doc_name} with doc_id: {doc_id}")
            return True
        except Exception as e:
            logger.error(f"Error adding document to vector store: {e}")
            return False

    def expand_query(self, query: str) -> str:
        """
        Expands the user query to include relevant synonym and domain terms.
        """
        q_lower = query.lower()
        expansions = []
        
        # Rule-based expansions for problem statements & hackathon terms
        mappings = {
            "problem statement 8": "AI for Industrial Knowledge Intelligence Unified Asset Operations Brain",
            "problem statement 8 about": "AI for Industrial Knowledge Intelligence Unified Asset Operations Brain",
            "et ai hackathon": "Emerging Technology AI Hackathon Challenge Guidelines",
            "sop": "Standard Operating Procedure guidelines manual",
            "kpi": "Key Performance Indicator operational metrics"
        }
        
        for keyword, expansion in mappings.items():
            if keyword in q_lower:
                expansions.append(expansion)
                
        # Task 3: Detect references to target terms
        target_terms = ["judging criteria", "weightages", "evaluation focus", "scoring", "hackathon"]
        if any(term in q_lower for term in target_terms):
            expansions.append("ET AI Hackathon 2026 Problem Statements Emerging Technology Challenge Guidelines Judging Criteria Weight Weightages Evaluation Focus Scoring")
            
        if expansions:
            expanded_query = query + " " + " ".join(expansions)
            logger.info(f"Expanded query: '{query}' -> '{expanded_query}'")
            return expanded_query
        return query

    def search(self, query: str, n_results: int = 5, metadata_filter: dict = None, debug: bool = False) -> list[dict]:
        """
        Performs hybrid search (Semantic Vector + BM25 keyword matching) 
        and fuses results using Reciprocal Rank Fusion (RRF).
        Applies document prioritization boosts and metadata filters.
        """
        try:
            # 1. Expand query
            expanded_query = self.expand_query(query)
            
            # 2. Build ChromaDB where clause from metadata filters
            where_clause = {}
            if metadata_filter:
                filter_items = []
                for k, v in metadata_filter.items():
                    target_key = "doc_name" if k == "document_name" else k
                    if v:
                        filter_items.append({target_key: v})
                        
                if len(filter_items) == 1:
                    where_clause = filter_items[0]
                elif len(filter_items) > 1:
                    where_clause = {"$and": filter_items}

            # 3. Retrieve ALL matching chunks from the collection to build the BM25 corpus
            all_chunks = self.collection.get(
                where=where_clause if where_clause else None,
                include=["documents", "metadatas"]
            )
            
            if not all_chunks or not all_chunks["ids"]:
                logger.warning("No documents match the specified metadata filters in the collection.")
                return []
                
            total_documents = len(all_chunks["ids"])
            logger.info(f"Retrieved {total_documents} chunks for hybrid search corpus.")
            
            # 4. Initialize and fit BM25 on the corpus
            bm25 = BM25(all_chunks["documents"])
            query_tokens = re.findall(r'\b\w+\b', expanded_query.lower())
            
            # Calculate BM25 scores
            bm25_scores = {}
            bm25_ranked = []
            for idx, cid in enumerate(all_chunks["ids"]):
                score = bm25.get_score(query_tokens, idx)
                bm25_scores[cid] = score
                if score > 0:
                    bm25_ranked.append((cid, score))
            
            # Sort BM25 rankings
            bm25_ranked.sort(key=lambda x: x[1], reverse=True)
            bm25_ranked_ids = [item[0] for item in bm25_ranked]

            # 5. Run Semantic Vector search via ChromaDB
            semantic_results = self.collection.query(
                query_texts=[expanded_query],
                n_results=min(total_documents, 50),
                where=where_clause if where_clause else None
            )
            
            semantic_ranked_ids = []
            semantic_details = {}
            
            if semantic_results and semantic_results["ids"] and len(semantic_results["ids"][0]) > 0:
                s_ids = semantic_results["ids"][0]
                s_docs = semantic_results["documents"][0]
                s_metas = semantic_results["metadatas"][0]
                s_dists = semantic_results["distances"][0] if "distances" in semantic_results and semantic_results["distances"] else None
                
                semantic_ranked_ids = s_ids
                for idx in range(len(s_ids)):
                    cid = s_ids[idx]
                    dist = s_dists[idx] if s_dists else 0.0
                    semantic_details[cid] = {
                        "text": s_docs[idx],
                        "metadata": s_metas[idx],
                        "score": 1.0 - dist # Cosine similarity score
                    }

            # 6. Reciprocal Rank Fusion (RRF)
            k_rrf = 60
            rrf_scores = {}
            all_candidate_ids = set(semantic_ranked_ids).union(set(bm25_ranked_ids))
            
            all_chunks_lookup = {}
            for idx, cid in enumerate(all_chunks["ids"]):
                all_chunks_lookup[cid] = {
                    "text": all_chunks["documents"][idx],
                    "metadata": all_chunks["metadatas"][idx]
                }
                
            for cid in all_candidate_ids:
                semantic_rank = semantic_ranked_ids.index(cid) + 1 if cid in semantic_ranked_ids else None
                bm25_rank = bm25_ranked_ids.index(cid) + 1 if cid in bm25_ranked_ids else None
                
                semantic_term = 1.0 / (k_rrf + semantic_rank) if semantic_rank is not None else 0.0
                bm25_term = 1.0 / (k_rrf + bm25_rank) if bm25_rank is not None else 0.0
                
                rrf_score = semantic_term + bm25_term
                
                rrf_scores[cid] = {
                    "rrf_score": rrf_score,
                    "semantic_rank": semantic_rank,
                    "semantic_score": semantic_details[cid]["score"] if cid in semantic_details else 0.0,
                    "bm25_rank": bm25_rank,
                    "bm25_score": bm25_scores.get(cid, 0.0)
                }

            # Helper function to extract headings from text dynamically
            def extract_headings_from_text(text: str) -> list[str]:
                lines = text.split("\n")
                headings = []
                heading_pattern = re.compile(
                    r'^((?:Section|SOP|Chapter|Problem Statement|Part|Heading)\s+\d+|^\d+(\.\d+)*)\b.*$', 
                    re.IGNORECASE
                )
                for line in lines:
                    stripped = line.strip()
                    if not stripped:
                        continue
                    is_heading = False
                    if heading_pattern.match(stripped):
                        is_heading = True
                    elif stripped.isupper() and 3 <= len(stripped) < 60 and not stripped.endswith("."):
                        is_heading = True
                    if is_heading:
                        headings.append(stripped)
                return headings

            # 7. Document Prioritization & Feature Boosts
            intermediate_candidates = []
            for cid, info in rrf_scores.items():
                meta = None
                if cid in semantic_details:
                    meta = semantic_details[cid]["metadata"]
                    info["text"] = semantic_details[cid]["text"]
                elif cid in all_chunks_lookup:
                    meta = all_chunks_lookup[cid]["metadata"]
                    info["text"] = all_chunks_lookup[cid]["text"]
                    
                info["metadata"] = meta
                doc_name = meta.get("doc_name", "") if meta else ""
                
                boost_reasons = []
                doc_name_boost = 1.0
                
                # Document name intersection boost (using expanded query)
                if doc_name:
                    clean_doc_name = re.sub(r'[\_\-\.]', ' ', doc_name.lower())
                    query_words = set(re.findall(r'\b\w+\b', expanded_query.lower()))
                    doc_words = set(re.findall(r'\b\w+\b', clean_doc_name))
                    doc_words.discard("pdf")
                    doc_words = {w for w in doc_words if len(w) > 2}
                    
                    intersection = query_words.intersection(doc_words)
                    if intersection:
                        doc_name_boost = 2.0 + (0.2 * len(intersection))
                        boost_reasons.append(f"Doc name matched terms: {list(intersection)}")
                
                # Task 4: Chunk content boost
                chunk_text = info["text"]
                chunk_text_upper = chunk_text.upper()
                chunk_content_boost = 1.0
                matched_terms = []
                for term in ["JUDGING CRITERIA", "EVALUATION FOCUS", "WEIGHT", "CRITERIA"]:
                    if term in chunk_text_upper:
                        matched_terms.append(term)
                        if term in ["JUDGING CRITERIA", "EVALUATION FOCUS"]:
                            chunk_content_boost *= 3.0
                        elif term in ["WEIGHT", "CRITERIA"]:
                            chunk_content_boost *= 1.5
                if matched_terms:
                    boost_reasons.append(f"Chunk contains key terms: {matched_terms}")
                
                # Task 5: Section-title-aware retrieval weighting
                meta_heading = meta.get("heading", "") if meta else ""
                headings = extract_headings_from_text(chunk_text)
                if meta_heading and meta_heading not in headings:
                    headings.append(meta_heading)
                
                heading_boost = 1.0
                heading_match_reasons = []
                for heading in headings:
                    heading_lower = heading.lower()
                    query_words_clean = set(re.findall(r'\b\w+\b', query.lower()))
                    heading_words = set(re.findall(r'\b\w+\b', heading_lower))
                    heading_words = {w for w in heading_words if len(w) > 2}
                    heading_intersection = query_words_clean.intersection(heading_words)
                    if heading_intersection:
                        heading_boost *= 1.0 + (0.2 * len(heading_intersection))
                        heading_match_reasons.append(f"'{heading}' matched {list(heading_intersection)}")
                        
                if heading_match_reasons:
                    boost_reasons.append(f"Section titles matched: {heading_match_reasons}")
                
                # Combine boosts for intermediate score
                boost_factor = doc_name_boost * chunk_content_boost * heading_boost
                
                info["doc_name_boost"] = doc_name_boost
                info["chunk_content_boost"] = chunk_content_boost
                info["heading_boost"] = heading_boost
                info["boost_factor"] = boost_factor
                info["intermediate_score"] = info["rrf_score"] * boost_factor
                info["boost_reasons"] = boost_reasons
                intermediate_candidates.append((cid, info))

            # Task 6: Multi-chunk document boost
            intermediate_candidates.sort(key=lambda x: x[1]["intermediate_score"], reverse=True)
            
            # Count chunks per document in top 15 candidates
            top_n_for_doc_counting = 15
            doc_counts = Counter()
            for cid, info in intermediate_candidates[:top_n_for_doc_counting]:
                doc_id = info["metadata"].get("doc_id", "") if info["metadata"] else ""
                if doc_id:
                    doc_counts[doc_id] += 1
            
            boosted_rrf = []
            for cid, info in intermediate_candidates:
                doc_id = info["metadata"].get("doc_id", "") if info["metadata"] else ""
                doc_boost = 1.0
                if doc_id and doc_counts[doc_id] > 1:
                    count = doc_counts[doc_id]
                    doc_boost = 1.0 + (0.15 * (count - 1))
                    info["boost_reasons"].append(f"Multi-chunk doc boost ({count} chunks)")
                    
                info["doc_boost"] = doc_boost
                info["final_score"] = info["intermediate_score"] * doc_boost
                boosted_rrf.append((cid, info))

            # 8. Sort and take top n_results
            boosted_rrf.sort(key=lambda x: x[1]["final_score"], reverse=True)
            top_matches = boosted_rrf[:n_results]
            
            # 9. Format response including scores and explanation logs
            formatted_results = []
            rrf_max_theoretical = 2.0 / 61.0
            
            for cid, info in top_matches:
                meta = info["metadata"]
                
                # Normalise final score to user-friendly range (0.5 to 1.0)
                clamped_score = min(info["final_score"], rrf_max_theoretical)
                display_score = 0.5 + 0.5 * (clamped_score / rrf_max_theoretical)
                
                # Build detailed explanation
                exp_parts = [
                    f"Vector Score: {info['semantic_score']:.3f}.",
                    f"BM25 Score: {info['bm25_score']:.3f}.",
                    f"RRF Score: {info['rrf_score']:.5f}.",
                    f"Document Boost: {(info['doc_name_boost'] * info['doc_boost']):.2f}x.",
                    f"Final Score: {info['final_score']:.5f}."
                ]
                if info["boost_reasons"]:
                    exp_parts.append(f"Reasons: {'; '.join(info['boost_reasons'])}.")
                    
                explanation = " ".join(exp_parts)
                
                # Add diagnostics for task 7
                formatted_results.append({
                    "id": cid,
                    "text": info["text"],
                    "doc_name": meta.get("doc_name", "Unknown"),
                    "doc_id": meta.get("doc_id", "Unknown"),
                    "page": meta.get("page", 0),
                    "score": display_score, # Return percentage-ready normalized score
                    "raw_score": info["final_score"],
                    "semantic_score": info["semantic_score"],
                    "bm25_score": info["bm25_score"],
                    "vector_score": info["semantic_score"],
                    "rrf_score": info["rrf_score"],
                    "document_boost": info["doc_name_boost"] * info["doc_boost"],
                    "final_score": info["final_score"],
                    "explanation": explanation
                })
                
            return formatted_results
        except Exception as e:
            logger.error(f"Hybrid retrieval search failed: {e}")
            return []

    def list_documents(self) -> list[dict]:
        """
        Aggregates and lists unique documents stored in ChromaDB.
        """
        try:
            results = self.collection.get(include=["metadatas"])
            metadatas = results.get("metadatas", [])
            
            if not metadatas:
                return []
                
            docs_dict = {}
            for meta in metadatas:
                doc_id = meta.get("doc_id")
                if not doc_id:
                    continue
                    
                doc_name = meta.get("doc_name", "Unknown")
                page = meta.get("page", 1)
                upload_date = meta.get("upload_date", "Unknown")
                doc_type = meta.get("doc_type", "pdf")
                
                if doc_id not in docs_dict:
                    docs_dict[doc_id] = {
                        "id": doc_id,
                        "name": doc_name,
                        "total_chunks": 0,
                        "pages": set(),
                        "upload_date": upload_date,
                        "doc_type": doc_type
                    }
                    
                docs_dict[doc_id]["total_chunks"] += 1
                docs_dict[doc_id]["pages"].add(page)
                
            formatted_docs = []
            for doc_id, data in docs_dict.items():
                file_path = os.path.join(settings.UPLOAD_DIR, data["name"])
                size_bytes = os.path.getsize(file_path) if os.path.exists(file_path) else 0
                
                formatted_docs.append({
                    "id": doc_id,
                    "name": data["name"],
                    "total_chunks": data["total_chunks"],
                    "total_pages": len(data["pages"]),
                    "size_bytes": size_bytes,
                    "upload_date": data["upload_date"],
                    "doc_type": data["doc_type"]
                })
                
            return formatted_docs
        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            return []

    def delete_document(self, doc_id: str) -> bool:
        """
        Deletes a document from ChromaDB and removes its source file.
        """
        try:
            results = self.collection.get(
                where={"doc_id": doc_id},
                include=["metadatas"],
                limit=1
            )
            
            metadatas = results.get("metadatas", [])
            doc_name = None
            if metadatas:
                doc_name = metadatas[0].get("doc_name")
                
            self.collection.delete(where={"doc_id": doc_id})
            logger.info(f"Deleted vector index for doc_id: {doc_id}")
            
            if doc_name:
                file_path = os.path.join(settings.UPLOAD_DIR, doc_name)
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.info(f"Deleted source file: {file_path}")
                    
            return True
        except Exception as e:
            logger.error(f"Failed to delete document {doc_id}: {e}")
            return False

# Global instance
vector_store = VectorStore()
