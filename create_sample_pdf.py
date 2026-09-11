from pypdf import PdfReader

def create_pdf(filename, content_lines):
    content = "BT /F1 12 Tf 50 720 Td 15 TL\n"
    for line in content_lines:
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        content += f"({escaped}) '\n"
    content += "ET\n"
    
    stream_len = len(content.encode("latin-1"))
    
    body = (
        "%PDF-1.4\n"
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n"
        f"4 0 obj << /Length {stream_len} >>\n"
        "stream\n"
        f"{content}"
        "endstream\n"
        "endobj\n"
        "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
    )
    
    # Calculate xref offsets
    lines = body.split("\n")
    offsets = [0]
    pos = 0
    # Let's write binary directly and find obj offsets
    parts = [
        b"%PDF-1.4\n",
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
        f"4 0 obj << /Length {stream_len} >>\nstream\n{content}endstream\nendobj\n".encode("latin-1"),
        b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    ]
    
    pos = len(parts[0])
    offsets = [0]
    for p in parts[1:]:
        offsets.append(pos)
        pos += len(p)
        
    xref_pos = pos
    xref = f"xref\n0 {len(offsets)}\n0000000000 65535 f \n"
    for off in offsets[1:]:
        xref += f"{off:010d} 00000 n \n"
    trailer = f"trailer << /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n"
    
    with open(filename, "wb") as f:
        for p in parts:
            f.write(p)
        f.write(xref.encode("latin-1"))
        f.write(trailer.encode("latin-1"))

sample_lines = [
    "GOVERNMENT OF INDIA - MINISTRY OF MSME",
    "UDYAM REGISTRATION CERTIFICATE",
    "Enterprise Name: KAVACH SECURITY SYSTEMS PRIVATE LIMITED",
    "Udyam Registration Number: UDYAM-MH-12-0088776",
    "Major Activity: Manufacturing & System Integration",
    "Permanent Account Number (PAN): AABCK9988G",
    "Goods & Services Tax Identification Number (GSTIN): 27AABCK9988G1Z3",
    "EPFO Establishment ID: MH/BAN/0088776/000",
    "ESIC Code: 31000887760000101",
    "Date of Incorporation: 14/08/2019",
]

create_pdf("sample_bidder_kavach.pdf", sample_lines)
print("Created sample_bidder_kavach.pdf")

# Verify with pypdf
reader = PdfReader("sample_bidder_kavach.pdf")
text = "\n".join([page.extract_text() for page in reader.pages])
print("\nExtracted text from sample PDF:")
print(text)
