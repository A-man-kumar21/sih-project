"""Mock PAN and income-tax verification adapter."""
from profiles import verify_profile


def verify(bidder_id: str) -> dict:
    return verify_profile(bidder_id, "pan_it")
