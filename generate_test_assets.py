"""Generate sample test PDF assets using PyMuPDF."""
import fitz  # PyMuPDF
from pathlib import Path

DIR = Path(__file__).resolve().parent / "test_assets"
DIR.mkdir(exist_ok=True)

def create_pdf(filepath: Path, text_lines: list[str]):
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)  # A4
    y = 60
    for line in text_lines:
        page.insert_text((50, y), line, fontsize=12, fontname="helv")
        y += 24
    doc.save(str(filepath))
    doc.close()

# 1. Tender Notice PDF
create_pdf(DIR / "tender_notice.pdf", [
    "GOVERNMENT E-MARKETPLACE (GeM) - PROCUREMENT NOTICE",
    "==================================================",
    "Tender Reference ID: GEM/2026/B/882100",
    "Tender Title: Procurement of High-Grade Medical Diagnostic Equipment",
    "Category: Medical Devices",
    "Description & Scope of Work: Comprehensive supply, installation, and multi-year calibration of hospital medical diagnostic equipment.",
    "Submission Deadline: 15/11/2026",
    "",
    "MANDATORY STATUTORY ELIGIBILITY REQUIREMENTS:",
    "1. Valid Udyam / MSME Registration certificate.",
    "2. Active GSTIN registration and tax compliance filing proof.",
    "3. Permanent Account Number (PAN) and Income Tax Return compliance.",
    "4. Regular EPFO and ESIC labor statutory contributions.",
    "5. Non-debarment and central blacklist verification.",
])

# 2. Multi-document test files
for name in ["A.pdf", "B.pdf", "C.pdf", "D.pdf"]:
    create_pdf(DIR / name, [
        f"STATUTORY TECHNICAL CERTIFICATE: {name}",
        "=====================================",
        f"This is an official technical compliance credential designated {name}.",
        "Enterprise Legal Name: Alpha Tech Solutions Pvt Ltd",
        "Document Reference: DOC-REF-2026-" + name[:1],
    ])

# 3. Technical Certificate with CIN and Enterprise Name
create_pdf(DIR / "ISO_Certificate.pdf", [
    "INTERNATIONAL ORGANIZATION FOR STANDARDIZATION",
    "==============================================",
    "ISO 9001:2015 QUALITY MANAGEMENT CERTIFICATE",
    "Enterprise Name: Apex Global Technologies Pvt Ltd",
    "CIN: U72900MH2021PTC123456",
    "Constitution: Private Limited Company",
    "Registered Address: Plot 54 Cyber City Phase 2 Pune 411001",
    "Registration Date: 2021-04-15",
])

# 4. Conflicting document with different company name
create_pdf(DIR / "Conflicting_Certificate.pdf", [
    "OEM AUTHORIZATION CERTIFICATE",
    "=============================",
    "Enterprise Legal Name: Zenith Commercial Ventures LLP",
    "CIN: U72900MH2021PTC123456",
    "Constitution: Limited Liability Partnership",
])

# 5. EPFO / ESIC Certificate
create_pdf(DIR / "EPFO_ESIC_Certificate.pdf", [
    "EMPLOYEES PROVIDENT FUND & ESIC ESTABLISHMENT PROOF",
    "===================================================",
    "Enterprise Legal Name: Apex Global Technologies Pvt Ltd",
    "EPFO Establishment Code: MH/BAN/0012345/000",
    "ESIC Registration Code: 31000123450000101",
])

print("Test assets successfully generated in:", DIR)
