import logging
import os
from pathlib import Path
from pypdf import PdfReader

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check if OCR dependencies are available
OCR_AVAILABLE = False
try:
    from pdf2image import convert_from_path
    import pytesseract
    # Test if tesseract is in PATH or configured
    # We won't block imports, but will catch exceptions during runtime
    OCR_AVAILABLE = True
except ImportError:
    logger.warning("OCR dependencies (pytesseract or pdf2image) are not installed. Scanned PDFs will not be OCR-ed.")

def extract_text_from_pdf(file_path: str) -> list[dict]:
    """
    Extracts text from a PDF file, page by page.
    Falls back to OCR if text is not extractable (e.g. scanned PDFs).
    Returns a list of dicts: [{"page": 1, "text": "..."}]
    """
    file_path_obj = Path(file_path)
    if not file_path_obj.exists():
        raise FileNotFoundError(f"PDF file not found at: {file_path}")
        
    pages_data = []
    
    try:
        # Try normal extraction with pypdf first
        reader = PdfReader(file_path)
        num_pages = len(reader.pages)
        logger.info(f"Attempting standard text extraction for {file_path_obj.name} ({num_pages} pages)")
        
        needs_ocr = False
        total_extracted_chars = 0
        
        for idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            text = text.strip()
            total_extracted_chars += len(text)
            pages_data.append({
                "page": idx + 1,
                "text": text,
                "method": "standard"
            })
            
        # If the average text per page is extremely low (e.g., < 100 chars), we likely need OCR
        avg_chars = total_extracted_chars / num_pages if num_pages > 0 else 0
        if avg_chars < 50:
            logger.info(f"Average extracted characters per page is very low ({avg_chars:.1f} chars). File might be scanned. Attempting OCR...")
            needs_ocr = True
            
        if needs_ocr and OCR_AVAILABLE:
            pages_data = _extract_text_via_ocr(file_path, num_pages)
        elif needs_ocr and not OCR_AVAILABLE:
            logger.warning("Scanned PDF detected but OCR dependencies are not available. Returning best-effort empty text.")
            
    except Exception as e:
        logger.error(f"Error extracting text from PDF {file_path_obj.name}: {e}")
        # Graceful fallback to OCR if normal extraction failed completely
        if OCR_AVAILABLE:
            try:
                pages_data = _extract_text_via_ocr(file_path)
            except Exception as ocr_err:
                logger.error(f"OCR fallback also failed: {ocr_err}")
                
    return pages_data

def _extract_text_via_ocr(file_path: str, expected_pages: int = None) -> list[dict]:
    """
    Converts PDF pages to images and runs Tesseract OCR.
    """
    pages_data = []
    logger.info(f"Starting OCR extraction on {file_path}")
    
    try:
        # Convert PDF to list of PIL Images
        # poppler_path can be specified if needed, but we rely on system PATH
        images = convert_from_path(file_path)
        
        for idx, img in enumerate(images):
            page_num = idx + 1
            logger.info(f"Running OCR on page {page_num}/{len(images)}")
            
            try:
                # Run Tesseract OCR on the page image
                text = pytesseract.image_to_string(img)
                pages_data.append({
                    "page": page_num,
                    "text": text.strip(),
                    "method": "ocr"
                })
            except Exception as tess_err:
                logger.error(f"Tesseract failed on page {page_num}: {tess_err}")
                pages_data.append({
                    "page": page_num,
                    "text": "",
                    "method": "failed_ocr",
                    "error": str(tess_err)
                })
                
        return pages_data
    except Exception as e:
        logger.error(f"Failed to convert PDF pages to images for OCR: {e}. "
                     "Make sure 'poppler' is installed and added to the system PATH.")
        # Return fallback empty pages if we couldn't even convert the pages
        if expected_pages:
            return [{"page": i + 1, "text": "", "method": "failed_poppler"} for i in range(expected_pages)]
        raise e
