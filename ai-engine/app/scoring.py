"""Compliance scoring and recommendation logic for the demo engine."""

from datetime import datetime, timezone
from pathlib import Path
import sys

# The adapter directory intentionally remains a standalone, pluggable package.
ADAPTER_DIRECTORY = Path(__file__).resolve().parents[2] / "mock-adapters"
if str(ADAPTER_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(ADAPTER_DIRECTORY))

import blacklist
import digilocker
import epfo_esic
import gstn
import pan_it
import udyam


ADAPTERS = {
    "udyam": udyam.verify,
    "gstn": gstn.verify,
    "pan_it": pan_it.verify,
    "epfo_esic": epfo_esic.verify,
    "digilocker": digilocker.verify,
    "blacklist": blacklist.verify,
}

# Default tender weights. They total 100 when every check is required.
CHECK_WEIGHTS = {
    "udyam": 15,
    "gstn": 25,
    "pan_it": 15,
    "epfo_esic": 5,
    "digilocker": 5,
    "blacklist": 35,
}


def evaluate_bidder(
    bidder_id: str,
    required_checks: list[str],
    tender_id: str | None = None,
    simulate_llm_failure: bool = False,
) -> dict:
    """Call all adapters and calculate a confidence-weighted compliance score."""
    required = set(required_checks)
    results = {source: verify(bidder_id) for source, verify in ADAPTERS.items()}
    checks = []
    pending_manual_review = []
    weighted_total = 0.0
    signed_points = 0.0

    for source, result in results.items():
        status = result["status"]
        confidence = result["confidence"]
        is_required = source in required
        weight = CHECK_WEIGHTS[source] if is_required else 0

        if not is_required:
            note = "not required for this tender; excluded from score"
        elif status == "compliant":
            weighted_total += weight
            signed_points += weight * confidence
            note = "verified compliant"
        elif status == "non_compliant":
            weighted_total += weight
            signed_points -= weight * confidence
            note = "non-compliance identified"
        elif status == "expired":
            weighted_total += weight
            signed_points -= weight * confidence
            note = "registration expired, not fundamentally non-compliant — may be renewable"
        else:  # not_found
            pending_manual_review.append(source)
            note = "requires manual verification; source record was not found and is excluded from score"

        checks.append({
            "source": source,
            "status": status,
            "confidence": confidence,
            "weight_applied": weight,
            "note": note,
            "is_mandatory": is_required,
        })

    # A failure is a confidence-scaled negative contribution; scores cannot be
    # negative. `not_found` checks are absent from both numerator and divisor.
    score = 0 if weighted_total == 0 else round(max(0.0, signed_points) / weighted_total * 100)

    # Pure deterministic risk level: Low (>=80), Medium (50-79), High (<50)
    # plus explicit override: blacklist non_compliant forces High
    blacklist_non_compliant = ("blacklist" in required) and (results["blacklist"]["status"] == "non_compliant")
    if blacklist_non_compliant or score < 50:
        risk_level = "High"
    elif score < 80:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    from .llm import generate_officer_briefing

    briefing = generate_officer_briefing(
        bidder_id=bidder_id,
        tender_id=tender_id,
        score=score,
        risk_level=risk_level,
        checks=checks,
        pending_manual_review=pending_manual_review,
        simulate_failure=simulate_llm_failure,
    )

    recommendations = _recommendations(checks, pending_manual_review, blacklist_non_compliant, required)
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "bidder_id": bidder_id,
        "tender_id": tender_id,
        "compliance_score": score,
        "risk_level": risk_level,
        "checks": checks,
        "pending_manual_review": pending_manual_review,
        "recommendations": recommendations,
        "llm_briefing": briefing,
        "audit_log_entry": {
            "timestamp": timestamp,
            "bidder_id": bidder_id,
            "tender_id": tender_id,
            "score": score,
            "risk_level": risk_level,
        },
    }


def _recommendations(checks: list[dict], pending: list[str], blacklist_non_compliant: bool, required: set[str]) -> list[str]:
    recommendations = []
    for source in pending:
        recommendations.append(f"{source} requires manual verification before a procurement decision.")
    for check in checks:
        if check["source"] not in required:
            continue
        if check["status"] == "non_compliant" and check["source"] != "blacklist":
            recommendations.append(f"Obtain corrective evidence for {check['source']} non-compliance.")
        if check["status"] == "expired":
            recommendations.append(f"Request a renewed registration for {check['source']}.")
    if blacklist_non_compliant:
        recommendations.append("Do not approve without resolving the debarment record through the competent authority.")
    if not recommendations:
        recommendations.append("All required automated checks are compliant; retain evidence for procurement officer review.")
    return recommendations

