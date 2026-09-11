# Express API gateway

## Configuration

Copy `.env.example` to `.env` in this directory and provide a MongoDB URI. The
gateway uses MongoDB because it stays within the MERN stack and avoids adding a
separate persistence tool for the prototype.

## API

- `POST /api/compliance/verify` — proxies `{ bidder_id, required_checks }` to
  FastAPI, writes an audit record, and returns the AI response unchanged.
- `POST /api/audit/decision` — accepts `{ bidder_id, decision, officer_id }`.
  Decisions are only `approve`, `reject`, or `request_more_info`; this route
  only writes the officer fields, never score/risk fields.
- `GET /api/audit/:bidderId` — returns all scoring-run audit records for a
  bidder, newest first.

Each scoring record permanently separates AI assessment fields
(`compliance_score`, `risk_level`, `pending_manual_review`) from human fields
(`officer_decision`, `officer_id`).
