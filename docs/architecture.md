# Prototype architecture

## Components

| Component | Responsibility |
| --- | --- |
| React frontend | Procurement-officer workflow, evidence visibility, and explicit decisions |
| Express gateway | Browser-facing API, orchestration, and audit persistence |
| FastAPI AI engine | Evidence normalization, compliance checks, scoring, and recommendations |
| Adapter layer | Source-specific verification behind swappable interfaces |

## Prototype scoring policy

The AI engine scores only tender-required sources. It calls all adapters for
visibility, but unrequired checks have zero applied weight. Required compliant
checks add their confidence-scaled weight, while `non_compliant` and `expired`
checks subtract it. `not_found` data is excluded from the denominator and is
queued for manual review. A blacklist `non_compliant` result always sets risk
to High.

## Human decision principle

Scores and risk levels are recommendations only. The system must never automatically approve, reject, or debar a bidder; a procurement officer records every final decision.
