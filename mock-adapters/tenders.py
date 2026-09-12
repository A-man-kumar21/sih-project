"""Tender definitions and repository for GeM compliance evaluation."""

from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path

DEFAULT_TENDERS = {}

TENDERS = deepcopy(DEFAULT_TENDERS)

CUSTOM_TENDERS_FILE = Path(__file__).resolve().parent / "custom_tenders.json"


DELETED_TENDERS_FILE = Path(__file__).resolve().parent / "deleted_tenders.json"


def _load_deleted_tenders() -> set[str]:
    if DELETED_TENDERS_FILE.exists():
        try:
            with open(DELETED_TENDERS_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception as e:
            print(f"Notice: Failed to load deleted tenders: {e}")
    return set()


DELETED_TENDERS = _load_deleted_tenders()

# Purge any deleted tenders from active TENDERS
for d_id in DELETED_TENDERS:
    TENDERS.pop(d_id, None)


def _load_custom_tenders() -> None:
    if CUSTOM_TENDERS_FILE.exists():
        try:
            with open(CUSTOM_TENDERS_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                for k, v in saved.items():
                    if k not in DELETED_TENDERS:
                        TENDERS[k] = v
        except Exception as e:
            print(f"Notice: Failed to load custom tenders: {e}")


_load_custom_tenders()


def _save_custom_tenders() -> None:
    try:
        custom = {k: v for k, v in TENDERS.items() if k not in DEFAULT_TENDERS and k not in DELETED_TENDERS}
        with open(CUSTOM_TENDERS_FILE, "w", encoding="utf-8") as f:
            json.dump(custom, f, indent=2)
    except Exception as e:
        print(f"Notice: Failed to persist custom tenders: {e}")


def delete_tender(tender_id: str) -> bool:
    """Remove tender from active selectable list only without altering historical audit logs."""
    norm_id = tender_id.strip().upper()
    if norm_id in TENDERS:
        TENDERS.pop(norm_id, None)
        DELETED_TENDERS.add(norm_id)
        try:
            with open(DELETED_TENDERS_FILE, "w", encoding="utf-8") as f:
                json.dump(sorted(list(DELETED_TENDERS)), f, indent=2)
        except Exception as e:
            print(f"Notice: Failed to persist deleted tenders: {e}")
        _save_custom_tenders()
        return True
    return False


def get_all_tenders() -> list[dict]:
    """Return list of all registered tenders."""
    return list(TENDERS.values())


def get_tender(tender_id: str) -> dict | None:
    """Look up a tender by ID."""
    return TENDERS.get(tender_id.strip().upper())


def register_tender(
    tender_id: str,
    category: str,
    mandatory_checks: list[str],
    title: str = "",
    description: str = "",
) -> dict:
    """Register a new tender definition."""
    normalized_id = tender_id.strip().upper()
    tender = {
        "tender_id": normalized_id,
        "title": title.strip() or f"Procurement Tender {normalized_id}",
        "category": category.strip() or "General",
        "mandatory_checks": mandatory_checks,
        "description": description.strip() or f"Custom tender requiring: {', '.join(mandatory_checks)}",
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    TENDERS[normalized_id] = tender
    _save_custom_tenders()
    return tender
