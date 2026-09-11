# Mock adapters

Python-oriented mock integrations for the FastAPI engine. Each source module
exports exactly one public function:

```python
verify(bidder_id: str) -> dict
```

Every call returns this normalized contract:

```json
{
  "source": "gstn",
  "status": "compliant",
  "last_updated": "2026-08-31T18:00:00Z",
  "raw_fields": {},
  "confidence": 0.99
}
```

Permitted statuses are `compliant`, `non_compliant`, `not_found`, and
`expired`. `profiles.py` is the only fixture registry; adapters contain no
source-specific scoring logic.

## Demo bidders

| Bidder ID | Scenario |
| --- | --- |
| `BIDDER-ALPHA` | Fully compliant |
| `BIDDER-BRAVO` | Active GST registration but overdue GST returns |
| `BIDDER-CHARLIE` | Debarred in the blacklist registry |
| `BIDDER-DELTA` | Expired Udyam registration |

Unknown IDs return `not_found` from all sources. The later FastAPI service can
add this directory to `sys.path` and import source modules directly, e.g.
`import gstn; gstn.verify("BIDDER-ALPHA")`.
