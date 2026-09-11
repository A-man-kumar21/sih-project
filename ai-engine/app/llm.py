"""LLM-assisted extraction and briefing service with deterministic fallbacks."""

import unicodedata
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import re
from typing import Any

from dotenv import load_dotenv
import pymupdf
from pypdf import PdfReader
import requests

# Load environment variables from .env
_env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(_env_path)


def get_gemini_api_key() -> str:
    """Read Gemini API key from environment variable (used strictly for officer advisory briefing)."""
    return os.environ.get("GEMINI_API_KEY", "").strip()


_paddle_ocr_engine = None


def get_local_paddle_ocr():
    """Lazily instantiate local PaddleOCR engine (PP-OCRv4 ONNX runtime). Zero external network calls."""
    global _paddle_ocr_engine
    if _paddle_ocr_engine is None:
        from rapidocr_onnxruntime import RapidOCR
        _paddle_ocr_engine = RapidOCR()
    return _paddle_ocr_engine


def run_local_paddle_ocr(image_input) -> str:
    """Run local PaddleOCR on image bytes, file path, or array."""
    try:
        engine = get_local_paddle_ocr()
        result, _ = engine(image_input)
        if not result:
            return ""
        lines = [item[1].strip() for item in result if len(item) >= 2 and item[1] and item[1].strip()]
        return "\n".join(lines)
    except Exception:
        return ""


def extract_text_and_method(file_bytes: bytes, filename: str = "") -> tuple[str, str]:
    """
    100% Local document text extractor.
    - If text-based PDF: extracts text layer via PyMuPDF ('pymupdf').
    - If scanned/image-only PDF (no text or <30 alphanumeric chars): renders pages to images and runs local PaddleOCR ('paddleocr').
    - If image (.jpg, .jpeg, .png): runs local PaddleOCR directly ('paddleocr').
    - Fallback: plain text / UTF-8 decoding.
    """
    fn = filename.lower()
    is_pdf = file_bytes.startswith(b"%PDF") or fn.endswith(".pdf")
    is_image = (
        file_bytes.startswith(b"\x89PNG")
        or file_bytes.startswith(b"\xff\xd8")
        or file_bytes.startswith(b"GIF")
        or any(fn.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp"])
    )

    if is_pdf:
        # 1. Try PyMuPDF text layer
        try:
            doc = pymupdf.open(stream=file_bytes, filetype="pdf")
            extracted_pages = []
            for page in doc:
                t = page.get_text()
                if t:
                    extracted_pages.append(t)
            pdf_text = "\n".join(extracted_pages).strip()

            # Check if text layer contains meaningful characters
            alnum_count = len(re.findall(r"[A-Za-z0-9]", pdf_text))
            if alnum_count >= 30:
                return pdf_text, "pymupdf"

            # 2. Scanned / image-only PDF: render pages to images and execute local PaddleOCR
            ocr_pages = []
            for page in doc:
                pix = page.get_pixmap(dpi=150)
                png_bytes = pix.tobytes("png")
                page_ocr = run_local_paddle_ocr(png_bytes)
                if page_ocr:
                    ocr_pages.append(page_ocr)
            ocr_text = "\n".join(ocr_pages).strip()
            if ocr_text:
                return ocr_text, "paddleocr"
        except Exception:
            pass

    elif is_image:
        # Direct image processed locally via PaddleOCR
        ocr_text = run_local_paddle_ocr(file_bytes)
        return ocr_text, "paddleocr"

    # Fallback to UTF-8 decoding (for test files or plain-text mock uploads)
    try:
        raw_str = file_bytes.decode("utf-8", errors="ignore")
        cleaned_lines = [line.strip() for line in raw_str.splitlines() if any(c.isalnum() for c in line)]
        if cleaned_lines:
            return "\n".join(cleaned_lines), "pymupdf"
    except Exception:
        pass

    return "", "pymupdf"


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract plain text from uploaded PDF or document bytes using local PyMuPDF / PaddleOCR."""
    text, _ = extract_text_and_method(pdf_bytes)
    return text


MONTH_MAP = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "september": 9, "oct": 10, "october": 10,
    "nov": 11, "november": 11, "dec": 12, "december": 12,
}


def parse_date_to_dmy(raw_val: str) -> str | None:
    """Parse various date formats into standardized DD/MM/YYYY."""
    if not raw_val:
        return None
    val = raw_val.strip()
    # 1. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    m1 = re.search(r"\b(0?[1-9]|[12][0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.]((?:19|20)\d{2})\b", val)
    if m1:
        d, m, y = int(m1.group(1)), int(m1.group(2)), int(m1.group(3))
        return f"{d:02d}/{m:02d}/{y:04d}"
    # 2. YYYY-MM-DD or YYYY/MM/DD
    m2 = re.search(r"\b((?:19|20)\d{2})[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](0?[1-9]|[12][0-9]|3[01])\b", val)
    if m2:
        y, m, d = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))
        return f"{d:02d}/{m:02d}/{y:04d}"
    # 3. DD Month YYYY (e.g. 15 June 2020 or 15-Jun-2020)
    m3 = re.search(r"\b(0?[1-9]|[12][0-9]|3[01])[\s\-]+([A-Za-z]{3,10})[\s\-]+((?:19|20)\d{2})\b", val)
    if m3:
        d = int(m3.group(1))
        mon_str = m3.group(2).lower()
        y = int(m3.group(3))
        if mon_str in MONTH_MAP:
            return f"{d:02d}/{MONTH_MAP[mon_str]:02d}/{y:04d}"
    # 4. Month DD, YYYY (e.g. June 15, 2020)
    m4 = re.search(r"\b([A-Za-z]{3,10})[\s\-]+(0?[1-9]|[12][0-9]|3[01]),?[\s\-]+((?:19|20)\d{2})\b", val)
    if m4:
        mon_str = m4.group(1).lower()
        d = int(m4.group(2))
        y = int(m4.group(3))
        if mon_str in MONTH_MAP:
            return f"{d:02d}/{MONTH_MAP[mon_str]:02d}/{y:04d}"
    return None


def normalize_enterprise_type(val: str) -> str | None:
    """Map enterprise classification variants to canonical types: Micro, Small, Medium, Large."""
    if not val:
        return None
    s = val.strip().lower()
    if "micro" in s:
        return "Micro"
    if "small" in s:
        return "Small"
    if "medium" in s:
        return "Medium"
    if "large" in s or "non-msme" in s:
        return "Large"
    if "startup" in s:
        return "Micro"
    return None


KNOWN_HEADER_WORDS = {
    "field", "mock value", "value", "details", "description", "document",
    "verification note", "expected prototype result", "expected compliance score"
}


def is_header_or_skip(line: str) -> bool:
    """Check if line is a table header or test disclaimer that should be skipped."""
    l_low = line.strip().lower()
    if l_low in KNOWN_HEADER_WORDS:
        return True
    if l_low.startswith("verification note") or l_low.startswith("this is fabricated") or l_low.startswith("mock / synthetic"):
        return True
    return False


def normalize_text(text: str) -> str:
    """
    Normalize extracted document text before pattern extraction.
    Handles OCR spacing, unified punctuation, hyphens, and Unicode variants while keeping IDs accurate.
    Reconstructs labels split across multiple lines in PDF text layers.
    """
    if not text:
        return ""

    # 1. Unicode normalization (NFKC)
    norm = unicodedata.normalize("NFKC", text)

    # 2. Standardize newlines
    norm = norm.replace("\r\n", "\n").replace("\r", "\n")

    # 3. Standardize hyphens and dashes (em-dash, en-dash, minus to standard hyphen)
    norm = re.sub(r"[—–−‐‑]", "-", norm)

    # 4. Standardize quotes, colons, and slashes
    norm = norm.replace("：", ":").replace("“", '"').replace("”", '"').replace("’", "'").replace("／", "/")

    # 5. Handle common OCR spaced keywords
    norm = re.sub(r"(?i)\bU\s*D\s*Y\s*A\s*M\b", "UDYAM", norm)
    norm = re.sub(r"(?i)\bG\s*S\s*T\s*I\s*N\b", "GSTIN", norm)
    norm = re.sub(r"(?i)\bP\s*A\s*N\b", "PAN", norm)
    norm = re.sub(r"(?i)\bC\s*I\s*N\b", "CIN", norm)
    norm = re.sub(r"(?i)\bE\s*P\s*F\s*O\b", "EPFO", norm)
    norm = re.sub(r"(?i)\bE\s*S\s*I\s*C\b", "ESIC", norm)
    norm = re.sub(r"(?i)\bM\s*S\s*M\s*E\b", "MSME", norm)

    # 6. Reconstruct labels split across lines
    norm = re.sub(r"(?i)Date\s+of\s+Registration\s*/\s*\n\s*Incorporation", "Date of Registration / Incorporation", norm)
    norm = re.sub(r"(?i)Date\s+of\s*\n\s*Registration", "Date of Registration", norm)
    norm = re.sub(r"(?i)Date\s+of\s*\n\s*Incorporation", "Date of Incorporation", norm)
    norm = re.sub(r"(?i)Registered\s+Address\s*/\s*Principal\s+Place\s+of\s*\n\s*Business", "Registered Address / Principal Place of Business", norm)
    norm = re.sub(r"(?i)Principal\s+Place\s+of\s*\n\s*Business", "Principal Place of Business", norm)
    norm = re.sub(r"(?i)Enterprise\s+Classification\s*/\s*\n\s*Category", "Enterprise Classification / Category", norm)
    norm = re.sub(r"(?i)EPFO\s+Establishment\s*\n\s*Code", "EPFO Establishment Code", norm)
    norm = re.sub(r"(?i)ESIC\s+Employer\s*\n\s*Code", "ESIC Employer Code", norm)
    norm = re.sub(r"(?i)Permanent\s+Account\s+Number\s*\n\s*\(PAN\)", "Permanent Account Number (PAN)", norm)
    norm = re.sub(r"(?i)GST\s+Identification\s+Number\s*\n\s*\(GSTIN\)", "GST Identification Number (GSTIN)", norm)
    norm = re.sub(r"(?i)Corporate\s+Identification\s+Number\s*\n\s*\(CIN\)", "Corporate Identification Number (CIN)", norm)
    norm = re.sub(r"(?i)Udyam\s*/\s*MSME\s+Registration\s*\n\s*Number", "Udyam / MSME Registration Number", norm)
    norm = re.sub(r"(?i)Constitution\s+of\s*\n\s*Business", "Constitution of Business", norm)
    norm = re.sub(r"(?i)Authorized\s+Contact\s*\n\s*Person", "Authorized Contact Person", norm)

    # 7. Normalize whitespace per line while preserving line breaks
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in norm.split("\n")]
    return "\n".join(lines)


def extract_field_near_label(
    lines: list[str],
    label_patterns: list[str],
    cleaner_fn,
    validator_fn,
    max_lines_ahead: int = 3,
) -> tuple[str | None, int]:
    """
    Search for known field labels in document lines.
    Once a label is matched:
    1. Inspect same line after the label.
    2. If no valid candidate on same line, inspect the next 1-3 lines (table format).
    3. Return (cleaned_candidate, confidence) if validated, else (None, 0).
    """
    compiled = [re.compile(rf"(?:^|\b)(?:{p})(?:$|\b|\s*[:\-–])", re.IGNORECASE) for p in label_patterns]
    for idx, line in enumerate(lines):
        for pattern in compiled:
            m = pattern.search(line)
            if m:
                # 1. Check remainder on same line after label
                remainder = line[m.end():].strip().lstrip(":-–= ").strip()
                if remainder:
                    cand = cleaner_fn(remainder)
                    if cand and validator_fn(cand):
                        return cand, 96

                # 2. Check subsequent lines (handling table rows where label is on one line and value is on the next)
                for ahead in range(1, max_lines_ahead + 1):
                    if idx + ahead >= len(lines):
                        break
                    next_line = lines[idx + ahead].strip()
                    if not next_line or is_header_or_skip(next_line):
                        continue
                    # If this next line matches any other label pattern itself, stop looking ahead
                    is_other_label = any(p.search(next_line) for p in compiled)
                    if is_other_label:
                        break
                    cand = cleaner_fn(next_line)
                    if cand and validator_fn(cand):
                        return cand, 96
                break
    return None, 0


# =====================================================================
# 100% LOCAL DETERMINISTIC EXTRACTION (NO EXTERNAL LLM / API CALLS)
# =====================================================================

def deterministic_extract_fields(norm_text: str, raw_text: str = "", document_type: str | None = None) -> dict[str, Any]:
    """
    Deterministic regex and structural pattern extractor for statutory procurement documents.
    Extracts PAN, GSTIN, Udyam, CIN, EPFO, ESIC, Company/Enterprise Name, and Address.
    Calculates deterministic confidence (0-100 scale).
    """
    fields = {
        "pan": "",
        "gstin": "",
        "udyam": "",
        "cin": "",
        "epfo": "",
        "esic": "",
        "companyName": "",
        "address": "",
        # Aliases for backward compatibility
        "udyam_number": "",
        "epfo_number": "",
        "esic_number": "",
        "company_name": "",
        "enterprise_name": "",
        "registered_address": "",
        "epfo_esic_number": "",
        "enterprise_type": "",
        "business_constitution": "",
        "registration_date": "",
        "legal_name": "",
        "trade_name": "",
    }
    field_conf: dict[str, int] = {}
    combined_text = f"{norm_text}\n{raw_text}"
    lines = [line.strip() for line in norm_text.split("\n") if line.strip()]

    # 1. PAN EXTRACTION (AAAAA9999A)
    # Prefer matches near PAN labels: "PAN", "Permanent Account Number", "PAN No"
    pan_labels = [
        r"Permanent\s+Account\s+Number\s*\(PAN\)",
        r"Permanent\s+Account\s+Number",
        r"PAN\s*Card",
        r"PAN\s*Number",
        r"PAN\s*No",
        r"\bPAN\b",
    ]
    pan_val, pan_conf = extract_field_near_label(
        lines,
        pan_labels,
        lambda s: re.sub(r"\s+", "", s).upper(),
        lambda s: bool(re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]$", s)),
    )
    if pan_val:
        fields["pan"] = pan_val
        is_struct_valid = pan_val[3] in "CPHFATBLJG"
        field_conf["pan"] = 98 if is_struct_valid else 94
    else:
        # Generic PAN pattern match
        pan_match = re.search(r"\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b", norm_text)
        if pan_match:
            p_val = pan_match.group(1).upper()
            fields["pan"] = p_val
            is_struct_valid = p_val[3] in "CPHFATBLJG"
            field_conf["pan"] = 94 if is_struct_valid else 88

    # 2. GSTIN EXTRACTION (2 digits, 10 PAN, 1 entity, Z, 1 checksum)
    gstin_labels = [
        r"GST\s+Identification\s+Number\s*\(GSTIN\)",
        r"GST\s+Identification\s+Number",
        r"GST\s+Identification\s+No\.?",
        r"GSTIN/UIN",
        r"GSTIN\s*No\.?",
        r"GSTIN\s*Number",
        r"GST\s*No\.?",
        r"GST\s*Number",
        r"\bGSTIN\b",
    ]
    gstin_val, gstin_conf = extract_field_near_label(
        lines,
        gstin_labels,
        lambda s: re.sub(r"\s+", "", s).upper(),
        lambda s: bool(re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", s)),
    )
    if gstin_val:
        fields["gstin"] = gstin_val
        state_code = gstin_val[:2]
        is_state_valid = state_code.isdigit() and (1 <= int(state_code) <= 38 or state_code in ("97", "99"))
        field_conf["gstin"] = 99 if is_state_valid else 94
    else:
        gstin_match = re.search(r"\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b", norm_text)
        if gstin_match:
            g_val = gstin_match.group(1).upper()
            fields["gstin"] = g_val
            state_code = g_val[:2]
            is_state_valid = state_code.isdigit() and (1 <= int(state_code) <= 38 or state_code in ("97", "99"))
            field_conf["gstin"] = 95 if is_state_valid else 90

    # Auto-derive PAN from GSTIN if PAN is missing or unverified
    if fields["gstin"] and len(fields["gstin"]) == 15:
        derived_pan = fields["gstin"][2:12]
        if not fields["pan"]:
            fields["pan"] = derived_pan
            field_conf["pan"] = 96
        elif fields["pan"] == derived_pan:
            field_conf["pan"] = min(100, field_conf.get("pan", 90) + 4)
            field_conf["gstin"] = min(100, field_conf.get("gstin", 90) + 2)

    # 3. UDYAM / MSME REGISTRATION NUMBER (UDYAM-XX-00-0000000)
    udyam_labels = [
        r"Udyam\s*/\s*MSME\s+Registration\s+Number",
        r"Udyam/MSME\s+Registration\s+Number",
        r"Udyam\s+Registration\s+Number",
        r"Udyam\s+Registration\s+No\.?",
        r"Udyam\s+Number",
        r"Udyam\s+No\.?",
        r"UDYAM\s*Reg\.?",
        r"MSME\s*Registration\s*Number",
        r"MSME\s*Reg\.?",
        r"\bUDYAM\b",
        r"\bMSME\b",
    ]
    udyam_val, udyam_conf = extract_field_near_label(
        lines,
        udyam_labels,
        lambda s: re.sub(r"\s+", "", s).upper().replace("—", "-"),
        lambda s: bool(re.match(r"^UDYAM-[A-Z]{2}-[A-Z0-9]{2}-[0-9]{7}$", s)),
    )
    if udyam_val:
        fields["udyam"] = udyam_val
        fields["udyam_number"] = udyam_val
        field_conf["udyam"] = 98
    else:
        udyam_match = re.search(r"\b(UDYAM-[A-Z]{2}-[A-Z0-9]{2}-[0-9]{7})\b", norm_text, re.IGNORECASE)
        if udyam_match:
            u_val = udyam_match.group(1).upper()
            fields["udyam"] = u_val
            fields["udyam_number"] = u_val
            field_conf["udyam"] = 95

    # 4. CORPORATE IDENTIFICATION NUMBER (CIN - 21 chars: U12345MH2018PTC123456)
    cin_labels = [
        r"Corporate\s+Identification\s+Number\s*\(CIN\)",
        r"Corporate\s+Identification\s+Number",
        r"Corporate\s+Identity\s+Number",
        r"CIN\s*Number",
        r"CIN\s*No\.?",
        r"\bCIN\b",
    ]
    cin_val, cin_conf = extract_field_near_label(
        lines,
        cin_labels,
        lambda s: re.sub(r"\s+", "", s).upper(),
        lambda s: bool(re.match(r"^[LUu][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$", s)),
    )
    if cin_val:
        fields["cin"] = cin_val
        field_conf["cin"] = 98
    else:
        cin_match = re.search(r"\b([LUu][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6})\b", norm_text)
        if cin_match:
            fields["cin"] = cin_match.group(1).upper()
            field_conf["cin"] = 93

    # 5. EPFO ESTABLISHMENT IDENTIFIER
    epfo_labels = [
        r"EPFO\s+Establishment\s+Code",
        r"EPFO\s+Code",
        r"PF\s+Establishment\s+Code",
        r"Establishment\s+Code",
        r"Provident\s+Fund\s+Code",
        r"PF\s+Code",
        r"EPF\s+Code",
        r"EPFO\s+Registration",
        r"\bEPFO\b",
    ]
    epfo_val, epfo_conf = extract_field_near_label(
        lines,
        epfo_labels,
        lambda s: re.sub(r"\s+", "", s).upper(),
        lambda s: bool(re.match(r"^(?:[A-Z]{2}/[A-Z0-9\-_/]{4,30}|[A-Z]{2}[A-Z0-9]{3}\d{7}\d{3})$", s)),
    )
    if epfo_val:
        fields["epfo"] = epfo_val
        fields["epfo_number"] = epfo_val
        fields["epfo_esic_number"] = epfo_val
        field_conf["epfo"] = 97
    else:
        epfo_match = re.search(r"\b([A-Z]{2}/[A-Z0-9\-_/]{4,30})\b", norm_text)
        if epfo_match:
            val_found = epfo_match.group(1).upper()
            fields["epfo"] = val_found
            fields["epfo_number"] = val_found
            fields["epfo_esic_number"] = val_found
            field_conf["epfo"] = 91

    # 6. ESIC IDENTIFIER (15-17 digits or formatted)
    esic_labels = [
        r"ESIC\s+Employer\s+Code",
        r"ESIC\s+Code",
        r"ESI\s+Employer\s+Code",
        r"ESI\s+Code",
        r"Employer\s+Code",
        r"ESIC\s+Registration\s+Number",
        r"ESI\s+Registration\s+Number",
        r"ESIC\s+Registration",
        r"Employees\s+State\s+Insurance",
        r"\bESIC\b",
        r"\bESI\b",
    ]
    esic_val, esic_conf = extract_field_near_label(
        lines,
        esic_labels,
        lambda s: re.sub(r"[\s\-_]+", "", s),
        lambda s: bool(re.match(r"^[0-9]{15,17}$", s)),
    )
    if esic_val:
        fields["esic"] = esic_val
        fields["esic_number"] = esic_val
        if not fields["epfo_esic_number"]:
            fields["epfo_esic_number"] = esic_val
        field_conf["esic"] = 97
    else:
        esic_match = re.search(r"\b([0-9]{2}-[0-9]{2}-[0-9]{4,6}-[0-9]{3}-[0-9]{4})\b", norm_text)
        if not esic_match:
            esic_match = re.search(r"\b([0-9]{15,17})\b", norm_text)
        if esic_match:
            val_clean = re.sub(r"[\s\-]+", "", esic_match.group(1))
            fields["esic"] = val_clean
            fields["esic_number"] = val_clean
            if not fields["epfo_esic_number"]:
                fields["epfo_esic_number"] = val_clean
            field_conf["esic"] = 90

    # 7. DATE OF REGISTRATION / INCORPORATION
    date_labels = [
        r"Date\s+of\s+Registration\s*/\s*Incorporation",
        r"Date\s+of\s+Registration/Incorporation",
        r"Date\s+of\s+Registration",
        r"Registration\s+Date",
        r"Date\s+of\s+Incorporation",
        r"Incorporation\s+Date",
        r"Date\s+of\s+Commencement",
        r"Date\s+of\s+Establishment",
    ]
    reg_date_val, reg_date_conf = extract_field_near_label(
        lines,
        date_labels,
        lambda s: parse_date_to_dmy(s),
        lambda s: bool(s and len(s) == 10),
    )
    if reg_date_val:
        fields["registration_date"] = reg_date_val
        field_conf["registration_date"] = 97
    else:
        date_match = re.search(
            r"(?:Date\s+of\s+(?:Registration|Incorporation|Liability|Validity)|Registration\s+Date)\s*[:\-–]?\s*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})",
            norm_text,
            re.IGNORECASE,
        )
        if date_match:
            parsed = parse_date_to_dmy(date_match.group(1).strip())
            if parsed:
                fields["registration_date"] = parsed
                field_conf["registration_date"] = 92

    # 8. ENTERPRISE CLASSIFICATION / CATEGORY
    type_labels = [
        r"Enterprise\s+Classification\s*/\s*Category",
        r"Enterprise\s+Classification",
        r"Enterprise\s+Category",
        r"Enterprise\s+Type",
        r"Type\s+of\s+Enterprise",
        r"MSME\s+Classification",
        r"\bClassification\b",
    ]
    type_val, type_conf = extract_field_near_label(
        lines,
        type_labels,
        lambda s: normalize_enterprise_type(s),
        lambda s: bool(s in ("Micro", "Small", "Medium", "Large")),
    )
    if type_val:
        fields["enterprise_type"] = type_val
        field_conf["enterprise_type"] = 97
    else:
        type_match = re.search(r"\b(Micro|Small|Medium|Large)\b", norm_text, re.IGNORECASE)
        if type_match:
            fields["enterprise_type"] = type_match.group(1).capitalize()
            field_conf["enterprise_type"] = 90

    # 9. COMPANY / ENTERPRISE NAME
    name_labels = [
        r"Enterprise\s+Legal\s+Name",
        r"Name\s+of\s+Enterprise",
        r"Enterprise\s+Name",
        r"Legal\s+Name",
        r"Trade\s+Name",
        r"Company\s+Name",
        r"Name\s+of\s+the\s+Entity",
        r"Name\s+of\s+Firm",
        r"\bM/s\.?",
    ]
    name_val, name_conf = extract_field_near_label(
        lines,
        name_labels,
        lambda s: re.split(r"(?i)\b(?:UDYAM|GSTIN|PAN|CIN|Date|Type|Address|Field|Mock)\b", s.strip().strip(":-–= ").strip())[0].strip(),
        lambda s: len(s) >= 3 and not is_header_or_skip(s),
    )
    if name_val and len(name_val) >= 3:
        fields["companyName"] = name_val
        fields["company_name"] = name_val
        fields["enterprise_name"] = name_val
        fields["legal_name"] = name_val
        field_conf["companyName"] = 97
    else:
        co_match = re.search(
            r"\b([A-Z][A-Za-z0-9\s,\.\-&]{2,55}(?:Private Limited|Pvt\.?\s*Ltd\.?|Limited Liability Partnership|LLP|Limited))\b",
            combined_text,
        )
        if co_match:
            c_val = co_match.group(1).strip()
            fields["companyName"] = c_val
            fields["company_name"] = c_val
            fields["enterprise_name"] = c_val
            fields["legal_name"] = c_val
            field_conf["companyName"] = 90

    # Trade Name
    trade_labeled = re.search(r"(?:Trade Name)\s*[:\-–]?\s*([A-Za-z0-9\s,\.\-&]+)", norm_text, re.IGNORECASE)
    if trade_labeled:
        fields["trade_name"] = trade_labeled.group(1).strip().split("\n")[0].strip()

    # 10. BUSINESS CONSTITUTION
    const_labels = [
        r"Constitution\s+of\s+Business",
        r"Business\s+Constitution",
        r"Organisation\s+Type",
        r"\bConstitution\b",
    ]
    const_val, const_conf = extract_field_near_label(
        lines,
        const_labels,
        lambda s: s.strip().strip(":-–= ").strip(),
        lambda s: len(s) >= 3 and not is_header_or_skip(s),
    )
    if const_val and len(const_val) > 2:
        fields["business_constitution"] = const_val
        field_conf["business_constitution"] = 96
    else:
        if re.search(r"\b(?:Private Limited|Pvt\.?\s*Ltd\.?)\b", norm_text, re.IGNORECASE):
            fields["business_constitution"] = "Private Limited Company"
            field_conf["business_constitution"] = 95
        elif re.search(r"\bLLP\b|Limited Liability Partnership", norm_text, re.IGNORECASE):
            fields["business_constitution"] = "Limited Liability Partnership (LLP)"
            field_conf["business_constitution"] = 95
        elif re.search(r"\bProprietorship\b|\bProprietary\b", norm_text, re.IGNORECASE):
            fields["business_constitution"] = "Proprietorship"
            field_conf["business_constitution"] = 90
        elif re.search(r"\bPartnership\b", norm_text, re.IGNORECASE):
            fields["business_constitution"] = "Partnership"
            field_conf["business_constitution"] = 90

    # 11. ADDRESS / PRINCIPAL PLACE OF BUSINESS
    addr_labels = [
        r"Registered\s+Address\s*/\s*Principal\s+Place\s+of\s+Business",
        r"Principal\s+Place\s+of\s+Business",
        r"Registered\s+Address",
        r"Official\s+Address",
        r"Enterprise\s+Address",
        r"Business\s+Address",
        r"Location\s+of\s+Plant/Unit",
        r"\bAddress\b",
    ]
    addr_val, addr_conf = extract_field_near_label(
        lines,
        addr_labels,
        lambda s: s.strip().strip(":-–= ").strip(),
        lambda s: len(s) >= 10 and not is_header_or_skip(s),
    )
    if addr_val:
        # Clean up any leftover label headers if present in multi-line address
        clean_addr = re.sub(r"(?i)^(?:Registered\s+Address\s*/\s*Principal\s+Place\s+of\s+Business|Business|Address)\s*[:\-–]?\s*", "", addr_val).strip()
        fields["address"] = clean_addr[:160]
        fields["registered_address"] = clean_addr[:160]
        field_conf["address"] = 95
    else:
        pin_match = re.search(r"([A-Za-z0-9\s,\.\-#/()]{15,100}\b[1-9][0-9]{5}\b)", norm_text)
        if pin_match:
            a_val = pin_match.group(1).strip()
            fields["address"] = a_val[:160]
            fields["registered_address"] = a_val[:160]
            field_conf["address"] = 86

    # Overall deterministic confidence calculation
    conf_scores = list(field_conf.values())
    if conf_scores:
        overall_conf = int(round(sum(conf_scores) / len(conf_scores)))
    else:
        overall_conf = 0

    return {
        "fields": fields,
        "confidence": overall_conf,
        "field_confidences": field_conf,
    }


def extract_bidder_from_pdf(
    pdf_bytes: bytes,
    filename: str = "",
    document_type: str | None = None,
    simulate_failure: bool = False,
) -> dict[str, Any]:
    """
    100% Local & Deterministic Document Data Extraction.
    Uses PyMuPDF for text PDFs, PaddleOCR for scanned/image-only PDFs and images (JPG/JPEG/PNG).
    Performs text normalization and deterministic regex extraction with zero external LLM/API calls.
    """
    if simulate_failure:
        return {
            "text": "",
            "fields": {},
            "extractionMethod": "pymupdf",
            "confidence": 0,
            "success": False,
            "error": "Couldn't auto-extract, please fill manually (simulated failure).",
            "extracted": {},
        }

    # Extract text and determine extraction method locally
    raw_text, method = extract_text_and_method(pdf_bytes, filename=filename)

    if not raw_text.strip():
        return {
            "text": "",
            "fields": {},
            "extractionMethod": method,
            "confidence": 0,
            "success": False,
            "error": "Document contains no readable text or text layer is blank. Please fill manually.",
            "extracted": {},
        }

    # Normalize extracted text
    norm_text = normalize_text(raw_text)

    # Perform deterministic pattern matching
    extraction_res = deterministic_extract_fields(norm_text, raw_text=raw_text, document_type=document_type)
    fields = extraction_res["fields"]
    conf = extraction_res["confidence"]

    # Check if at least one meaningful statutory field was extracted
    has_statutory = bool(
        fields.get("pan")
        or fields.get("gstin")
        or fields.get("udyam")
        or fields.get("cin")
        or fields.get("epfo")
        or fields.get("esic")
        or fields.get("companyName")
    )

    return {
        "text": raw_text,
        "fields": fields,
        "extractionMethod": method,
        "confidence": conf if has_statutory else 0,
        "success": has_statutory,
        "error": None if has_statutory else "Could not identify standard statutory fields. Please verify manually.",
        # Backwards compatibility aliases
        "extracted": fields,
        "confidence_scores": extraction_res.get("field_confidences", {}),
        "source": f"local_{method}",
    }


def heuristic_extract_bidder(text: str, document_type: str | None = None) -> dict[str, Any]:
    """Compatibility wrapper around deterministic_extract_fields."""
    norm_text = normalize_text(text)
    res = deterministic_extract_fields(norm_text, raw_text=text, document_type=document_type)
    return {
        "fields": res["fields"],
        "confidence_scores": res["field_confidences"],
        "overall_confidence": res["confidence"] / 100.0,
    }


def parse_date_to_iso(date_str: str) -> str:
    """Helper to parse extracted date string into ISO YYYY-MM-DD format."""
    if not date_str:
        return ""
    clean = re.sub(r"[^\w\s\-/]", "", date_str).strip()
    for fmt in (
        "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y",
        "%d.%m.%Y", "%Y/%m/%d",
        "%d %b %Y", "%d %B %Y",
        "%d-%b-%Y", "%d-%B-%Y"
    ):
        try:
            dt = datetime.strptime(clean, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    m = re.search(r"\b(20\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b", clean)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m2 = re.search(r"\b(0[1-9]|[12]\d|3[01])[-/](0[1-9]|1[0-2])[-/](20\d{2})\b", clean)
    if m2:
        return f"{m2.group(3)}-{m2.group(2)}-{m2.group(1)}"
    return ""


def extract_tender_from_pdf(pdf_bytes: bytes, simulate_failure: bool = False) -> dict[str, Any]:
    """
    100% Local deterministic tender notice extractor using PyMuPDF & PaddleOCR.
    Zero external LLM or cloud API calls.
    Extracts tenderReferenceId, title, category, description, submissionDeadline, and mandatoryChecks.
    """
    if simulate_failure:
        return {
            "text": "",
            "fields": {
                "tenderReferenceId": "",
                "title": "",
                "category": "Goods",
                "description": "",
                "submissionDeadline": "",
                "mandatoryChecks": [],
            },
            "extractionMethod": "none",
            "confidence": 0,
            "success": False,
            "error": "Couldn't auto-extract, please fill manually (simulated failure).",
            "extracted": {},
        }

    try:
        raw_text, method = extract_text_and_method(pdf_bytes, filename="tender.pdf")
    except Exception as e:
        return {
            "text": "",
            "fields": {
                "tenderReferenceId": "",
                "title": "",
                "category": "Goods",
                "description": "",
                "submissionDeadline": "",
                "mandatoryChecks": [],
            },
            "extractionMethod": "none",
            "confidence": 0,
            "success": False,
            "error": f"Could not read PDF file text ({str(e)}). Please fill manually.",
            "extracted": {},
        }

    if not raw_text.strip():
        return {
            "text": "",
            "fields": {
                "tenderReferenceId": "",
                "title": "",
                "category": "Goods",
                "description": "",
                "submissionDeadline": "",
                "mandatoryChecks": [],
            },
            "extractionMethod": method,
            "confidence": 0,
            "success": False,
            "error": "Couldn't auto-extract: PDF contains no readable text. Please fill manually.",
            "extracted": {},
        }

    norm_text = normalize_text(raw_text)

    # 1. Tender Reference ID
    tender_id = ""
    gem_match = re.search(r"\bGEM/\d{4}/[A-Z0-9]+/\d+\b", norm_text, re.IGNORECASE)
    if gem_match:
        tender_id = gem_match.group(0).upper()
    else:
        lbl_match = re.search(
            r"(?i)(?:Tender\s*(?:Reference\s*)?(?:No|ID|Number)|Bid\s*(?:Reference\s*)?(?:No|ID|Number)|NIT\s*(?:No|Number)|RFP\s*(?:No|Number)|Bid\s*Number)\s*[:\-]\s*([A-Za-z0-9_/\.\-]+)",
            norm_text,
        )
        if lbl_match:
            candidate = lbl_match.group(1).strip().strip(".,;:").upper()
            if len(candidate) >= 4 and not candidate.startswith("HTTP"):
                tender_id = candidate
        else:
            gen_match = re.search(r"\b(?:TENDER|NIT|RFP|BID)[/-][A-Za-z0-9_/\.\-]+\b", norm_text, re.IGNORECASE)
            if gen_match:
                tender_id = gen_match.group(0).upper()

    # 2. Title
    title = ""
    title_match = re.search(
        r"(?i)(?:Tender\s*Title|Name\s*of\s*(?:the\s*)?Work|Title\s*of\s*(?:the\s*)?Tender|Subject|Project\s*Title|Work\s*Description|Item\s*Description|Brief\s*Scope)\s*[:\-]\s*([^\n\r]+)",
        norm_text,
    )
    if title_match:
        cand_title = title_match.group(1).strip().strip('"\'')
        if len(cand_title) >= 5:
            title = cand_title[:120].strip()
    else:
        header_match = re.search(
            r"(?i)(?:INVITATION\s*FOR\s*BIDS\s*(?:FOR)?|NOTICE\s*INVITING\s*TENDER\s*(?:FOR)?|TENDER\s*FOR\s*(?:THE\s*)?(?:SUPPLY\s*OF)?|REQUEST\s*FOR\s*PROPOSAL\s*(?:FOR)?)\s*[:\-]?\s*([^\n\r]+)",
            norm_text,
        )
        if header_match:
            cand_title = header_match.group(1).strip().strip('"\'')
            if len(cand_title) >= 5:
                title = cand_title[:120].strip()

    # 3. Category
    category = "Goods"
    if re.search(r"(?i)\b(?:medical|hospital|healthcare|diagnostic|clinical|pharmaceutical|surgical|patient|ventilator)\b", norm_text):
        category = "Medical Devices"
    elif re.search(r"(?i)\b(?:software|cloud|telecom|network|cyber|server|computing|it\s*infrastructure|cyber\s*defense)\b", norm_text):
        category = "IT & Telecom"
    elif re.search(r"(?i)\b(?:works|construction|civil|infrastructure|building|renovation|road|pipeline)\b", norm_text):
        category = "Works & Infrastructure"
    elif re.search(r"(?i)\b(?:services|maintenance|facility|manpower|consultancy|consulting|security|housekeeping|annual\s*maintenance|amc)\b", norm_text):
        category = "Services"

    # 4. Description & Scope of Work
    description = ""
    desc_match = re.search(
        r"(?i)(?:Description\s*(?:&|and)?\s*Scope(?:\s*of\s*Work)?|Detailed\s*Scope(?:\s*of\s*Work)?|Scope\s*of\s*(?:Work|Contract|Supply)|Brief\s*Description|Work\s*Scope)\s*[:\-]\s*([^\n\r]+(?:\n[^\n\r]+){0,3})",
        norm_text,
    )
    if desc_match:
        cand_desc = desc_match.group(1).strip()
        lines = [l.strip() for l in cand_desc.split("\n") if l.strip() and not re.search(r"(?i)deadline|date|signature", l)]
        if lines:
            description = " ".join(lines)[:400].strip()
    if not description and title:
        description = f"Procurement scope and technical specifications for {title} as outlined in the tender notification."

    # 5. Submission Deadline
    deadline_str = ""
    dl_match = re.search(
        r"(?i)(?:Bid\s*Submission\s*End\s*Date|Submission\s*Deadline|Bid\s*Closing\s*Date|Last\s*Date\s*(?:&|and)?\s*Time\s*for\s*(?:Bid\s*)?Submission|Closing\s*Date|Due\s*Date|End\s*Date)\s*[:\-]?\s*([0-9]{1,2}[-/\.][0-9]{1,2}[-/\.][0-9]{2,4}|[0-9]{4}[-/\.][0-9]{1,2}[-/\.][0-9]{1,2}|[0-9]{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+[0-9]{4})",
        norm_text,
    )
    if dl_match:
        parsed_iso = parse_date_to_iso(dl_match.group(1))
        if parsed_iso:
            deadline_str = parsed_iso

    # 6. Mandatory Statutory Compliance Checks
    checks = []
    if re.search(r"(?i)\b(?:udyam|msme|micro\s*(?:and|&)?\s*small|udyam\s*registration)\b", norm_text):
        checks.append("udyam")
    if re.search(r"(?i)\b(?:gst|gstin|goods\s*and\s*services\s*tax|gst\s*registration)\b", norm_text):
        checks.append("gstn")
    if re.search(r"(?i)\b(?:pan|permanent\s*account\s*number|income\s*tax|itr)\b", norm_text):
        checks.append("pan_it")
    if re.search(r"(?i)\b(?:epfo|esic|provident\s*fund|employee(?:s)?\s*state\s*insurance|labor\s*compliance|labour\s*compliance)\b", norm_text):
        checks.append("epfo_esic")
    if re.search(r"(?i)\b(?:digilocker|digital\s*locker|cryptographic\s*verification)\b", norm_text):
        checks.append("digilocker")
    if re.search(r"(?i)\b(?:blacklist|blacklisted|debarment|debarred|non-debarment|central\s*debarment|vigilance)\b", norm_text):
        checks.append("blacklist")

    # Confidence calculation
    conf = 0
    if tender_id:
        conf += 30
    if title:
        conf += 25
    if category != "Goods" or re.search(r"(?i)\bgoods|equipment|supplies\b", norm_text):
        conf += 15
    if deadline_str:
        conf += 15
    if checks:
        conf += 15
    confidence = min(max(conf, 40 if (tender_id or title) else 0), 98)

    success = bool(tender_id or title)

    fields = {
        "tenderReferenceId": tender_id,
        "title": title,
        "category": category,
        "description": description,
        "submissionDeadline": deadline_str,
        "mandatoryChecks": checks,
        # Backward compatibility aliases
        "tender_id": tender_id,
        "deadline": deadline_str,
        "mandatory_checks": checks,
    }

    return {
        "text": raw_text,
        "fields": fields,
        "extractionMethod": method,
        "confidence": confidence,
        "success": success,
        "error": None if success else "Could not extract mandatory tender fields. Please fill manually.",
        # Backward compatibility aliases
        "extracted": {
            "tender_id": tender_id,
            "title": title,
            "category": category,
            "description": description,
            "deadline": deadline_str,
            "mandatory_checks": checks,
        },
        "source": f"local_{method}",
        "model": f"local_{method}",
    }


# =====================================================================
# FEATURE 2: LLM-Generated Recommendation Briefing & Fallback
# =====================================================================

def generate_deterministic_briefing_fallback(
    bidder_id: str,
    score: int,
    risk_level: str,
    checks: list[dict[str, Any]],
    pending_manual_review: list[str],
) -> dict[str, Any]:
    """Deterministic template fallback engine built strictly from existing check results."""
    mandatory_failed = [
        c["source"] for c in checks if c.get("is_mandatory") and c.get("status") == "non_compliant"
    ]
    mandatory_expired = [
        c["source"] for c in checks if c.get("is_mandatory") and c.get("status") == "expired"
    ]

    parts = []
    if mandatory_failed:
        parts.append(
            f"Bidder {bidder_id} demonstrates non-compliance in mandatory statutory check(s): {', '.join(mandatory_failed)}, resulting in an evaluated compliance score of {score}/100 with {risk_level} Risk."
        )
        parts.append(
            "The Procurement Officer should verify the specific registry discrepancies and consider requesting formal clarification under GFR Rule 173(iv) before taking disqualification action."
        )
    elif mandatory_expired:
        parts.append(
            f"Bidder {bidder_id} achieved a compliance score of {score}/100 ({risk_level} Risk), with registration expiry flagged for {', '.join(mandatory_expired)}."
        )
        parts.append(
            "The Officer should require the bidder to submit certified renewal certificates to regularize the standing prior to contract award."
        )
    elif pending_manual_review:
        parts.append(
            f"Bidder {bidder_id} was evaluated with a score of {score}/100 ({risk_level} Risk), while mandatory records in {', '.join(pending_manual_review)} were not located in primary registries and excluded from scoring."
        )
        parts.append(
            "Physical verification of self-attested exemption certificates is recommended to validate eligibility before the next procurement stage."
        )
    else:
        parts.append(
            f"Bidder {bidder_id} has satisfied all mandatory statutory checks for this tender with a high compliance score of {score}/100 ({risk_level} Risk)."
        )
        parts.append(
            "Automated verification records reflect active compliance; retain the audit snapshot for procurement committee review and proceed with standard technical evaluation."
        )

    return {
        "text": " ".join(parts),
        "source": "deterministic_fallback",
        "model": "rule_based_template",
        "is_fallback": True,
    }


def generate_officer_briefing(
    bidder_id: str,
    tender_id: str | None,
    score: int,
    risk_level: str,
    checks: list[dict[str, Any]],
    pending_manual_review: list[str],
    simulate_failure: bool = False,
) -> dict[str, Any]:
    """Generate a 2-3 sentence executive briefing for the procurement officer using Gemini with deterministic fallback."""
    if simulate_failure:
        # Explicitly triggers the fallback engine to prove fallback robustness
        fallback = generate_deterministic_briefing_fallback(bidder_id, score, risk_level, checks, pending_manual_review)
        fallback["notice"] = "Generated via Deterministic Template Fallback (Simulated API Failure Active)."
        return fallback

    api_key = get_gemini_api_key()
    if not api_key:
        fallback = generate_deterministic_briefing_fallback(bidder_id, score, risk_level, checks, pending_manual_review)
        fallback["notice"] = "Generated via Deterministic Template Fallback (GEMINI_API_KEY unconfigured)."
        return fallback

    # Format structured check summary for the prompt
    formatted_checks = []
    for c in checks:
        req_tag = "MANDATORY" if c.get("is_mandatory") else "INFORMATIONAL"
        formatted_checks.append(f"- [{req_tag}] {c['source']}: status={c['status']}, weight={c['weight_applied']}, note={c['note']}")
    checks_str = "\n".join(formatted_checks)

    system_instruction = (
        "You are the GeM Procurement AI Decision-Support Briefing Assistant. "
        "Your task is to provide an objective, high-density 2-3 sentence procurement officer briefing. "
        "STRICT CONSTRAINT: You are advisory only. You MUST NEVER declare a final decision (do NOT write 'This bid is approved', "
        "'This bid is rejected', or 'I recommend rejecting/accepting'). Describe the factual findings and suggest next verification steps. "
        "Keep your output strictly to 2-3 sentences in clear plain English."
    )

    prompt = f"""Evaluate this deterministic bid compliance evaluation:
Bidder ID: {bidder_id}
Tender ID: {tender_id or 'Standard Procurement'}
Deterministic Score: {score}/100
Risk Level: {risk_level}
Pending Manual Review: {pending_manual_review or 'None'}

Registry Checks:
{checks_str}

Provide a concise 2-3 sentence executive briefing for the Procurement Officer describing key findings and recommending specific next verification steps, without making the final approve/reject call."""

    try:
        briefing_text, used_model = call_gemini(
            prompt=prompt,
            system_instruction=system_instruction,
            json_mode=False,
            timeout=12.0,
        )
        return {
            "text": briefing_text.strip(),
            "source": "gemini_llm",
            "model": used_model,
            "is_fallback": False,
        }
    except Exception as e:
        fallback = generate_deterministic_briefing_fallback(bidder_id, score, risk_level, checks, pending_manual_review)
        fallback["notice"] = f"Generated via Deterministic Template Fallback (API error: {str(e)[:60]})."
        return fallback
