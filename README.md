# AI-Powered Integrated Bid Compliance Verification Platform for GeM Procurement

[![SIH 2026](https://img.shields.io/badge/SIH-2026%20Prototype-orange.svg)](https://www.sih.gov.in/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.1.0-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![Express.js](https://img.shields.io/badge/Express-4.x-black.svg?logo=express)](https://expressjs.com)
[![React](https://img.shields.io/badge/React-18.x-61DAFB.svg?logo=react)](https://react.dev)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-47A248.svg?logo=mongodb)](https://www.mongodb.com)
[![Google Gemini](https://img.shields.io/badge/Gemini%20API-3.5%20Flash-4285F4.svg?logo=google)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


> **Smart India Hackathon (SIH 2026) Prototype.**  
> **Problem Statement:** AI-Powered Integrated Bid Compliance Verification Platform for Government e-Marketplace (GeM) Procurement.

live - https://bid-compliance-verification-platfor-kappa.vercel.app/

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [System Architecture](#system-architecture)
- [Key Features](#key-features)
- [Mathematical Scoring Rubric](#mathematical-scoring-rubric)
- [Statutory Compliance Sources](#statutory-compliance-sources)
- [Project Layout](#project-layout)
- [Prerequisites & Environment Configuration](#prerequisites--environment-configuration)
- [Installation & Quick Start](#installation--quick-start)
- [API Reference](#api-reference)
- [End-to-End Verification Suite](#end-to-end-verification-suite)
- [Production Roadmap (Real API Transition)](#production-roadmap-real-api-transition)

---

## Executive Summary

Public procurement on the **Government e-Marketplace (GeM)** requires procurement officers to manually cross-verify vendor credentials across fragmented, disparate government portals:
- **Udyam / MSME Registration Portal** (MSE status, turnover category, enterprise validity)
- **GSTN Portal** (Active GSTIN status, 3B/GSTR-1 tax filing cadence)
- **Income Tax Department / PAN** (PAN validity, ITR filing compliance)
- **EPFO & ESIC Registries** (Establishment codes, active labor contribution remittances)
- **DigiLocker Ecosystem** (Cryptographically signed enterprise credentials)
- **Central Vigilance Commission / Debarment Registry** (Blacklist & debarment clearance)

### The Problem
Procurement officers spend days switching between portals, downloading certificates, manually cross-checking identification numbers, and evaluating complex tender conditions. This process is time-consuming, prone to human error, and susceptible to forged documents.

### The Solution
This platform provides an **AI-assisted, human-in-the-loop decision-support cockpit**:
1. **Automated Verification**: Queries pluggable adapters that interface with all 6 statutory registries.
2. **Confidence-Weighted Scoring**: Evaluates compliance on a transparent 100-point scale scaled by registry verification confidence.
3. **Deterministic Risk Governance**: Strict, mathematical risk classification (Low $\ge 80$, Medium $50-79$, High $< 50$) with an unconditional override for debarred entities.
4. **Multimodal Document Intake**: Ingests vendor certificates and tender notice PDFs using Google Gemini LLM with automatic regex/heuristic fallback.
5. **AI Officer Briefing**: Generates objective 2–3 sentence executive briefings summarizing registry discrepancies.
6. **Strict Human Governance**: The AI is **advisory only**. Procurement officers record final decisions (`Approve`, `Reject`, `Request More Info`), which are immutably logged into MongoDB Atlas with tamper-evident button locking.

---

## System Architecture

The platform is designed with clear microservice boundaries ensuring high availability, auditable persistence, and zero vendor lock-in:

```
                                  +---------------------------------------+
                                  |         Procurement Officer           |
                                  |    (Web Browser / React Dashboard)    |
                                  +---------------------------------------+
                                                      |
                                                      | HTTP / REST (Port 5173 -> 3001)
                                                      v
                                  +---------------------------------------+
                                  |        Backend Gateway (Express)      |
                                  | - Orchestration & Input Validation    |
                                  | - Audit Log Persistence (MongoDB)     |
                                  | - File Upload Handling (Multer)       |
                                  +---------------------------------------+
                                           /                     \
                      Audit Writes & Reads/                       \ Proxy & Enrich
                                         v                         v
       +------------------------------------+    +----------------------------------+
       |       MongoDB Atlas Collection     |    |      FastAPI AI Engine (Python)  |
       |     `compliance_audit_trail`       |    | - 100-Point Scoring Rubric       |
       | - Immutable evaluation snapshots   |    | - Deterministic Risk Calculator  |
       | - Officer decisions & timestamps   |    | - Gemini LLM PDF Parser          |
       | - Audit preservation on deletion   |    | - Executive Briefing Generator   |
       +------------------------------------+    +----------------------------------+
                                                                   |
                                                    Direct In-Process Interface
                                                    verify(bidder_id) -> dict
                                                                   v
                                                 +----------------------------------+
                                                 |     Pluggable Adapter Layer      |
                                                 | - udyam.py     | - epfo_esic.py  |
                                                 | - gstn.py      | - digilocker.py |
                                                 | - pan_it.py    | - blacklist.py  |
                                                 +----------------------------------+
```

### Communication Flow
1. **Frontend (`frontend/`)**: React 18 + Vite application delivering both an **Overview Cockpit** (fleet-wide analytics) and an in-depth **Technical Evaluation Detail View**.
2. **Backend Gateway (`backend-gateway/`)**: Node.js Express server handling API routing, input sanitation, PDF multipart streaming, and direct communication with MongoDB Atlas.
3. **AI Engine (`ai-engine/`)**: FastAPI service executing deterministic scoring math, statutory rule validation, and Google Gemini integration.
4. **Adapter Layer (`mock-adapters/`)**: Standalone module exposing standard Python contracts. Ready to be replaced by live government APIs without altering the core scoring engine.

---

## Key Features

### 1. Confidence-Weighted Compliance Engine
- **Deterministic 100-Point Scale**: Checks contribute positive points if compliant, negative points if non-compliant or expired.
- **Confidence Scaling**: Scores account for registry confidence (e.g. 0.93–0.99) rather than naively assuming 100% certainty.
- **Unverified Source Isolation**: Unverified records (`not_found`) are excluded from both the numerator and divisor, automatically routed to `pending_manual_review` for officer inspection.

### 2. Tender-Specific Compliance Scoping
- Evaluates bidders dynamically against tender mandates (e.g. *Goods Tenders* prioritize MSE/Udyam; *Service Tenders* mandate EPFO/ESIC labor compliance).
- Unrequired checks are flagged as **Informational** (0 applied weight) and excluded from the score.
- Includes a responsive **Tender Information Panel** in the UI detailing the scope, category, and a color-coded 6-source requirement grid.

### 3. Human-in-the-Loop Decision Governance
- **Advisory AI**: The AI never approves or rejects bids automatically.
- **Tamper-Evident Locking**: When an officer records an `Approve`, `Reject`, or `Request More Info` decision, the decision banner permanently locks for that evaluation run.
- **Audit Preservation**: Deleting a bidder or tender from the active dashboard soft-deletes them from selectable views while preserving 100% of past MongoDB audit log entries.

### 4. Multimodal PDF Intake with Google Gemini
- **Bidder & Tender PDF Upload**: Upload vendor registration certificates or tender notices directly in the registration modal.
- **Fast Extraction**: Powered by `pypdf` + `gemini-3.5-flash-lite` (with automatic fallback to regex heuristics if offline or unconfigured).
- **Pre-fill Review**: Extracted fields are populated into form inputs for human verification prior to submission—no automatic form submission.

### 5. Procurement Officer Executive Briefing
- In addition to structured statutory data, the AI generates a concise 2–3 sentence briefing outlining critical findings, discrepancies, and recommended GFR verification steps.
- Built-in rule-based template fallback ensures continuous service even during external network outages.

---

## Mathematical Scoring Rubric

Each statutory compliance check is assigned a baseline statutory weight summing to 100:

| Compliance Source | Statutory Check | Base Weight ($w_i$) | Typical Confidence ($c_i$) |
|:---|:---|:---:|:---:|
| `blacklist` | Debarment & Vigilance Clearance | **35** | 0.93 |
| `gstn` | GSTN Active Status & Filing Cadence | **25** | 0.99 |
| `udyam` | Udyam / MSME Registration Validity | **15** | 0.98 |
| `pan_it` | PAN / Income Tax Return Compliance | **15** | 0.97 |
| `epfo_esic` | EPFO & ESIC Labor Remittance | **5** | 0.95 |
| `digilocker` | DigiLocker Credential Provenance | **5** | 0.96 |
| **Total** | **All 6 Checks Mandatory** | **100** | — |

### Evaluation Formula
For all checks required by the active tender:
$$\text{Weighted Denominator } W = \sum_{i \in \text{Required} \setminus \{\text{not\_found}\}} w_i$$

$$\text{Signed Numerator } S = \sum_{i \in \text{Compliant}} (w_i \times c_i) - \sum_{j \in \text{NonCompliant} \cup \text{Expired}} (w_j \times c_j)$$

$$\text{Final Compliance Score} = \begin{cases} 0 & \text{if } W = 0 \\ \operatorname{round}\left(\frac{\max(0, S)}{W} \times 100\right) & \text{if } W > 0 \end{cases}$$

### Why Fully Verified Demo Bidders Score 96/100
For `BIDDER-ALPHA` (all 6 checks verified compliant):
$$\begin{aligned}
S &= (15 \times 0.98) + (25 \times 0.99) + (15 \times 0.97) + (5 \times 0.95) + (5 \times 0.96) + (35 \times 0.93) \\
  &= 14.70 + 24.75 + 14.55 + 4.75 + 4.80 + 32.55 = 96.10 \\
\text{Score} &= \operatorname{round}(96.10 / 100 \times 100) = \mathbf{96}
\end{aligned}$$
*This score reflects verification confidence; not all government checks report 100% certainty.*

### Deterministic Risk Classification
Risk levels are a pure, deterministic function of score with one statutory override:
- **Low Risk**: $\text{Score} \ge 80$ (and blacklist status is NOT `non_compliant`)
- **Medium Risk**: $50 \le \text{Score} < 80$ (and blacklist status is NOT `non_compliant`)
- **High Risk**: $\text{Score} < 50$ **OR** Blacklist status is `non_compliant` (forces High Risk regardless of score)

---

## Statutory Compliance Sources

| Source Identifier | Name | Verification Scope | Status Values |
|:---|:---|:---|:---|
| `udyam` | Udyam / MSME Portal | Validates 19-digit Udyam number (`UDYAM-XX-00-0000000`), micro/small/medium category, and registration active date. | `compliant`, `expired`, `not_found` |
| `gstn` | GSTN Tax Registry | Validates 15-character GSTIN (`22AAAAA0000A1Z5`), active filing status, and returns cadence (GSTR-3B). | `compliant`, `non_compliant`, `not_found` |
| `pan_it` | Income Tax / PAN | Validates 10-character PAN format, legal name match, and consecutive annual ITR filings. | `compliant`, `non_compliant`, `not_found` |
| `epfo_esic` | Ministry of Labour | Validates establishment code format and regular monthly PF/ESI remittances for employees. | `compliant`, `non_compliant`, `not_found` |
| `digilocker` | DigiLocker National Locker | Validates cryptographically signed corporate documents and certificate hashes. | `compliant`, `non_compliant`, `not_found` |
| `blacklist` | CVC / GeM Debarment | Checks central debarment registers. Non-compliance immediately halts bid eligibility. | `compliant`, `non_compliant`, `not_found` |

---

## Project Layout

```
ai_proc/
├── ai-engine/                        # FastAPI AI Service
│   ├── app/
│   │   ├── main.py                   # FastAPI REST endpoints & routes
│   │   ├── scoring.py                # 100-point scoring algorithm & risk tiers
│   │   └── llm.py                    # Gemini PDF extraction & briefing generator
│   ├── requirements.txt              # Python dependencies (fastapi, uvicorn, pypdf, etc.)
│   └── .env                          # Engine environment variables
├── backend-gateway/                  # Express.js API Gateway
│   ├── src/
│   │   ├── server.js                 # API routes, proxying, multer uploads
│   │   └── db.js                     # MongoDB connection & indexing
│   ├── package.json                  # Node dependencies (express, mongodb, multer, etc.)
│   └── .env                          # Gateway configuration (ports, Mongo URI)
├── frontend/                         # React 18 + Vite User Interface
│   ├── src/
│   │   ├── App.jsx                   # Procurement officer cockpit & technical detail view
│   │   ├── styles.css                # Polished design system (dark/light, badges, modals)
│   │   └── main.jsx                  # React entry point
│   ├── package.json                  # Frontend dependencies
│   └── vite.config.js                # Vite build configuration
├── mock-adapters/                    # Swappable Government Portal Integrations
│   ├── profiles.py                   # Verified demo profiles & custom profile storage
│   ├── tenders.py                    # Default and custom tender definitions
│   ├── udyam.py                      # Udyam adapter (verify(bidder_id))
│   ├── gstn.py                       # GSTN adapter
│   ├── pan_it.py                     # PAN & Income Tax adapter
│   ├── epfo_esic.py                  # EPFO & ESIC adapter
│   ├── digilocker.py                 # DigiLocker adapter
│   └── blacklist.py                  # Debarment registry adapter
├── docs/                             # Architecture & Integration Guides
│   ├── architecture.md               # Detailed system boundaries & policies
│   └── real-api-integration.md       # Roadmap for live API transition
├── verify_e2e.mjs                    # End-to-end integration test suite
├── test_two_bugs.mjs                 # Fraudulent vendor vs verified vendor tests
├── test_issue1_2_3.mjs               # Deterministic risk consistency tests
├── create_sample_pdf.py              # Generator for sample bidder test PDFs
├── create_sample_tender_pdf.py       # Generator for sample tender notice test PDFs
└── README.md                         # Project documentation
```

---

## Prerequisites & Environment Configuration

### Prerequisites
- **Node.js**: v18.x or higher
- **Python**: v3.10 or higher
- **MongoDB**: Active MongoDB Atlas instance (or local MongoDB on port 27017)
- **Google Gemini API Key**: Free tier or standard Gemini API key ([Google AI Studio](https://aistudio.google.com/))

### Environment Configuration

#### 1. Backend Gateway (`backend-gateway/.env`)
```env
PORT=3001
AI_ENGINE_URL=http://127.0.0.1:8000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.vggmzwk.mongodb.net/?appName=Cluster0
MONGODB_DB_NAME=gem_bid_compliance
GEMINI_API_KEY=your_gemini_api_key_here
```

#### 2. AI Engine (`ai-engine/.env`)
```env
PORT=8000
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## Installation & Quick Start

### Step 1: Clone Repository & Install Root Dependencies
```bash
git clone <repository_url>
cd ai_proc
npm install
```

### Step 2: Set Up Python AI Engine
```bash
cd ai-engine
python -m venv .venv

# Activate virtual environment:
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# On macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
cd ..
```

### Step 3: Install Subproject Dependencies
```bash
# Install gateway dependencies
cd backend-gateway
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Step 4: Run Services Concurrently
Open three terminal windows (or tabs) to run each service:

**Terminal 1 — FastAPI AI Engine:**
```bash
cd ai-engine
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 — Express Gateway:**
```bash
cd backend-gateway
node src/server.js
```

**Terminal 3 — React Dashboard:**
```bash
cd frontend
npm run dev
```

Open your browser to `http://localhost:5173` to access the Procurement Officer Cockpit.

---

## API Reference

### Backend Gateway Endpoints (Port 3001)

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/api/overview?tender_id={id}` | Fetches fleet-wide analytics and all active bidder scoring summaries. |
| `GET` | `/api/bidders` | Lists all active bidders. |
| `POST` | `/api/bidders` | Registers a new bidder profile into the registry. |
| `DELETE` | `/api/bidders/:bidderId` | Soft-deletes bidder from active dashboard (audit trail preserved). |
| `GET` | `/api/tenders` | Lists all configured procurement tenders. |
| `POST` | `/api/tenders` | Creates a new tender with custom mandatory checks. |
| `DELETE` | `/api/tenders/:tenderId` | Soft-deletes tender from active dashboard. |
| `POST` | `/api/compliance/verify` | Evaluates bidder against tender; logs evaluation snapshot to MongoDB. |
| `POST` | `/api/audit/decision` | Records officer decision (`approve`, `reject`, `request_more_info`). |
| `GET` | `/api/audit/:bidderId` | Returns complete immutable audit history for a bidder. |
| `POST` | `/api/extract/bidder-pdf` | Ingests bidder PDF; returns extracted statutory fields via Gemini. |
| `POST` | `/api/extract/tender-pdf` | Ingests tender notice PDF; returns parameters via Gemini. |

### AI Engine Endpoints (Port 8000)

| Method | Endpoint | Request Body | Description |
|:---|:---|:---|:---|
| `POST` | `/verify-compliance` | `{"bidder_id": "...", "tender_id": "...", "required_checks": [...]}` | Evaluates confidence score, risk tier, recommendations, and AI briefing. |
| `POST` | `/extract-bidder-pdf` | `multipart/form-data (file)` | Extracts enterprise name, GSTIN, PAN, Udyam, EPFO numbers. |
| `POST` | `/extract-tender-pdf` | `multipart/form-data (file)` | Extracts tender ID, title, category, and mandatory checks. |

---

## End-to-End Verification Suite

The repository includes comprehensive automated test suites verifying all critical behaviors:

### Run Complete Verification Suite:
```bash
# 1. Deterministic Risk Consistency & Score Mathematics Test
node test_issue1_2_3.mjs

# 2. Fraudulent vs Verified Bidders & PDF Extraction Test
node test_two_bugs.mjs

# 3. Full End-to-End Audit Preservation & Soft Delete Test
node verify_e2e.mjs
```

### Key Validated Invariants
1. **Mathematical Determinism**: Two bidders with identical compliance scores always receive identical risk ratings unless debarment overrides it.
2. **Fraudulent Vendor Resistance**: Bidders registered with blank/fake identifiers score `0/100 (High Risk)` because unverified sources return `not_found` rather than synthetic compliance.
3. **Audit Immutability**: Soft-deleting a bidder removes them from selectable menus but leaves 100% of their MongoDB audit log history intact and queryable.
4. **Decision Locking**: Once recorded, an officer decision permanently binds to that scoring snapshot and cannot be silently overwritten.

---

## Production Roadmap (Real API Transition)

The architecture is deliberately structured so that transitioning from mock adapters to live Government APIs requires zero modifications to the AI scoring engine or React dashboard:

```
+--------------------------+                 +------------------------------------+
|  FastAPI Scoring Engine  |                 |      Production Adapter Impl       |
+--------------------------+                 +------------------------------------+
             |                                                 |
             | verify(bidder_id)                               | Authenticate with OAuth2 / API Key
             v                                                 | Query Gov Gateway (DigiLocker / GSTN)
+--------------------------+                 +------------------------------------+
|  Adapter Seam Interface  | --------------> |  Production Government Registries  |
| (Single contract output) |                 | - GSTN GSP API                     |
+--------------------------+                 | - DigiLocker Enterprise API        |
                                             | - EPFO Shram Suvidha API           |
                                             | - Central Vigilance Commission API |
                                             +------------------------------------+
```

### Production Adapter Requirements
When transitioning to production:
1. **Consent & Credentials**: Replace local fixtures with digital signature verification (e-Sign/DigiLocker Consent Artifacts).
2. **Rate Limiting & Caching**: Introduce Redis caching to store authenticated government responses within statutory validity windows (e.g. 24 hours).
3. **Error Isolation**: Differentiate network connectivity errors (`service_unavailable`) from true statutory non-compliance (`non_compliant`).
4. **Audit Cryptography**: Sign each MongoDB audit entry with HMAC or asymmetric key pairs to guarantee evidentiary admissibility under Section 65B of the Indian Evidence Act.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details. Built for the Smart India Hackathon (SIH 2026).
