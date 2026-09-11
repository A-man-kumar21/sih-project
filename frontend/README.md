# React dashboard

The dashboard uses live gateway APIs only. First load verifies all four demo bidders through `POST /api/compliance/verify`; that reaches FastAPI and writes to MongoDB. The selected bidder's history comes from `GET /api/audit/:bidderId`, and explicit officer actions use `POST /api/audit/decision`.

Run FastAPI on port 8000 and the gateway on port 3001. Vite proxies `/api` to the gateway.
