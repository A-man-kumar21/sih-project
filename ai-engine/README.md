# AI Engine

Run after creating a virtual environment and installing `requirements.txt`:

```powershell
uvicorn app.main:app --reload --port 8000
```

## Verify bidder compliance

`POST /verify-compliance` takes a bidder and the source checks required by the
tender. All six adapters are called on every request; only listed required
checks receive their configured score weight.

```json
{
  "bidder_id": "BIDDER-ALPHA",
  "required_checks": ["udyam", "gstn", "pan_it", "epfo_esic", "digilocker", "blacklist"]
}
```

Default weights are blacklist 35, GSTN 25, Udyam 15, PAN/IT 15, EPFO/ESIC 5,
and DigiLocker 5. For required checks, compliance adds `weight × confidence`;
non-compliance and expired registrations subtract `weight × confidence`.
`not_found` is omitted from both the points and total available weight, and is
always returned in `pending_manual_review` with a manual-verification
recommendation.
