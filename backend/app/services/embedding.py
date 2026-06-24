import logging
import numpy as np
from chromadb.api.types import Documents, Embeddings, EmbeddingFunction
from app.core.config import settings

logger = logging.getLogger(__name__)

class IndustrialEmbeddingFunction(EmbeddingFunction):
    def __init__(self):
        self.provider = settings.EMBEDDING_PROVIDER.lower()
        self.openai_key = settings.OPENAI_API_KEY
        self.gemini_key = settings.GEMINI_API_KEY
        self.default_ef = None
        self.client = None
        
        logger.info(f"Initializing embedding service with provider: {self.provider}")
        
        # Initialize selected provider
        if self.provider == "openai":
            if self.openai_key:
                try:
                    import openai
                    self.client = openai.OpenAI(api_key=self.openai_key)
                    logger.info("OpenAI Embedding client configured successfully.")
                except ImportError:
                    logger.error("openai package not found. Falling back to local default.")
                    self.provider = "chroma"
            else:
                logger.warning("OpenAI API key not set. Falling back to local default.")
                self.provider = "chroma"
                
        if self.provider == "gemini":
            if self.gemini_key:
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=self.gemini_key)
                    self.model_name = "models/embedding-001"
                    logger.info("Gemini Embedding configured successfully.")
                except ImportError:
                    logger.error("google-generativeai package not found. Falling back to local default.")
                    self.provider = "chroma"
            else:
                logger.warning("Gemini API key not set. Falling back to local default.")
                self.provider = "chroma"
                
        if self.provider == "chroma" or not self.provider:
            try:
                from chromadb.utils import embedding_functions
                self.default_ef = embedding_functions.DefaultEmbeddingFunction()
                logger.info("Chroma local default embedding function initialized (all-MiniLM-L6-v2 ONNX).")
            except Exception as e:
                logger.error(f"Failed to initialize Chroma default embedding: {e}. Will use deterministic mock embeddings.")

    def __call__(self, input: Documents) -> Embeddings:
        if self.provider == "openai" and self.client:
            try:
                response = self.client.embeddings.create(
                    input=input,
                    model=settings.OPENAI_EMBEDDING_MODEL
                )
                return [emb.embedding for emb in response.data]
            except Exception as e:
                logger.error(f"OpenAI embedding failed: {e}. Falling back...")
                
        elif self.provider == "gemini" and self.gemini_key:
            try:
                import google.generativeai as genai
                embeddings = []
                for text in input:
                    result = genai.embed_content(
                        model=self.model_name,
                        content=text,
                        task_type="retrieval_document"
                    )
                    embeddings.append(result['embedding'])
                return embeddings
            except Exception as e:
                logger.error(f"Gemini embedding failed: {e}. Falling back...")

        # Fallback 1: Local ONNX embedding function (Chroma Default)
        if self.default_ef:
            try:
                return self.default_ef(input)
            except Exception as e:
                logger.error(f"Local Chroma default embedding failed: {e}. Falling back to deterministic mock.")

        # Fallback 2: Deterministic Mock Embedding Function (Offline/Test mode)
        # Generates a 384-dimensional vector based on the text hash so it's consistent for identical texts
        logger.warning("Generating offline mock embeddings for text input.")
        embeddings = []
        for text in input:
            # Seed generator with text hash to ensure determinism
            text_hash = abs(hash(text)) % (2**32)
            state = np.random.RandomState(text_hash)
            # Create a 384-dimensional unit vector
            vec = state.randn(384)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            embeddings.append(vec.tolist())
        return embeddings

# Global instance
embedding_service = IndustrialEmbeddingFunction()
