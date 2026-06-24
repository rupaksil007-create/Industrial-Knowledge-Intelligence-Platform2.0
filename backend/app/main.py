import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.api.endpoints import router as api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Industrial Knowledge Intelligence Platform (IKIP)",
    version="1.0.0"
)

# Custom handler to return clean validation error messages
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    errors = exc.errors()
    error_messages = []
    for err in errors:
        msg = err.get("msg", "")
        # Remove the "Value error, " prefix if Pydantic added it
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, "):]
        
        loc = err.get("loc", [])
        if loc and len(loc) > 1:
            field = loc[1]
            error_messages.append(f"'{field}': {msg}")
        else:
            error_messages.append(msg)
            
    detail_msg = "; ".join(error_messages) if error_messages else "Validation error"
    return JSONResponse(
        status_code=422,
        content={"detail": detail_msg}
    )

# CORS configuration
# Allowing localhost frontend setups
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes directly at root to match specified requirements:
# /upload, /query, /documents, /document/{id}
app.include_router(api_router)

@app.get("/health")
def health_check():
    """
    Health check endpoint for checking backend availability.
    """
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "embedding_provider": settings.EMBEDDING_PROVIDER,
        "llm_provider": settings.LLM_PROVIDER
    }

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)