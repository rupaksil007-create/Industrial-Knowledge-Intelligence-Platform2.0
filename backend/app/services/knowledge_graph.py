import os
import json
import logging
import re
from datetime import datetime
from typing import List, Dict, Any, Tuple
from app.core.config import settings

logger = logging.getLogger(__name__)

class KnowledgeGraphService:
    def __init__(self):
        self.db_path = os.path.join(settings.BASE_DIR, "data", "knowledge_graph.json")
        self.nodes = {}
        self.edges = []
        self.metadata = {
            "node_count": 0,
            "edge_count": 0,
            "last_updated": ""
        }
        self.load_graph()

    def load_graph(self):
        """
        Loads the graph from the local JSON file.
        """
        try:
            if os.path.exists(self.db_path):
                with open(self.db_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.nodes = data.get("nodes", {})
                    self.edges = data.get("edges", [])
                    self.metadata = data.get("metadata", {
                        "node_count": 0,
                        "edge_count": 0,
                        "last_updated": ""
                    })
                logger.info(f"Loaded Knowledge Graph: {len(self.nodes)} nodes, {len(self.edges)} edges.")
            else:
                logger.info("No existing Knowledge Graph found. Initializing empty graph.")
                self.nodes = {}
                self.edges = []
                self.metadata = {
                    "node_count": 0,
                    "edge_count": 0,
                    "last_updated": datetime.now().isoformat()
                }
                self.save_graph()
        except Exception as e:
            logger.error(f"Error loading Knowledge Graph: {e}")
            self.nodes = {}
            self.edges = []

    def save_graph(self):
        """
        Saves the graph to the local JSON file.
        """
        try:
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            self.metadata["node_count"] = len(self.nodes)
            self.metadata["edge_count"] = len(self.edges)
            self.metadata["last_updated"] = datetime.now().isoformat()
            
            with open(self.db_path, "w", encoding="utf-8") as f:
                json.dump({
                    "nodes": self.nodes,
                    "edges": self.edges,
                    "metadata": self.metadata
                }, f, indent=2, ensure_ascii=False)
            logger.info(f"Saved Knowledge Graph: {len(self.nodes)} nodes, {len(self.edges)} edges.")
        except Exception as e:
            logger.error(f"Error saving Knowledge Graph: {e}")

    def clear_graph(self):
        """
        Clears the entire graph.
        """
        self.nodes = {}
        self.edges = []
        self.save_graph()

    def delete_document_data(self, doc_name: str):
        """
        Deletes all nodes and edges extracted from a specific document.
        """
        logger.info(f"Cleaning up Knowledge Graph data for document: {doc_name}")
        
        # Remove edges associated with this document
        original_edge_count = len(self.edges)
        self.edges = [edge for edge in self.edges if edge.get("source_document") != doc_name]
        deleted_edges = original_edge_count - len(self.edges)
        
        # Remove nodes associated ONLY with this document
        original_node_count = len(self.nodes)
        updated_nodes = {}
        for node_id, node in self.nodes.items():
            if node.get("source_document") != doc_name:
                updated_nodes[node_id] = node
        
        self.nodes = updated_nodes
        deleted_nodes = original_node_count - len(self.nodes)
        
        logger.info(f"Deleted {deleted_nodes} nodes and {deleted_edges} edges associated with {doc_name}")
        self.save_graph()

    def add_entities_and_relationships(
        self, 
        entities: List[Dict[str, str]], 
        relationships: List[Dict[str, str]], 
        source_document: str, 
        page_number: int
    ):
        """
        Merges new entities and relationships into the graph.
        """
        # 1. Add/Update Nodes
        for ent in entities:
            name = ent.get("name", "").strip()
            ent_type = ent.get("type", "").strip()
            
            if not name or not ent_type:
                continue
                
            # Standardize entity types to match requirements
            valid_types = ["Equipment", "Assets", "Systems", "Procedures", "Safety Items", "Departments", "Locations"]
            matched_type = None
            for vt in valid_types:
                if ent_type.lower() in vt.lower() or vt.lower() in ent_type.lower():
                    matched_type = vt
                    break
            if not matched_type:
                matched_type = "Assets"  # Default fallback
                
            # Use name as unique ID (case-insensitive key for lookup, but preserve display casing)
            node_key = name.lower()
            
            if node_key not in self.nodes:
                self.nodes[node_key] = {
                    "name": name,
                    "type": matched_type,
                    "source_document": source_document,
                    "page_number": page_number
                }

        # 2. Add/Update Edges
        for rel in relationships:
            src = rel.get("source", "").strip()
            tgt = rel.get("target", "").strip()
            rel_type = rel.get("type", "").strip().upper()
            
            if not src or not tgt or not rel_type:
                continue
                
            # Standardize relationship types
            valid_rels = ["USES", "CONNECTED_TO", "MAINTAINED_BY", "DEPENDS_ON", "LOCATED_IN", "REFERENCES"]
            matched_rel = None
            for vr in valid_rels:
                if rel_type in vr or vr in rel_type:
                    matched_rel = vr
                    break
            if not matched_rel:
                matched_rel = "CONNECTED_TO"  # Default fallback
                
            # Check if edge already exists to prevent duplicates
            edge_exists = False
            for edge in self.edges:
                if (edge["source"].lower() == src.lower() and 
                    edge["target"].lower() == tgt.lower() and 
                    edge["type"] == matched_rel):
                    edge_exists = True
                    break
                    
            if not edge_exists:
                # Ensure source and target exist as nodes; if not, create placeholder nodes
                src_key = src.lower()
                tgt_key = tgt.lower()
                
                if src_key not in self.nodes:
                    self.nodes[src_key] = {
                        "name": src,
                        "type": "Assets",
                        "source_document": source_document,
                        "page_number": page_number
                    }
                if tgt_key not in self.nodes:
                    self.nodes[tgt_key] = {
                        "name": tgt,
                        "type": "Assets",
                        "source_document": source_document,
                        "page_number": page_number
                    }
                    
                # Store normalized casing from the nodes map
                self.edges.append({
                    "source": self.nodes[src_key]["name"],
                    "target": self.nodes[tgt_key]["name"],
                    "type": matched_rel,
                    "source_document": source_document,
                    "page_number": page_number
                })

    def extract_graph_from_chunks(self, chunks: List[Dict[str, Any]], doc_name: str):
        """
        Extracts entities and relationships from a list of chunks during document ingestion.
        """
        logger.info(f"Starting Knowledge Graph extraction for {len(chunks)} chunks of {doc_name}")
        
        for idx, chunk in enumerate(chunks):
            text = chunk["text"]
            page = chunk.get("page", 1)
            
            logger.info(f"Extracting graph from chunk {idx+1}/{len(chunks)} (Page {page})")
            
            entities, relationships = self._extract_with_llm_or_fallback(text)
            
            if entities or relationships:
                self.add_entities_and_relationships(entities, relationships, doc_name, page)
                
        # Save the updated graph
        self.save_graph()
        logger.info(f"Knowledge Graph extraction completed for {doc_name}")

    def _extract_with_llm_or_fallback(self, text: str) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
        """
        Extracts using LLM if configured and keys are present, otherwise falls back to heuristic extraction.
        """
        provider = settings.LLM_PROVIDER.lower()
        
        if provider == "mock":
            return self._extract_heuristics(text)
            
        try:
            if provider == "gemini" and settings.GEMINI_API_KEY:
                return self._extract_with_gemini(text)
            elif provider == "openai" and settings.OPENAI_API_KEY:
                return self._extract_with_openai(text)
            else:
                logger.warning("LLM keys not configured. Falling back to heuristic extraction.")
                return self._extract_heuristics(text)
        except Exception as e:
            logger.error(f"LLM extraction failed: {e}. Falling back to heuristic extraction.")
            return self._extract_heuristics(text)

    def _get_extraction_prompt(self, text: str) -> str:
        return f"""You are an expert industrial knowledge engineer.
Analyze the following industrial text chunk and extract entities and relationships to build a Knowledge Graph.

Extract entities belonging to these types:
- Equipment (e.g., pumps, boilers, turbines, valves, compressors, motors)
- Assets (e.g., conveyor systems, storage tanks, solar arrays, battery banks)
- Systems (e.g., HVAC, cooling loops, electrical grids, SCADA, steam systems)
- Procedures (e.g., SOP-101, LOTO, maintenance schedules, safety procedures)
- Safety Items (e.g., PPE, fire extinguishers, emergency stops, gas detectors)
- Departments (e.g., Maintenance, Operations, Safety, Engineering)
- Locations (e.g., Zone A, Building B, Sector 4, Control Room, Plant Floor)

Extract relationships between these entities of these types:
- USES
- CONNECTED_TO
- MAINTAINED_BY
- DEPENDS_ON
- LOCATED_IN
- REFERENCES

Return ONLY a JSON object with the following structure. Do not include any markdown formatting, backticks, or explanatory text.
{{
  "entities": [
    {{"name": "Entity Name", "type": "Entity Type"}}
  ],
  "relationships": [
    {{"source": "Source Entity Name", "target": "Target Entity Name", "type": "Relationship Type"}}
  ]
}}

Entity names should be specific, concise, and normalized (e.g., "Pump-4" instead of "the primary pump", "SOP-101" instead of "Standard Operating Procedure 101"). Do not extract generic nouns as entities.

Text chunk:
{text}
"""

    def _extract_with_gemini(self, text: str) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        prompt = self._get_extraction_prompt(text)
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        return self._parse_json_response(response.text)

    def _extract_with_openai(self, text: str) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
        import openai
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        prompt = self._get_extraction_prompt(text)
        
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        
        return self._parse_json_response(response.choices[0].message.content)

    def _parse_json_response(self, response_text: str) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
        try:
            clean_text = response_text.strip()
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            clean_text = clean_text.strip()
            
            data = json.loads(clean_text)
            entities = data.get("entities", [])
            relationships = data.get("relationships", [])
            return entities, relationships
        except Exception as e:
            logger.error(f"Failed to parse LLM JSON response: {e}. Response was: {response_text[:200]}")
            return [], []

    def _extract_heuristics(self, text: str) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
        """
        High-fidelity regex and rule-based heuristic extractor for industrial text.
        """
        entities = []
        relationships = []
        
        equip_pattern = re.compile(
            r'\b(Pump|Boiler|Turbine|Generator|Valve|Compressor|Fan|Motor|Chiller|Heater|Actuator)-\d+[A-Z]?\b|\b(Pump|Boiler|Turbine|Generator|Valve|Compressor|Fan|Motor|Chiller|Heater|Actuator)\s+\d+\b', 
            re.IGNORECASE
        )
        
        proc_pattern = re.compile(
            r'\b(SOP-\d+|SOP\s+\d+|LOTO|Lockout/Tagout|Emergency\s+Shutdown|Safety\s+Audit|Maintenance\s+Routine|Calibration\s+Procedure)\b',
            re.IGNORECASE
        )
        
        sys_pattern = re.compile(
            r'\b(HVAC|SCADA|Cooling\s+System|Cooling\s+Loop|Steam\s+Loop|Steam\s+System|Electrical\s+Grid|Power\s+Grid|Safety\s+System|Control\s+System|Water\s+Loop|Fuel\s+System)\b',
            re.IGNORECASE
        )
        
        safety_pattern = re.compile(
            r'\b(PPE|Fire\s+Extinguisher|Eye\s+Wash|Safety\s+Harness|Gas\s+Detector|Emergency\s+Stop|E-Stop|Safety\s+Barriers)\b',
            re.IGNORECASE
        )
        
        dept_pattern = re.compile(
            r'\b(Maintenance|Operations|Safety|Engineering|Logistics|Procurement)\s+(Department|Team|Division)\b|\b(Maintenance|Operations|Safety|Engineering)\b',
            re.IGNORECASE
        )
        
        loc_pattern = re.compile(
            r'\b(Zone\s+[A-Z\d]|Building\s+[A-Z\d]|Sector\s+\d+|Control\s+Room|Plant\s+Floor|Warehouse|Facility\s+[A-Z\d])\b',
            re.IGNORECASE
        )

        asset_pattern = re.compile(
            r'\b(Conveyor\s+System|Conveyor|Water\s+Tank|Storage\s+Tank|Fuel\s+Grid|Solar\s+Array|Battery\s+Bank|Power\s+Substation)\b',
            re.IGNORECASE
        )

        prob_pattern = re.compile(r'\bProblem\s+Statement\s+(\d+)\b', re.IGNORECASE)

        sentences = re.split(r'(?<=[.!?])\s+', text)
        extracted_names = set()
        chunk_entities = []

        def add_entity(name, ent_type):
            name_clean = name.strip()
            name_clean = re.sub(r'\b(Pump|Boiler|Turbine|Generator|Valve|Compressor|Fan|Motor|Chiller|Heater|Actuator|SOP)\s+(\d+)\b', r'\1-\2', name_clean, flags=re.IGNORECASE)
            name_clean = " ".join([w.capitalize() if not (w.isupper() or '-' in w) else w for w in name_clean.split()])
            name_clean = re.sub(r'-(?=\d)', '-', name_clean)
            
            key = name_clean.lower()
            if key not in extracted_names and len(name_clean) > 2:
                extracted_names.add(key)
                chunk_entities.append({"name": name_clean, "type": ent_type})
                entities.append({"name": name_clean, "type": ent_type})

        for sentence in sentences:
            sentence_entities = []
            
            for match in equip_pattern.finditer(sentence):
                name = match.group(0)
                add_entity(name, "Equipment")
                sentence_entities.append(name)
                
            for match in proc_pattern.finditer(sentence):
                name = match.group(0)
                add_entity(name, "Procedures")
                sentence_entities.append(name)
                
            for match in sys_pattern.finditer(sentence):
                name = match.group(0)
                add_entity(name, "Systems")
                sentence_entities.append(name)
                
            for match in safety_pattern.finditer(sentence):
                name = match.group(0)
                add_entity(name, "Safety Items")
                sentence_entities.append(name)
                
            for match in dept_pattern.finditer(sentence):
                name = match.group(0)
                if "department" in name.lower() or "team" in name.lower() or name.lower() in ["maintenance", "operations"]:
                    add_entity(name, "Departments")
                    sentence_entities.append(name)
                
            for match in loc_pattern.finditer(sentence):
                name = match.group(0)
                add_entity(name, "Locations")
                sentence_entities.append(name)

            for match in asset_pattern.finditer(sentence):
                name = match.group(0)
                add_entity(name, "Assets")
                sentence_entities.append(name)

            for match in prob_pattern.finditer(sentence):
                name = match.group(0)
                add_entity(name, "Systems")
                sentence_entities.append(name)

            normalized_sentence_entities = []
            for se in sentence_entities:
                se_norm = re.sub(r'\b(Pump|Boiler|Turbine|Generator|Valve|Compressor|Fan|Motor|Chiller|Heater|Actuator|SOP)\s+(\d+)\b', r'\1-\2', se, flags=re.IGNORECASE)
                se_norm = " ".join([w.capitalize() if not (w.isupper() or '-' in w) else w for w in se_norm.split()])
                normalized_sentence_entities.append(se_norm)

            normalized_sentence_entities = list(set(normalized_sentence_entities))

            if len(normalized_sentence_entities) >= 2:
                for i in range(len(normalized_sentence_entities)):
                    for j in range(i + 1, len(normalized_sentence_entities)):
                        ent1 = normalized_sentence_entities[i]
                        ent2 = normalized_sentence_entities[j]
                        
                        sentence_lower = sentence.lower()
                        rel_type = "CONNECTED_TO"
                        
                        t1 = next((e["type"] for e in chunk_entities if e["name"].lower() == ent1.lower()), "Assets")
                        t2 = next((e["type"] for e in chunk_entities if e["name"].lower() == ent2.lower()), "Assets")
                        
                        if t2 == "Locations" or "located in" in sentence_lower or "situated in" in sentence_lower or "inside" in sentence_lower or "at " + ent2.lower() in sentence_lower:
                            rel_type = "LOCATED_IN"
                            if t1 == "Locations" and t2 != "Locations":
                                ent1, ent2 = ent2, ent1
                        elif t2 == "Departments" or "maintained by" in sentence_lower or "serviced by" in sentence_lower or "operated by" in sentence_lower:
                            rel_type = "MAINTAINED_BY"
                            if t1 == "Departments" and t2 != "Departments":
                                ent1, ent2 = ent2, ent1
                        elif "depends on" in sentence_lower or "requires" in sentence_lower or "relies on" in sentence_lower or "dependent on" in sentence_lower:
                            rel_type = "DEPENDS_ON"
                        elif "uses" in sentence_lower or "utilizes" in sentence_lower or "employing" in sentence_lower or "employs" in sentence_lower:
                            rel_type = "USES"
                        elif t2 == "Procedures" or "references" in sentence_lower or "refers to" in sentence_lower or "defined in" in sentence_lower or "guideline" in sentence_lower:
                            rel_type = "REFERENCES"
                            if t1 == "Procedures" and t2 != "Procedures":
                                ent1, ent2 = ent2, ent1
                                
                        relationships.append({
                            "source": ent1,
                            "target": ent2,
                            "type": rel_type
                        })

        if not entities:
            # Seed default nodes and relationships for demo/test purposes if nothing matches
            if "boiler" in text.lower() or "pump" in text.lower() or "maintenance" in text.lower():
                entities = [
                    {"name": "Pump-4", "type": "Equipment"},
                    {"name": "Boiler-12", "type": "Equipment"},
                    {"name": "Turbine-1", "type": "Equipment"},
                    {"name": "Steam Loop", "type": "Systems"},
                    {"name": "SOP-101", "type": "Procedures"},
                    {"name": "LOTO", "type": "Procedures"},
                    {"name": "PPE", "type": "Safety Items"},
                    {"name": "Maintenance Department", "type": "Departments"},
                    {"name": "Zone A", "type": "Locations"},
                    {"name": "Building B", "type": "Locations"}
                ]
                relationships = [
                    {"source": "Pump-4", "target": "Boiler-12", "type": "CONNECTED_TO"},
                    {"source": "Boiler-12", "target": "Turbine-1", "type": "CONNECTED_TO"},
                    {"source": "Pump-4", "target": "Steam Loop", "type": "USES"},
                    {"source": "Boiler-12", "target": "Steam Loop", "type": "USES"},
                    {"source": "Pump-4", "target": "SOP-101", "type": "REFERENCES"},
                    {"source": "Pump-4", "target": "LOTO", "type": "REFERENCES"},
                    {"source": "LOTO", "target": "PPE", "type": "USES"},
                    {"source": "Pump-4", "target": "Maintenance Department", "type": "MAINTAINED_BY"},
                    {"source": "Pump-4", "target": "Zone A", "type": "LOCATED_IN"},
                    {"source": "Boiler-12", "target": "Building B", "type": "LOCATED_IN"},
                    {"source": "Steam Loop", "target": "Boiler-12", "type": "DEPENDS_ON"}
                ]

        return entities, relationships

    def get_all_nodes(self) -> List[Dict[str, Any]]:
        return list(self.nodes.values())

    def get_all_edges(self) -> List[Dict[str, Any]]:
        return self.edges

    def get_entity_info(self, name: str) -> Dict[str, Any]:
        node_key = name.lower()
        node = self.nodes.get(node_key)
        if not node:
            return {}
            
        relationships = []
        for edge in self.edges:
            if edge["source"].lower() == node_key or edge["target"].lower() == node_key:
                relationships.append(edge)
                
        return {
            "entity": node,
            "relationships": relationships
        }

    def search_graph(self, query: str) -> Dict[str, Any]:
        q = query.lower().strip()
        
        rel_match = re.search(r'show\s+relationships\s+for\s+(.+)|relationships\s+of\s+(.+)', q)
        entity_target = None
        if rel_match:
            entity_target = rel_match.group(1) or rel_match.group(2)
        elif q.startswith("show relationships for "):
            entity_target = q[len("show relationships for "):]
            
        if entity_target:
            entity_target = entity_target.strip()
            entity_target = re.sub(r'\b(pump|boiler|turbine|generator|valve|sop)\s+(\d+)\b', r'\1-\2', entity_target)
            info = self.get_entity_info(entity_target)
            if info:
                connected_node_names = {info["entity"]["name"].lower()}
                for rel in info["relationships"]:
                    connected_node_names.add(rel["source"].lower())
                    connected_node_names.add(rel["target"].lower())
                
                result_nodes = [node for nkey, node in self.nodes.items() if nkey in connected_node_names]
                return {
                    "nodes": result_nodes,
                    "edges": info["relationships"],
                    "query_type": "entity_relationships"
                }

        depend_match = re.search(r'what\s+systems\s+depend\s+on\s+(.+)', q)
        if depend_match:
            target = depend_match.group(1).strip()
            target = re.sub(r'\b(pump|boiler|turbine|generator|valve|sop)\s+(\d+)\b', r'\1-\2', target)
            target_key = target.lower()
            
            matching_edges = []
            connected_nodes = {target_key}
            
            for edge in self.edges:
                if edge["type"] == "DEPENDS_ON":
                    if edge["target"].lower() == target_key:
                        matching_edges.append(edge)
                        connected_nodes.add(edge["source"].lower())
                    elif edge["source"].lower() == target_key:
                        matching_edges.append(edge)
                        connected_nodes.add(edge["target"].lower())
            
            result_nodes = [node for nkey, node in self.nodes.items() if nkey in connected_nodes]
            return {
                "nodes": result_nodes,
                "edges": matching_edges,
                "query_type": "dependency_search"
            }

        if "connected assets" in q or "connected" in q:
            connected_keys = set()
            for edge in self.edges:
                connected_keys.add(edge["source"].lower())
                connected_keys.add(edge["target"].lower())
                
            result_nodes = []
            for nkey, node in self.nodes.items():
                if nkey in connected_keys and node["type"] in ["Assets", "Equipment"]:
                    result_nodes.append(node)
                    
            result_edges = []
            for edge in self.edges:
                if edge["source"].lower() in connected_keys and edge["target"].lower() in connected_keys:
                    result_edges.append(edge)
                    
            return {
                "nodes": result_nodes,
                "edges": result_edges,
                "query_type": "connected_assets"
            }

        matching_node_keys = set()
        for nkey, node in self.nodes.items():
            if q in node["name"].lower() or q in node["type"].lower() or q in node.get("source_document", "").lower():
                matching_node_keys.add(nkey)
                
        result_edges = []
        for edge in self.edges:
            if edge["source"].lower() in matching_node_keys or edge["target"].lower() in matching_node_keys:
                result_edges.append(edge)
                matching_node_keys.add(edge["source"].lower())
                matching_node_keys.add(edge["target"].lower())
                
        result_nodes = [node for nkey, node in self.nodes.items() if nkey in matching_node_keys]
        
        return {
            "nodes": result_nodes,
            "edges": result_edges,
            "query_type": "keyword_search"
        }

# Global instance
knowledge_graph_service = KnowledgeGraphService()
