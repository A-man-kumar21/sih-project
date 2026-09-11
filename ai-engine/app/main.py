from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from pydantic import BaseModel, Field
from pathlib import Path
import sys

# Ensure mock-adapters is discoverable
ADAPTER_DIRECTORY = Path(__file__).resolve().parents[2] / "mock-adapters"
if str(ADAPTER_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(ADAPTER_DIRECTORY))

from profiles import get_all_bidders, register_bidder_profile, delete_bidder_profile
from tenders import get_all_tenders, get_tender, register_tender, delete_tender
from .scoring import ADAPTERS, evaluate_bidder
from .llm import extract_bidder_from_pdf, extract_tender_from_pdf

app = FastAPI(title="GeM Bid Compliance AI Engine", version="0.1.0")


class ComplianceRequest(BaseModel):
    bidder_id: str = Field(min_length=1, examples=["BIDDER-ALPHA"])
    tender_id: str | None = None
    required_checks: list[str] | None = None
    simulate_llm_failure: bool = False


class BidderCreateRequest(BaseModel):
    bidder_id: str = Field(min_length=1, examples=["BIDDER-EPSILON"])
    company_name: str = Field(min_length=1, examples=["Pragati Green Tech Pvt Ltd"])
    udyam_number: str = Field(default="", examples=["UDYAM-TN-02-0056789"])
    gstin: str = Field(default="", examples=["33AABCP1234E1Z9"])
    pan: str = Field(default="", examples=["AABCP1234E"])
    epfo_esic_number: str = Field(default="", examples=["TN/MAS/0078901/000"])


class TenderCreateRequest(BaseModel):
    tender_id: str = Field(min_length=1, examples=["TENDER-2026-MED"])
    category: str = Field(min_length=1, examples=["Medical Equipment"])
    mandatory_checks: list[str] = Field(min_length=1, examples=[["udyam", "gstn", "pan_it", "blacklist"]])
    title: str = Field(default="")
    description: str = Field(default="")


@app.get("/health")
def health() -> dict:
    return {"service": "ai-engine", "status": "ready"}


@app.get("/bidders")
def list_bidders() -> list[dict]:
    return get_all_bidders()


@app.post("/bidders")
def create_bidder(request: BidderCreateRequest) -> dict:
    created = register_bidder_profile(
        bidder_id=request.bidder_id,
        company_name=request.company_name,
        udyam_number=request.udyam_number,
        gstin=request.gstin,
        pan=request.pan,
        epfo_esic_number=request.epfo_esic_number,
    )
    return {"status": "registered", "bidder": created}


@app.delete("/bidders/{bidder_id}")
def remove_bidder(bidder_id: str) -> dict:
    success = delete_bidder_profile(bidder_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Bidder '{bidder_id}' not found in active list.")
    return {"status": "deleted", "bidder_id": bidder_id.upper()}


@app.get("/tenders")
def list_tenders() -> list[dict]:
    return get_all_tenders()


@app.post("/tenders")
def create_tender(request: TenderCreateRequest) -> dict:
    unknown_sources = sorted(set(request.mandatory_checks) - set(ADAPTERS))
    if unknown_sources:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported mandatory checks: {', '.join(unknown_sources)}",
        )
    created = register_tender(
        tender_id=request.tender_id,
        category=request.category,
        mandatory_checks=request.mandatory_checks,
        title=request.title,
        description=request.description,
    )
    return {"status": "registered", "tender": created}


@app.delete("/tenders/{tender_id}")
def remove_tender(tender_id: str) -> dict:
    success = delete_tender(tender_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Tender '{tender_id}' not found in active list.")
    return {"status": "deleted", "tender_id": tender_id.upper()}


@app.post("/extract-bidder-pdf")
async def extract_bidder_pdf(
    file: UploadFile = File(...),
    simulate_failure: bool = Query(False),
) -> dict:
    content = await file.read()
    return extract_bidder_from_pdf(content, simulate_failure=simulate_failure)


@app.post("/extract-tender-pdf")
async def extract_tender_pdf(
    file: UploadFile = File(...),
    simulate_failure: bool = Query(False),
) -> dict:
    content = await file.read()
    return extract_tender_from_pdf(content, simulate_failure=simulate_failure)


@app.post("/verify-compliance")
def verify_compliance(request: ComplianceRequest) -> dict:
    checks = request.required_checks
    if checks is None or len(checks) == 0:
        if request.tender_id:
            tender = get_tender(request.tender_id)
            if not tender:
                raise HTTPException(
                    status_code=404,
                    detail=f"Tender '{request.tender_id}' not found.",
                )
            checks = tender["mandatory_checks"]
        else:
            checks = list(ADAPTERS.keys())

    unknown_sources = sorted(set(checks) - set(ADAPTERS))
    if unknown_sources:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported required checks: {', '.join(unknown_sources)}",
        )
    return evaluate_bidder(
        bidder_id=request.bidder_id,
        required_checks=checks,
        tender_id=request.tender_id,
        simulate_llm_failure=request.simulate_llm_failure,
    )
