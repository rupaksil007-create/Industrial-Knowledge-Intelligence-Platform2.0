import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Industrial Knowledge Intelligence Platform"
    API_V1_STR: str = "/api/v1"
    
    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    CHROMA_PERSIST_DIR: str = str(BASE_DIR / "data" / "chroma_db")
    UPLOAD_DIR: str = str(BASE_DIR / "data" / "uploaded_documents")
    
    # RAG Settings
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    
    # Providers: "chroma" (local built-in), "openai", "gemini"
    EMBEDDING_PROVIDER: str = "chroma"
    # Providers: "mock" (local simple generator), "openai", "gemini"
    LLM_PROVIDER: str = "gemini"
    
    # API Keys
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    
    # Models
    OPENAI_MODEL: str = "gpt-4o-mini"
    GEMINI_MODEL: str = "gemini-3.5-flash"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Ensure directories exist
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
