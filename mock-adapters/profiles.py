"""Deterministic demo profiles shared by all mock verification sources.

These records intentionally resemble normalized data a production adapter would
return after translating a source-specific government-portal response.
"""

from copy import deepcopy


PROFILES = {
    "BIDDER-ALPHA": {
        "display_name": "Aarohan Office Systems Private Limited",
        "scenario": "fully_compliant",
        "udyam": {
            "status": "compliant",
            "last_updated": "2026-08-29T10:15:00Z",
            "confidence": 0.98,
            "raw_fields": {
                "udyam_registration_number": "UDYAM-DL-05-0012345",
                "enterprise_name": "Aarohan Office Systems Private Limited",
                "registration_valid_until": "2029-03-31",
                "enterprise_category": "Small",
                "registration_active": True,
            },
        },
        "gstn": {
            "status": "compliant",
            "last_updated": "2026-08-31T18:00:00Z",
            "confidence": 0.99,
            "raw_fields": {
                "gstin": "07AABCA1234A1Z5",
                "legal_name": "Aarohan Office Systems Private Limited",
                "registration_status": "Active",
                "latest_return_period": "2026-07",
                "latest_return_filed": True,
                "filing_status": "Regular",
            },
        },
        "pan_it": {
            "status": "compliant",
            "last_updated": "2026-08-24T09:30:00Z",
            "confidence": 0.97,
            "raw_fields": {
                "pan": "AABCA1234A",
                "pan_status": "Active",
                "name_match": True,
                "income_tax_return_assessment_year": "2025-26",
                "income_tax_return_filed": True,
            },
        },
        "epfo_esic": {
            "status": "compliant",
            "last_updated": "2026-08-28T14:45:00Z",
            "confidence": 0.95,
            "raw_fields": {
                "epfo_establishment_id": "DLCPM1234567000",
                "epfo_contribution_status": "Paid",
                "esic_employer_code": "11001234560000999",
                "esic_contribution_status": "Paid",
                "latest_contribution_period": "2026-07",
            },
        },
        "digilocker": {
            "status": "compliant",
            "last_updated": "2026-08-30T12:20:00Z",
            "confidence": 0.96,
            "raw_fields": {
                "consent_status": "Granted",
                "identity_document_verified": True,
                "authorized_signatory_verified": True,
                "credential_issued_at": "2026-08-30T12:18:00Z",
            },
        },
        "blacklist": {
            "status": "compliant",
            "last_updated": "2026-09-01T06:00:00Z",
            "confidence": 0.93,
            "raw_fields": {
                "registry_match": False,
                "debarment_status": "Not listed",
                "registry_search_reference": "BLR-20260901-001",
            },
        },
    },
    "BIDDER-BRAVO": {
        "display_name": "Bharat Supplies and Services LLP",
        "scenario": "missing_gst_filing",
        "udyam": {
            "status": "compliant", "last_updated": "2026-08-20T11:00:00Z", "confidence": 0.97,
            "raw_fields": {"udyam_registration_number": "UDYAM-MH-19-0087654", "enterprise_name": "Bharat Supplies and Services LLP", "registration_valid_until": "2028-09-30", "enterprise_category": "Medium", "registration_active": True},
        },
        "gstn": {
            "status": "non_compliant", "last_updated": "2026-08-31T18:00:00Z", "confidence": 0.99,
            "raw_fields": {"gstin": "27AACFB5678K1Z2", "legal_name": "Bharat Supplies and Services LLP", "registration_status": "Active", "latest_return_period": "2026-07", "latest_return_filed": False, "filing_status": "Return overdue", "overdue_return_periods": ["2026-06", "2026-07"]},
        },
        "pan_it": {
            "status": "compliant", "last_updated": "2026-08-22T10:10:00Z", "confidence": 0.96,
            "raw_fields": {"pan": "AACFB5678K", "pan_status": "Active", "name_match": True, "income_tax_return_assessment_year": "2025-26", "income_tax_return_filed": True},
        },
        "epfo_esic": {
            "status": "compliant", "last_updated": "2026-08-27T13:00:00Z", "confidence": 0.94,
            "raw_fields": {"epfo_establishment_id": "MHBAN7654321000", "epfo_contribution_status": "Paid", "esic_employer_code": "31000987650000123", "esic_contribution_status": "Paid", "latest_contribution_period": "2026-07"},
        },
        "digilocker": {
            "status": "compliant", "last_updated": "2026-08-30T09:00:00Z", "confidence": 0.95,
            "raw_fields": {"consent_status": "Granted", "identity_document_verified": True, "authorized_signatory_verified": True, "credential_issued_at": "2026-08-30T08:59:00Z"},
        },
        "blacklist": {
            "status": "compliant", "last_updated": "2026-09-01T06:00:00Z", "confidence": 0.93,
            "raw_fields": {"registry_match": False, "debarment_status": "Not listed", "registry_search_reference": "BLR-20260901-002"},
        },
    },
    "BIDDER-CHARLIE": {
        "display_name": "Crestline Engineering Works",
        "scenario": "blacklisted",
        "udyam": {
            "status": "compliant", "last_updated": "2026-08-21T11:00:00Z", "confidence": 0.97,
            "raw_fields": {"udyam_registration_number": "UDYAM-KA-29-0043210", "enterprise_name": "Crestline Engineering Works", "registration_valid_until": "2028-12-31", "enterprise_category": "Small", "registration_active": True},
        },
        "gstn": {
            "status": "compliant", "last_updated": "2026-08-31T18:00:00Z", "confidence": 0.98,
            "raw_fields": {"gstin": "29AACFC9012P1Z8", "legal_name": "Crestline Engineering Works", "registration_status": "Active", "latest_return_period": "2026-07", "latest_return_filed": True, "filing_status": "Regular"},
        },
        "pan_it": {
            "status": "compliant", "last_updated": "2026-08-25T09:00:00Z", "confidence": 0.96,
            "raw_fields": {"pan": "AACFC9012P", "pan_status": "Active", "name_match": True, "income_tax_return_assessment_year": "2025-26", "income_tax_return_filed": True},
        },
        "epfo_esic": {
            "status": "compliant", "last_updated": "2026-08-28T12:00:00Z", "confidence": 0.94,
            "raw_fields": {"epfo_establishment_id": "KABAN1357911000", "epfo_contribution_status": "Paid", "esic_employer_code": "49000135790000456", "esic_contribution_status": "Paid", "latest_contribution_period": "2026-07"},
        },
        "digilocker": {
            "status": "compliant", "last_updated": "2026-08-30T10:00:00Z", "confidence": 0.96,
            "raw_fields": {"consent_status": "Granted", "identity_document_verified": True, "authorized_signatory_verified": True, "credential_issued_at": "2026-08-30T09:58:00Z"},
        },
        "blacklist": {
            "status": "non_compliant", "last_updated": "2026-09-01T06:00:00Z", "confidence": 0.99,
            "raw_fields": {"registry_match": True, "debarment_status": "Debarred", "debarment_authority": "Mock Central Procurement Registry", "debarment_reason": "Material breach of prior contract", "debarment_until": "2027-06-30", "registry_search_reference": "BLR-20260901-003"},
        },
    },
    "BIDDER-DELTA": {
        "display_name": "Disha Digital Solutions Private Limited",
        "scenario": "expired_udyam",
        "udyam": {
            "status": "expired", "last_updated": "2026-08-15T11:00:00Z", "confidence": 0.98,
            "raw_fields": {"udyam_registration_number": "UDYAM-UP-09-0076543", "enterprise_name": "Disha Digital Solutions Private Limited", "registration_valid_until": "2026-06-30", "enterprise_category": "Small", "registration_active": False},
        },
        "gstn": {
            "status": "compliant", "last_updated": "2026-08-31T18:00:00Z", "confidence": 0.98,
            "raw_fields": {"gstin": "09AACCD3456R1Z4", "legal_name": "Disha Digital Solutions Private Limited", "registration_status": "Active", "latest_return_period": "2026-07", "latest_return_filed": True, "filing_status": "Regular"},
        },
        "pan_it": {
            "status": "compliant", "last_updated": "2026-08-23T10:00:00Z", "confidence": 0.97,
            "raw_fields": {"pan": "AACCD3456R", "pan_status": "Active", "name_match": True, "income_tax_return_assessment_year": "2025-26", "income_tax_return_filed": True},
        },
        "epfo_esic": {
            "status": "compliant", "last_updated": "2026-08-28T12:00:00Z", "confidence": 0.94,
            "raw_fields": {"epfo_establishment_id": "UPKAN2468135000", "epfo_contribution_status": "Paid", "esic_employer_code": "67000246810000789", "esic_contribution_status": "Paid", "latest_contribution_period": "2026-07"},
        },
        "digilocker": {
            "status": "compliant", "last_updated": "2026-08-30T10:00:00Z", "confidence": 0.95,
            "raw_fields": {"consent_status": "Granted", "identity_document_verified": True, "authorized_signatory_verified": True, "credential_issued_at": "2026-08-30T09:58:00Z"},
        },
        "blacklist": {
            "status": "compliant", "last_updated": "2026-09-01T06:00:00Z", "confidence": 0.93,
            "raw_fields": {"registry_match": False, "debarment_status": "Not listed", "registry_search_reference": "BLR-20260901-004"},
        },
    },
}


def verify_profile(bidder_id: str, source: str) -> dict:
    """Return an isolated, normalized source result for a known bidder."""
    norm_id = (bidder_id or "").strip().upper()
    profile = PROFILES.get(norm_id)
    if profile is None:
        return {
            "source": source,
            "status": "not_found",
            "last_updated": "2026-09-01T06:00:00Z",
            "raw_fields": {"bidder_id": norm_id, "registry_match": False},
            "confidence": 0.0,
        }

    result = deepcopy(profile[source])
    return {"source": source, **result}


import json
from pathlib import Path
from datetime import datetime, timezone

CUSTOM_PROFILES_FILE = Path(__file__).resolve().parent / "custom_profiles.json"


DELETED_BIDDERS_FILE = Path(__file__).resolve().parent / "deleted_bidders.json"


def _load_deleted_bidders() -> set[str]:
    if DELETED_BIDDERS_FILE.exists():
        try:
            with open(DELETED_BIDDERS_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception as e:
            print(f"Notice: Failed to load deleted bidders: {e}")
    return set()


DELETED_BIDDERS = _load_deleted_bidders()

# Purge any deleted bidders from active PROFILES
for d_id in DELETED_BIDDERS:
    PROFILES.pop(d_id, None)


def _load_custom_profiles() -> None:
    if CUSTOM_PROFILES_FILE.exists():
        try:
            with open(CUSTOM_PROFILES_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                for k, v in saved.items():
                    if k not in DELETED_BIDDERS:
                        PROFILES[k] = v
        except Exception as e:
            print(f"Notice: Failed to load custom profiles: {e}")


_load_custom_profiles()


def _save_custom_profiles() -> None:
    try:
        # Persist only non-default bidders so default profiles stay pristine
        defaults = {"BIDDER-ALPHA", "BIDDER-BRAVO", "BIDDER-CHARLIE", "BIDDER-DELTA"}
        custom = {k: v for k, v in PROFILES.items() if k not in defaults and k not in DELETED_BIDDERS}
        with open(CUSTOM_PROFILES_FILE, "w", encoding="utf-8") as f:
            json.dump(custom, f, indent=2)
    except Exception as e:
        print(f"Notice: Failed to persist custom profiles: {e}")


def delete_bidder_profile(bidder_id: str) -> bool:
    """Remove bidder from the active selectable list only without altering historical audit logs."""
    norm_id = bidder_id.strip().upper()
    if norm_id in PROFILES:
        PROFILES.pop(norm_id, None)
        DELETED_BIDDERS.add(norm_id)
        try:
            with open(DELETED_BIDDERS_FILE, "w", encoding="utf-8") as f:
                json.dump(sorted(list(DELETED_BIDDERS)), f, indent=2)
        except Exception as e:
            print(f"Notice: Failed to persist deleted bidders: {e}")
        _save_custom_profiles()
        return True
    return False


import re

# Validation patterns for Indian statutory procurement registries
UDYAM_REGEX = re.compile(r"^UDYAM-[A-Z]{2}-[A-Z0-9]{2}-\d{7}$", re.IGNORECASE)
GSTIN_REGEX = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$", re.IGNORECASE)
PAN_REGEX = re.compile(r"^[A-Z]{5}\d{4}[A-Z]$", re.IGNORECASE)
EPFO_ESIC_REGEX = re.compile(r"^(?:[A-Z]{2}[A-Z0-9]{3}\d{7}\d{3}|[A-Z]{2}/[A-Z0-9\-_/]{4,30}|\d{15,17})$", re.IGNORECASE)



def register_bidder_profile(
    bidder_id: str,
    company_name: str,
    udyam_number: str = "",
    gstin: str = "",
    pan: str = "",
    epfo_esic_number: str = "",
    business_constitution: str = "",
    registered_address: str = "",
    registration_date: str = "",
    enterprise_type: str = "",
) -> dict:
    """Register a new bidder in the exact format consumable by all mock adapters.
    
    Any compliance source that has no real, validatable identifier (e.g. blank,
    placeholder, or garbage format) returns 'not_found' with 0.0 confidence,
    guaranteeing that unverifiable sources are excluded from the score into
    pending_manual_review rather than fabricated as compliant.
    """
    normalized_id = bidder_id.strip().upper()
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    u_clean = re.sub(r"\s+", "", udyam_number or "").replace("—", "-").replace("–", "-").upper()
    g_clean = re.sub(r"\s+", "", gstin or "").upper()
    p_clean = re.sub(r"\s+", "", pan or "").upper()
    e_clean = re.sub(r"\s+", "", epfo_esic_number or "").upper()

    # If PAN is empty but a valid GSTIN is present, auto-extract PAN from characters 3-12 of GSTIN
    if not p_clean and g_clean and GSTIN_REGEX.match(g_clean):
        p_clean = g_clean[2:12]

    has_valid_udyam = bool(u_clean and UDYAM_REGEX.match(u_clean))
    has_valid_gstin = bool(g_clean and GSTIN_REGEX.match(g_clean))
    has_valid_pan = bool(p_clean and PAN_REGEX.match(p_clean))
    has_valid_epfo = bool(e_clean and EPFO_ESIC_REGEX.match(e_clean))

    # Real enterprise identity anchor: requires at least one valid statutory identifier
    has_identity_anchor = has_valid_pan or has_valid_gstin

    if has_valid_udyam:
        udyam_data = {
            "status": "compliant",
            "last_updated": now_iso,
            "confidence": 0.98,
            "raw_fields": {
                "udyam_registration_number": u_clean,
                "enterprise_name": company_name.strip(),
                "registration_valid_until": "2029-03-31",
                "enterprise_category": enterprise_type or "Small",
                "registration_date": registration_date,
                "registered_address": registered_address,
                "business_constitution": business_constitution,
                "registration_active": True,
            },
        }
    else:
        udyam_data = {
            "status": "not_found",
            "last_updated": now_iso,
            "confidence": 0.0,
            "raw_fields": {"bidder_id": normalized_id, "registry_match": False, "provided_value": udyam_number.strip()},
        }

    if has_valid_gstin:
        gstn_data = {
            "status": "compliant",
            "last_updated": now_iso,
            "confidence": 0.99,
            "raw_fields": {
                "gstin": g_clean,
                "legal_name": company_name.strip(),
                "registration_status": "Active",
                "latest_return_period": "2026-07",
                "latest_return_filed": True,
                "filing_status": "Regular",
                "business_constitution": business_constitution,
                "registered_address": registered_address,
                "registration_date": registration_date,
            },
        }
    else:
        gstn_data = {
            "status": "not_found",
            "last_updated": now_iso,
            "confidence": 0.0,
            "raw_fields": {"bidder_id": normalized_id, "registry_match": False, "provided_value": gstin.strip()},
        }

    if has_valid_pan:
        pan_data = {
            "status": "compliant",
            "last_updated": now_iso,
            "confidence": 0.97,
            "raw_fields": {
                "pan": p_clean,
                "pan_status": "Active",
                "name_match": True,
                "income_tax_return_assessment_year": "2025-26",
                "income_tax_return_filed": True,
            },
        }
    else:
        pan_data = {
            "status": "not_found",
            "last_updated": now_iso,
            "confidence": 0.0,
            "raw_fields": {"bidder_id": normalized_id, "registry_match": False, "provided_value": pan.strip()},
        }

    if has_valid_epfo:
        epfo_data = {
            "status": "compliant",
            "last_updated": now_iso,
            "confidence": 0.95,
            "raw_fields": {
                "epfo_establishment_id": e_clean,
                "epfo_contribution_status": "Paid",
                "esic_employer_code": e_clean,
                "esic_contribution_status": "Paid",
                "latest_contribution_period": "2026-07",
            },
        }
    else:
        epfo_data = {
            "status": "not_found",
            "last_updated": now_iso,
            "confidence": 0.0,
            "raw_fields": {"bidder_id": normalized_id, "registry_match": False, "provided_value": epfo_esic_number.strip()},
        }

    # DigiLocker requires a verified PAN or GSTIN legal entity anchor
    if has_identity_anchor:
        digilocker_data = {
            "status": "compliant",
            "last_updated": now_iso,
            "confidence": 0.96,
            "raw_fields": {
                "consent_status": "Granted",
                "identity_document_verified": True,
                "authorized_signatory_verified": True,
                "credential_issued_at": now_iso,
            },
        }
    else:
        digilocker_data = {
            "status": "not_found",
            "last_updated": now_iso,
            "confidence": 0.0,
            "raw_fields": {"bidder_id": normalized_id, "registry_match": False, "reason": "No valid PAN or GSTIN to anchor document verification"},
        }

    # Central debarment / blacklist requires an identified entity anchor
    if has_identity_anchor:
        blacklist_data = {
            "status": "compliant",
            "last_updated": now_iso,
            "confidence": 0.93,
            "raw_fields": {
                "registry_match": False,
                "debarment_status": "Not listed",
                "registry_search_reference": f"BLR-REG-{normalized_id}",
            },
        }
    else:
        blacklist_data = {
            "status": "not_found",
            "last_updated": now_iso,
            "confidence": 0.0,
            "raw_fields": {"bidder_id": normalized_id, "registry_match": False, "reason": "Cannot query debarment registry for unanchored/unregistered entity"},
        }

    new_profile = {
        "display_name": company_name.strip(),
        "scenario": "registered_bidder",
        "business_constitution": business_constitution,
        "registered_address": registered_address,
        "registration_date": registration_date,
        "enterprise_type": enterprise_type,
        "udyam": udyam_data,
        "gstn": gstn_data,
        "pan_it": pan_data,
        "epfo_esic": epfo_data,
        "digilocker": digilocker_data,
        "blacklist": blacklist_data,
    }

    PROFILES[normalized_id] = new_profile
    _save_custom_profiles()
    return {"bidder_id": normalized_id, "display_name": company_name.strip(), "profile": new_profile}



def get_all_bidders() -> list[dict]:
    """Return all registered bidder summaries for the dashboard intake and selector."""
    bidders = []
    for bid, prof in PROFILES.items():
        bidders.append({
            "bidder_id": bid,
            "display_name": prof.get("display_name", bid),
            "scenario": prof.get("scenario", "standard"),
            "registered_fields": {
                "udyam": prof.get("udyam", {}).get("raw_fields", {}).get("udyam_registration_number", ""),
                "gstin": prof.get("gstn", {}).get("raw_fields", {}).get("gstin", ""),
                "pan": prof.get("pan_it", {}).get("raw_fields", {}).get("pan", ""),
                "epfo_esic": prof.get("epfo_esic", {}).get("raw_fields", {}).get("epfo_establishment_id", ""),
                "business_constitution": prof.get("business_constitution", ""),
                "registered_address": prof.get("registered_address", ""),
                "registration_date": prof.get("registration_date", ""),
                "enterprise_type": prof.get("enterprise_type", ""),
            },
        })
    return bidders

