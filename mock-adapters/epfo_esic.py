"""Mock EPFO and ESIC contribution verification adapter."""
from profiles import verify_profile


def verify(bidder_id: str) -> dict:
    return verify_profile(bidder_id, "epfo_esic")
