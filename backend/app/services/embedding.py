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
            logger.info("Initializing Gemini Embedding provider...")
            if self.gemini_key:
                masked_key = self.gemini_key[:4] + "..." + self.gemini_key[-4:] if len(self.gemini_key) > 8 else "PRESENT"
                logger.info(f"Gemini API key is present: {masked_key}")
                try:
                    import google.generativeai as genai
                    logger.info("Successfully imported google.generativeai SDK")
                    genai.configure(api_key=self.gemini_key)
                    self.model_name = "models/embedding-001"
                    logger.info(f"Gemini Embedding model '{self.model_name}' configured successfully.")
                except ImportError:
                    logger.error("google-generativeai package not found. Falling back to local default.")
                    self.provider = "chroma"
                except Exception as e:
                    logger.error(f"Failed to initialize Gemini Embedding provider: {type(e).__name__}: {e}", exc_info=True)
                    logger.warning("Falling back to local default due to initialization error.")
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
        # Determine the target dimension based on the original configured provider to prevent ChromaDB dimension mismatch
        target_provider = settings.EMBEDDING_PROVIDER.lower()
        if target_provider == "openai":
            target_dim = 1536
        elif target_provider == "gemini":
            target_dim = 768
        else:
            target_dim = 384

        if self.provider == "openai" and self.client:
            try:
                response = self.client.embeddings.create(
                    input=input,
                    model=settings.OPENAI_EMBEDDING_MODEL
                )
                return [emb.embedding for emb in response.data]
            except Exception as e:
                logger.error(f"OpenAI embedding failed: {e}. Falling back to deterministic mock of dimension {target_dim}...")
                
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
                logger.error(f"Gemini embedding failed: {type(e).__name__}: {e}", exc_info=True)
                logger.info(f"Falling back to deterministic mock of dimension {target_dim}...")

        # If the original provider is chroma/local default, we can use the ONNX default_ef (384 dimensions)
        if target_provider == "chroma" and self.default_ef:
            try:
                return self.default_ef(input)
            except Exception as e:
                logger.error(f"Local Chroma default embedding failed: {e}. Falling back to deterministic mock of dimension 384.")

        # Fallback: Deterministic Mock Embedding Function (Offline/Test mode)
        # Generates a vector of target_dim based on the text hash so it's consistent for identical texts
        logger.warning(f"Generating offline mock embeddings of dimension {target_dim} for text input.")
        embeddings = []
        for text in input:
            # Seed generator with text hash to ensure determinism
            text_hash = abs(hash(text)) % (2**32)
            state = np.random.RandomState(text_hash)
            # Create a target_dim-dimensional unit vector
            vec = state.randn(target_dim)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            embeddings.append(vec.tolist())
        return embeddings

# Global instance
embedding_service = IndustrialEmbeddingFunction()
