"""LLM-assisted extraction and briefing service with deterministic fallbacks."""

from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import re
from typing import Any

from dotenv import load_dotenv
from pypdf import PdfReader
import requests

# Load environment variables from .env
_env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(_env_path)


def get_gemini_api_key() -> str:
    """Read Gemini API key from environment variable."""
    return os.environ.get("GEMINI_API_KEY", "").strip()


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract plain text from an uploaded PDF using pypdf."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages_text = []
    for page in reader.pages:
        extracted = page.extract_text()
        if extracted:
            pages_text.append(extracted)
    return "\n".join(pages_text).strip()


def call_gemini(prompt: str, system_instruction: str = "", json_mode: bool = False, timeout: float = 12.0) -> tuple[str, str]:
    """Call Google Gemini REST API. Raises exception if key missing, network error, or timeout.
    Returns (response_text, model_name).
    """
    api_key = get_gemini_api_key()
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured.")

    models_to_try = [
        os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.6-flash",
    ]
    seen = set()
    models = [m for m in models_to_try if m and not (m in seen or seen.add(m))]

    last_error = None
    for model_name in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        
        contents = [{"role": "user", "parts": [{"text": prompt}]}]
        payload: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 800,
            },
        }

        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        if json_mode:
            payload["generationConfig"]["responseMimeType"] = "application/json"

        headers = {"Content-Type": "application/json"}
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=timeout)
            if response.status_code == 200:
                data = response.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    continue
                text_parts = candidates[0].get("content", {}).get("parts", [])
                if not text_parts:
                    continue
                return text_parts[0].get("text", "").strip(), model_name
            else:
                last_error = f"Gemini API ({model_name}) returned status {response.status_code}: {response.text}"
        except Exception as e:
            last_error = str(e)
            continue

    raise RuntimeError(last_error or "Gemini API failed on all attempted models.")



# =====================================================================
# FEATURE 1: PDF Upload with LLM-Assisted Extraction
# =====================================================================

def heuristic_extract_bidder(text: str) -> dict[str, str]:
    """Deterministic regex extractor used when LLM is unavailable or unconfigured."""
    extracted = {
        "company_name": "",
        "udyam_number": "",
        "gstin": "",
        "pan": "",
        "epfo_esic_number": "",
    }

    # PAN regex: 5 letters, 4 digits, 1 letter
    pan_match = re.search(r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b", text)
    if pan_match:
        extracted["pan"] = pan_match.group(0)

    # GSTIN regex: 2 digits, 10-digit PAN, 1 char, Z, 1 char
    gstin_match = re.search(r"\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b", text)
    if gstin_match:
        extracted["gstin"] = gstin_match.group(0)

    # Udyam regex: UDYAM-XX-00-0000000
    udyam_match = re.search(r"\bUDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}\b", text, re.IGNORECASE)
    if udyam_match:
        extracted["udyam_number"] = udyam_match.group(0).upper()

    # EPFO establishment code pattern: e.g. MH/BAN/0012345/000 or DLCPM1234567000
    epfo_match = re.search(r"\b[A-Z]{2}(?:/[A-Z]{3}/[0-9]{7}/[0-9]{3}|[A-Z]{3}[0-9]{7,10})\b", text)
    if epfo_match:
        extracted["epfo_esic_number"] = epfo_match.group(0)

    # Company name pattern
    name_match = re.search(
        r"(?:Legal Name|Enterprise Name|Company Name|M/s\.?|Name of Firm)\s*[:\-]\s*([A-Za-z0-9\s,\.\-&]+(?:Private Limited|Pvt\.?\s*Ltd\.?|Limited|LLP|Enterprise|Enterprises|Solutions|Technologies|Works))",
        text,
        re.IGNORECASE,
    )
    if name_match:
        extracted["company_name"] = name_match.group(1).strip()
    else:
        # Fallback search for lines ending with Pvt Ltd / LLP
        alt_match = re.search(r"\b([A-Z][A-Za-z0-9\s,\.\-&]{3,50}(?:Private Limited|Pvt\.?\s*Ltd\.?|LLP|Limited))\b", text)
        if alt_match:
            extracted["company_name"] = alt_match.group(1).strip()

    return extracted


def extract_bidder_from_pdf(pdf_bytes: bytes, simulate_failure: bool = False) -> dict[str, Any]:
    """Extract candidate fields from an uploaded bidder PDF using LLM with heuristic fallback."""
    if simulate_failure:
        return {
            "success": False,
            "message": "Couldn't auto-extract, please fill manually (simulated failure).",
            "extracted": {},
        }

    try:
        raw_text = extract_text_from_pdf(pdf_bytes)
    except Exception as e:
        return {
            "success": False,
            "message": f"Could not read PDF file text ({str(e)}). Please fill manually.",
            "extracted": {},
        }

    if not raw_text.strip():
        return {
            "success": False,
            "message": "Couldn't auto-extract: PDF contains no readable text. Please fill manually.",
            "extracted": {},
        }

    # Attempt Gemini LLM Extraction
    prompt = f"""You are a procurement document parser for GeM (Government e-Marketplace, India).
Extract candidate registration fields from the following bidder document text:

--- DOCUMENT TEXT START ---
{raw_text[:4000]}
--- DOCUMENT TEXT END ---

Extract the following fields accurately. If a field is not mentioned, leave it as an empty string "".
- company_name: Legal name of the enterprise
- udyam_number: Udyam Registration Number (format: UDYAM-XX-00-0000000)
- gstin: 15-character Goods and Services Tax Identification Number
- pan: 10-character Permanent Account Number
- epfo_esic_number: EPFO establishment code or ESIC employer code

Respond with ONLY valid JSON:
{{
  "company_name": "string",
  "udyam_number": "string",
  "gstin": "string",
  "pan": "string",
  "epfo_esic_number": "string"
}}"""

    try:
        llm_response, used_model = call_gemini(
            prompt=prompt,
            system_instruction="You are an accurate, deterministic JSON extractor for Indian government compliance documents. Output only valid JSON.",
            json_mode=True,
            timeout=12.0,
        )
        parsed = json.loads(llm_response)
        return {
            "success": True,
            "source": "gemini_llm",
            "model": used_model,
            "extracted": {
                "company_name": parsed.get("company_name", "").strip(),
                "udyam_number": parsed.get("udyam_number", "").strip(),
                "gstin": parsed.get("gstin", "").strip(),
                "pan": parsed.get("pan", "").strip(),
                "epfo_esic_number": parsed.get("epfo_esic_number", "").strip(),
            },
            "raw_snippet": raw_text[:250],
        }
    except Exception as e:
        # Fallback to local heuristic extractor if LLM times out or missing key
        heuristic = heuristic_extract_bidder(raw_text)
        has_any = any(bool(v) for v in heuristic.values())
        if has_any:
            return {
                "success": True,
                "source": "heuristic_fallback",
                "model": "local_text_parser",
                "extracted": heuristic,
                "notice": f"Auto-extracted via local document parser (LLM unavailable: {str(e)[:60]}).",
                "raw_snippet": raw_text[:250],
            }
        return {
            "success": False,
            "message": "Couldn't auto-extract, please fill manually.",
            "extracted": {},
        }


def extract_tender_from_pdf(pdf_bytes: bytes, simulate_failure: bool = False) -> dict[str, Any]:
    """Extract candidate fields from an uploaded tender notice PDF using LLM with heuristic fallback."""
    if simulate_failure:
        return {
            "success": False,
            "message": "Couldn't auto-extract, please fill manually (simulated failure).",
            "extracted": {},
        }

    try:
        raw_text = extract_text_from_pdf(pdf_bytes)
    except Exception as e:
        return {
            "success": False,
            "message": f"Could not read PDF file text ({str(e)}). Please fill manually.",
            "extracted": {},
        }

    if not raw_text.strip():
        return {
            "success": False,
            "message": "Couldn't auto-extract: PDF contains no readable text. Please fill manually.",
            "extracted": {},
        }

    prompt = f"""You are a GeM tender document analyzer.
Extract the key tender parameters from the following tender notice text:

--- TENDER TEXT START ---
{raw_text[:4000]}
--- TENDER TEXT END ---

Extract:
- tender_id: Tender Reference ID / Bid Number (e.g. GEM/2026/B/123456 or TENDER-2026-...)
- title: Brief descriptive title of what is being procured
- category: One of ["Goods", "Services", "Works", "IT & Telecom"]
- mandatory_checks: Array of required compliance checks for this tender chosen from:
  ["udyam", "gstn", "pan_it", "epfo_esic", "digilocker", "blacklist"]
  Include a check ONLY if the text indicates it is mandatory or required.

Respond with ONLY valid JSON:
{{
  "tender_id": "string",
  "title": "string",
  "category": "string",
  "mandatory_checks": ["string"]
}}"""

    try:
        llm_response, used_model = call_gemini(
            prompt=prompt,
            system_instruction="You are an accurate, deterministic JSON extractor for Indian government procurement tenders. Output only valid JSON.",
            json_mode=True,
            timeout=12.0,
        )
        parsed = json.loads(llm_response)
        checks = [c for c in parsed.get("mandatory_checks", []) if c in {"udyam", "gstn", "pan_it", "epfo_esic", "digilocker", "blacklist"}]
        return {
            "success": True,
            "source": "gemini_llm",
            "model": used_model,
            "extracted": {
                "tender_id": parsed.get("tender_id", "").strip(),
                "title": parsed.get("title", "").strip(),
                "category": parsed.get("category", "Goods").strip(),
                "mandatory_checks": checks or ["udyam", "gstn", "pan_it", "blacklist"],
            },
            "raw_snippet": raw_text[:250],
        }
    except Exception as e:
        # Heuristic fallback for tenders
        tender_id_match = re.search(r"\b(?:GEM/\d{4}/[A-Z]/\d+|TENDER-[A-Za-z0-9\-]+)\b", raw_text)
        tender_id = tender_id_match.group(0) if tender_id_match else ""
        
        checks = ["gstn", "pan_it"]
        if re.search(r"\budyam|msme|micro|small\b", raw_text, re.IGNORECASE):
            checks.append("udyam")
        if re.search(r"\bepfo|provident|esic|labor|labour\b", raw_text, re.IGNORECASE):
            checks.append("epfo_esic")
        if re.search(r"\bblacklist|debar|vigilance\b", raw_text, re.IGNORECASE):
            checks.append("blacklist")

        category = "Goods"
        if re.search(r"\bservices|maintenance|facility|manpower\b", raw_text, re.IGNORECASE):
            category = "Services"
        elif re.search(r"\bworks|construction|civil|infrastructure\b", raw_text, re.IGNORECASE):
            category = "Works"
        elif re.search(r"\bsoftware|it|cloud|telecom\b", raw_text, re.IGNORECASE):
            category = "IT & Telecom"

        if tender_id or len(checks) > 2:
            return {
                "success": True,
                "source": "heuristic_fallback",
                "model": "local_text_parser",
                "extracted": {
                    "tender_id": tender_id,
                    "title": "Procurement Tender (Extracted from Document)",
                    "category": category,
                    "mandatory_checks": checks,
                },
                "notice": f"Auto-extracted via local document parser (LLM unavailable: {str(e)[:60]}).",
                "raw_snippet": raw_text[:250],
            }

        return {
            "success": False,
            "message": "Couldn't auto-extract, please fill manually.",
            "extracted": {},
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
