"""Create minimal valid PDFs for testing without external dependencies."""
import os
import struct

UPLOAD_DIR = r"D:\Project\Industrial Knowledge Intelligence Platform2.0\backend\data\uploaded_documents"

def make_pdf(filename: str, text: str) -> str:
    """Create a minimal valid PDF with given text."""
    fpath = os.path.join(UPLOAD_DIR, filename)
    
    lines = text.strip().split('\n')
    
    # Build text stream
    text_ops = []
    y = 700
    for line in lines:
        # Escape special PDF chars
        safe_line = line.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
        text_ops.append(f"BT /F1 12 Tf 50 {y} Td ({safe_line}) Tj ET")
        y -= 20
    
    stream_data = "\n".join(text_ops)
    stream_bytes = stream_data.encode('latin-1', errors='replace')
    
    # Build minimal PDF structure
    objects = []
    
    # Object 1: Catalog
    catalog = b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    
    # Object 2: Pages
    pages = b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    
    # Object 3: Page
    page = b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
    
    # Object 4: Content stream
    content = f"4 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n".encode() + stream_bytes + b"\nendstream\nendobj\n"
    
    # Object 5: Font
    font = b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    
    # Build PDF
    header = b"%PDF-1.4\n"
    
    # Compute byte offsets for xref
    offsets = []
    body = b""
    
    for obj_bytes in [catalog, pages, page, content, font]:
        offsets.append(len(header) + len(body))
        body += obj_bytes
    
    # Cross-reference table
    xref_offset = len(header) + len(body)
    xref = f"xref\n0 6\n0000000000 65535 f \n"
    for off in offsets:
        xref += f"{off:010d} 00000 n \n"
    xref += f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"
    
    pdf_bytes = header + body + xref.encode()
    
    with open(fpath, 'wb') as f:
        f.write(pdf_bytes)
    
    print(f"Created: {fpath} ({len(pdf_bytes)} bytes)")
    return fpath


pdfs = {
    "Safety_Manual_Test.pdf": """Safety Manual
Emergency Response Procedures
All personnel must wear PPE at all times.
Emergency exits are marked with green signs.
Fire extinguishers are on each floor.
First aid kits located near all exits.
Training sessions mandatory for all staff.""",
    
    "Operations_Guide_Test.pdf": """Operations Guide
Personal Protective Equipment Requirements
Hard hats required on all active sites.
Safety boots mandatory in work areas.
High visibility vests worn at all times.
Eye protection required near machinery.
Hearing protection in loud environments.""",
    
    "Compliance_Doc_Test.pdf": """Compliance Document
Training and Competency Requirements
All operators complete safety induction.
Refresher training conducted every six months.
Competency assessments are documented quarterly.
Incident reporting mandatory within 24 hours.
All personnel trained on emergency procedures.""",
}

os.makedirs(UPLOAD_DIR, exist_ok=True)
for fname, text in pdfs.items():
    make_pdf(fname, text)

print("Done.")
