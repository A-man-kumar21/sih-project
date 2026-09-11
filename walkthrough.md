# Local Deterministic Document Data Extraction Walkthrough

## Executive Overview
In accordance with procurement security, statutory confidentiality, and data sovereignty requirements, **all external LLMs (Gemini, Claude, OpenAI) and external OCR cloud APIs have been completely eliminated** from document data extraction in the **BidSetu** platform.

The extraction pipeline is now **100% local, offline, deterministic, and privacy-preserving**:
- **Text-based PDFs** are parsed instantaneously using **PyMuPDF** (`pymupdf`).
- **Scanned/image-only PDFs** and raster images (**PNG, JPG, JPEG**) are automatically routed to a high-speed local **PaddleOCR** (PP-OCRv4 ONNX engine) running on the local CPU without external network dependencies.
- Extracted text undergoes **NFKC Unicode normalization, OCR spacing rectification, and whitespace consolidation**.
- Statutory credentials (**PAN, GSTIN, Udyam Number, CIN, EPFO Code, ESIC Code, Enterprise Type, Business Constitution, Registered Address, Registration Date**) are extracted via deterministic regular expressions with structural format validation.
- All extracted fields populate the bidder's **Enterprise Profile** in MongoDB with complete **provenance tracking** (`source`, `extraction_method`, `confidence`, `source_doc_name`, `last_updated`).
- Bidder manual edits/overrides are preserved with `"Manual Entry"` provenance.
- The compliance scoring engine in `ai-engine/app/scoring.py` remains **strictly unmodified and deterministic**.

---

## 1. Local Extraction Architecture

```
                       Bidder Document Vault
                                 │
                 Upload PDF, PNG, JPG, or JPEG
                                 │
                                 ▼
                     Document Type & MIME Check
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
        PDF Document                          Raster Image
              │                                (PNG / JPG)
              ▼                                     │
     PyMuPDF Text Layer                             │
     Alphanumeric Count >= 30?                      │
        ├─── YES ───► PyMuPDF Direct Text           │
        │             (Method: "pymupdf")           │
        │                                           │
        └─── NO  ───► Render Page Pixmap ───────────┴──► PaddleOCR PP-OCRv4
                      (Local ONNX Engine)                 (Method: "paddleocr")
                                                                  │
                                 ┌────────────────────────────────┘
                                 ▼
                      Text Normalization Engine
             (NFKC Unicode, Dash/Quote Unification, OCR Spacing)
                                 │
                                 ▼
                 Deterministic Structural Extraction
              (PAN, GSTIN, Udyam, CIN, EPFO, ESIC, etc.)
                                 │
                                 ▼
                   Standardized Section 14 Output
             { text, fields, extractionMethod, confidence }
                                 │
                                 ▼
                 Backend Gateway & MongoDB Persistence
             (Enterprise Profile Merged + Provenance Recorded)
                                 │
                                 ▼
               Statutory Sync to Engine & Adapters
             (udyam.py, gstn.py, pan_it.py, epfo_esic.py)
                                 │
                                 ▼
                    Officer AI Cockpit & Scoring
             (Deterministic Score >= 80/100, Low Risk)
```

---

## 2. Key Components & Implementation Details

### A. AI Engine (`ai-engine/app/llm.py` & `main.py`)
- **`run_local_paddle_ocr(image_bytes)`**: Invokes the local PaddleOCR PP-OCRv4 model on CPU via `rapidocr-onnxruntime`. Zero external network calls.
- **`extract_text_and_method(file_bytes, filename, mime_type)`**:
  - Inspects file extension and MIME type.
  - If PDF: extracts text layer with PyMuPDF. If clean alphanumeric character count $\ge 30$, outputs directly with method `"pymupdf"`. If $< 30$ (scanned/image PDF), renders pages at 2.0x DPI resolution into PNG pixmaps and runs local PaddleOCR.
  - If Image (`.png`, `.jpg`, `.jpeg`): directly executes local PaddleOCR.
- **`normalize_text(text)`**:
  - Applies `unicodedata.normalize("NFKC", text)`.
  - Standardizes irregular hyphens/dashes (`-`, `–`, `—`, `−`), quotes, and newlines.
  - Rectifies OCR spaced characters (e.g. `P A N`, `U D Y A M`, `G S T I N`).
- **`deterministic_extract_fields(norm_text, raw_text, document_type)`**:
  - Extracts statutory identifiers using regex patterns.
  - Auto-derives PAN (chars 3 to 12) if GSTIN is present and validates cross-field consistency.
  - Normalizes Enterprise Type to canonical values (`"Micro"`, `"Small"`, `"Medium"`, `"Large"`).
  - Calculates confidence score ($0-100$).
- **`POST /extract-bidder-pdf`**:
  - Returns the exact Section 14 JSON structure:
    ```json
    {
      "text": "...",
      "fields": {
        "pan": "...",
        "gstin": "...",
        "udyam_number": "...",
        "cin": "...",
        "epfo_number": "...",
        "esic_number": "...",
        "company_name": "...",
        "registered_address": "...",
        "enterprise_type": "...",
        "business_constitution": "...",
        "registration_date": "..."
      },
      "extractionMethod": "pymupdf",
      "confidence": 95,
      "success": true,
      "error": null
    }
    ```

### B. Statutory Regex Specifications

| Attribute | Pattern | Format Rules | Validation Logic |
| :--- | :--- | :--- | :--- |
| **PAN** | `\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b` | 10 alphanumeric characters | 4th character must be valid entity code (`C`, `P`, `H`, `F`, `A`, `T`, `B`, `L`, `J`, `G`). Cross-checked with GSTIN. |
| **GSTIN** | `\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b` | 15 alphanumeric characters | 1st two digits are State Code ($01-38$). 13th is entity number, 14th is 'Z'. Contains embedded PAN. |
| **Udyam** | `\b(UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7})\b` | Standard MSME format | Begins with `UDYAM-`, followed by 2-letter state code, 2-digit district code, and 7-digit serial number. |
| **CIN** | `\b([LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6})\b` | 21 alphanumeric characters | 1st char `L` (Listed) or `U` (Unlisted), followed by 5-digit industry code, 2-letter state code, 4-digit incorporation year, 3-letter ownership (`PTC`, `PLC`, `GOI`), and 6-digit RoC sequence. |
| **EPFO** | `\b([A-Z]{2}/[A-Z]{3}/[0-9]{7}/[0-9]{3})\b` or `\b([A-Z]{5}[0-9]{17})\b` | Regional code or 22-char establishment code | 2-letter state office + 3-letter regional office + 7-digit establishment code + 3-digit extension. |
| **ESIC** | `\b([0-9]{17})\b` or `\b([0-9]{2}-[0-9]{2}-[0-9]{6}-[0-9]{3}-[0-9]{4})\b` | 17-digit insurance employer code | 17 digits representing regional office, district, and establishment index. |

---

## 3. Verification & Test Suite Results

### A. Dedicated Test Suite: `test_local_deterministic_extraction.mjs`
Run command: `node test_local_deterministic_extraction.mjs`
**Result: 45 / 45 Tests Passed (100%)**

```
================================================================================
BIDSETU: LOCAL DETERMINISTIC EXTRACTION (NO LLM / NO EXTERNAL API) VERIFICATION
================================================================================

--- PART 1: DIRECT AI-ENGINE LOCAL EXTRACTION ---
[PASS] Test 1: AI Engine extract text PDF returns 200 OK and success: true
[PASS] Test 2: Text PDF uses PyMuPDF (actual: pymupdf)
[PASS] Test 3: Extracted Udyam: UDYAM-MH-12-0077889
[PASS] Test 4: Extracted CIN: U72900MH2021PTC123456
[PASS] Test 5: Extracted EPFO: MH/BAN/0012345/000
[PASS] Test 6: Extracted Enterprise Type: Micro
[PASS] Test 7: Extraction confidence is high (actual: 95%)
[PASS] Test 8: AI Engine extract scanned PDF returns 200 OK and success: true
[PASS] Test 9: Scanned PDF falls back to PaddleOCR (actual: paddleocr)
[PASS] Test 10: Scanned PDF extracted Udyam: UDYAM-MH-12-0077889
[PASS] Test 11: AI Engine extract JPG returns 200 OK and success: true
[PASS] Test 12: JPG image uses PaddleOCR (actual: paddleocr)
[PASS] Test 13: Extracted GSTIN: 27AABCA1234A1Z5
[PASS] Test 14: Extracted/derived PAN from GSTIN: AABCA1234A
[PASS] Test 15: AI Engine extract PNG returns 200 OK and success: true
[PASS] Test 16: PNG image uses PaddleOCR (actual: paddleocr)
[PASS] Test 17: Extracted PAN: AABCA1234A

--- PART 2: END-TO-END BIDDER DOCUMENT VAULT & ENTERPRISE PROFILE ---
[PASS] Test 18: Registered fresh bidder successfully
[PASS] Test 19: Uploaded Udyam PDF to vault
[PASS] Test 20: Vault Udyam PDF extraction method is PyMuPDF
[PASS] Test 21: Uploaded GST JPG to vault
[PASS] Test 22: Vault GST JPG extraction method is PaddleOCR
[PASS] Test 23: Uploaded PAN PNG to vault
[PASS] Test 24: Vault PAN PNG extraction method is PaddleOCR
[PASS] Test 25: Fetched bidder enterprise profile
[PASS] Test 26: Profile Udyam auto-populated: UDYAM-MH-12-0077889
[PASS] Test 27: Profile GSTIN auto-populated: 27AABCA1234A1Z5
[PASS] Test 28: Profile PAN auto-populated: AABCA1234A
[PASS] Test 29: Profile CIN auto-populated: U72900MH2021PTC123456
[PASS] Test 30: Profile EPFO auto-populated: MH/BAN/0012345/000
[PASS] Test 31: Statutory credentials synchronized

--- PART 3: PERSISTENCE & MANUAL OVERRIDE ---
[PASS] Test 32: Profile persisted in MongoDB across re-login
[PASS] Test 33: PUT /api/bidder/profile succeeded
[PASS] Test 34: Manual override correctly reflects 'Manual Entry' provenance

--- PART 4: TENDER APPLICATION & AUTO-REUSE ---
[PASS] Test 35: Created Tender TENDER-DET-1789154819200
[PASS] Test 36: Fetched bidder tenders list with readiness
[PASS] Test 37: Bidder is ready to apply (all mandatory docs ready in vault)
[PASS] Test 38: All mandatory checks (Udyam, GSTN, PAN) recognized as Ready in Vault (Auto-Reused)
[PASS] Test 39: Tender application submitted successfully

--- PART 5: OFFICER COCKPIT & DETERMINISTIC SCORING ---
[PASS] Test 40: Officer cockpit lists submitted application
[PASS] Test 41: Compliance Score >= 80 (actual: 98/100)
[PASS] Test 42: Compliance Risk is LOW (actual: Low)
[PASS] Test 43: scoring.py preserved intact without modification

--- PART 6: NEGATIVE TEST - MISSING DOCUMENT BLOCKS APPLICATION ---
[PASS] Test 44: Missing documents blocks application with HTTP 400 (actual: 400)
[PASS] Test 45: Error message clearly indicates missing statutory documents: Application blocked: Missing mandatory compliance document(s).

================================================================================
VERIFICATION SUMMARY: 45/45 TESTS PASSED (100%)
================================================================================
```

### B. Comprehensive Regression Suite: `test_all_fixes.mjs`
Run command: `node test_all_fixes.mjs`
**Result: All 7 Validation Suites Passed Flawlessly**

- Branding & UI Cleanup: PASSED
- Tender Isolation & Creation: PASSED
- Document Vault Upload & Extraction: PASSED
- Document Endpoint Protection & Authentication: PASSED
- Tender Application & Deterministic Compliance Scoring: PASSED (Score 98/100, Risk: Low)
- Critical Tender Applicant Isolation: PASSED
- Officer Cockpit Evaluation & Governance Decisions: PASSED

### C. Frontend Production Build
Run command: `npm run build` in `frontend`
**Result: Built in 240ms with 0 errors.**
