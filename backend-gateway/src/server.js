import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { getAuditCollection, getApplicationsCollection, getTendersCollection } from "./db.js";
import { optionalAuth, requireAuth, requireRole } from "./middleware/auth.js";

import authRouter from "./routes/auth.js";
import bidderRouter, { applyForTender, resubmitInfo } from "./routes/bidder.js";
import officerRouter, {
  getTenderApplicants,
  getApplicationDetail,
  approveApplication,
  rejectApplication,
  requestInfo,
} from "./routes/officer.js";
import documentsRouter from "./routes/documents.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ service: "backend-gateway", status: "ready" });
});

// In the unified Render deployment, Express serves the production React build.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));

const ENGINE_URL = process.env.AI_ENGINE_URL || "http://127.0.0.1:8000";
const VALID_DECISIONS = new Set(["approve", "reject", "request_more_info"]);

// Mount Feature Routers
app.use("/api/auth", authRouter);
app.use("/api/bidder", bidderRouter);
app.use("/api/officer", officerRouter);
app.use("/api/documents", documentsRouter);

// Direct top-level application & tender endpoints
app.post(/^\/api\/tenders\/(.+)\/apply$/, requireAuth, requireRole("bidder"), (req, res, next) => {
  req.params.id = req.params[0];
  return applyForTender(req, res, next);
});
app.post("/api/tenders/apply", requireAuth, requireRole("bidder"), applyForTender);
app.post("/api/tenders/:id/apply", requireAuth, requireRole("bidder"), applyForTender);

app.get(/^\/api\/tenders\/(.+)\/applications$/, requireAuth, requireRole("officer"), (req, res, next) => {
  req.params.id = req.params[0];
  return getTenderApplicants(req, res, next);
});
app.get("/api/tenders/:id/applications", requireAuth, requireRole("officer"), getTenderApplicants);
app.get("/api/applications/:id", requireAuth, getApplicationDetail);
app.post("/api/applications/:id/approve", requireAuth, requireRole("officer"), approveApplication);
app.post("/api/applications/:id/reject", requireAuth, requireRole("officer"), rejectApplication);
app.post("/api/applications/:id/request-info", requireAuth, requireRole("officer"), requestInfo);
app.post("/api/applications/:id/resubmit-info", requireAuth, requireRole("bidder"), resubmitInfo);


// =============================================================================
// PRESERVED BIDDER APIS
// =============================================================================

app.get("/api/bidders", async (_request, response, next) => {
  try {
    const engineResponse = await fetch(`${ENGINE_URL}/bidders`);
    const data = await engineResponse.json();
    return response.status(engineResponse.status).json(data);
  } catch (error) {
    return next(error);
  }
});

app.post("/api/bidders", async (request, response, next) => {
  try {
    const engineResponse = await fetch(`${ENGINE_URL}/bidders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
    });
    const data = await engineResponse.json();
    return response.status(engineResponse.status).json(data);
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/bidders/:bidderId", async (request, response, next) => {
  try {
    const engineResponse = await fetch(`${ENGINE_URL}/bidders/${request.params.bidderId}`, {
      method: "DELETE",
    });
    const data = await engineResponse.json();
    return response.status(engineResponse.status).json(data);
  } catch (error) {
    return next(error);
  }
});

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

app.post("/api/extract/bidder-pdf", memoryUpload.single("file"), async (request, response, next) => {
  try {
    if (!request.file) {
      return response.status(400).json({ success: false, message: "No PDF file uploaded" });
    }
    const formData = new FormData();
    const blob = new Blob([request.file.buffer], { type: request.file.mimetype || "application/pdf" });
    formData.append("file", blob, request.file.originalname || "document.pdf");

    const simQuery = request.query.simulate_failure === "true" ? "?simulate_failure=true" : "";
    const engineResponse = await fetch(`${ENGINE_URL}/extract-bidder-pdf${simQuery}`, {
      method: "POST",
      body: formData,
    });
    const data = await engineResponse.json();
    return response.status(engineResponse.status).json(data);
  } catch (error) {
    return next(error);
  }
});

app.post("/api/extract/tender-pdf", memoryUpload.single("file"), async (request, response, next) => {
  try {
    if (!request.file) {
      return response.status(400).json({ success: false, message: "No PDF file uploaded" });
    }
    const formData = new FormData();
    const blob = new Blob([request.file.buffer], { type: request.file.mimetype || "application/pdf" });
    formData.append("file", blob, request.file.originalname || "tender.pdf");

    const simQuery = request.query.simulate_failure === "true" ? "?simulate_failure=true" : "";
    const engineResponse = await fetch(`${ENGINE_URL}/extract-tender-pdf${simQuery}`, {
      method: "POST",
      body: formData,
    });
    const data = await engineResponse.json();
    return response.status(engineResponse.status).json(data);
  } catch (error) {
    return next(error);
  }
});

// =============================================================================
// PRESERVED TENDER APIS
// =============================================================================

app.get("/api/tenders", async (_request, response, next) => {
  try {
    const engineResponse = await fetch(`${ENGINE_URL}/tenders`);
    const data = await engineResponse.json();
    return response.status(engineResponse.status).json(data);
  } catch (error) {
    return next(error);
  }
});

app.post("/api/tenders", optionalAuth, async (request, response, next) => {
  try {
    if (request.user && request.user.role !== "officer") {
      return response.status(403).json({
        error: "Access denied. Only authenticated government officers can create tenders.",
      });
    }

    const engineResponse = await fetch(`${ENGINE_URL}/tenders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
    });
    const data = await engineResponse.json();
    if (!engineResponse.ok) {
      return response.status(engineResponse.status).json(data);
    }

    let createdBy = null;
    let createdByName = null;
    if (request.user) {
      createdBy = request.user.id;
      createdByName = request.user.full_name;
      const tenders = await getTendersCollection();
      await tenders.updateOne(
        { tender_id: request.body.tender_id },
        {
          $set: {
            ...data.tender,
            created_by: createdBy,
            created_by_name: createdByName,
            deadline: request.body.deadline || null,
            updated_at: new Date(),
          },
        },
        { upsert: true }
      );
    }

    const resTender = {
      ...data.tender,
      created_by: createdBy,
      created_by_name: createdByName,
    };

    return response.status(201).json({
      status: "registered",
      tender: resTender,
    });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/tenders/:tenderId", async (request, response, next) => {
  try {
    const engineResponse = await fetch(`${ENGINE_URL}/tenders/${request.params.tenderId}`, {
      method: "DELETE",
    });
    const data = await engineResponse.json();
    return response.status(engineResponse.status).json(data);
  } catch (error) {
    return next(error);
  }
});

// =============================================================================
// OVERVIEW DASHBOARD ROUTE (PRESERVED)
// =============================================================================

app.get("/api/overview", async (request, response, next) => {
  try {
    const tenderId = request.query.tender_id || "TENDER-ALL-MANDATORY";

    const biddersRes = await fetch(`${ENGINE_URL}/bidders`);
    const biddersList = await biddersRes.json();

    const tendersRes = await fetch(`${ENGINE_URL}/tenders`);
    const tendersList = await tendersRes.json();
    const activeTender = tendersList.find((t) => t.tender_id === tenderId) || tendersList[0];
    const requiredChecks = activeTender ? activeTender.mandatory_checks : ["udyam", "gstn", "pan_it", "epfo_esic", "digilocker", "blacklist"];

    const audit = await getAuditCollection();

    const bidderCards = await Promise.all(
      biddersList.map(async (b) => {
        try {
          const evalRes = await fetch(`${ENGINE_URL}/verify-compliance`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              bidder_id: b.bidder_id,
              tender_id: activeTender?.tender_id,
              required_checks: requiredChecks,
            }),
          });
          const evalData = await evalRes.json();

          const latestAudit = await audit.findOne(
            { bidder_id: b.bidder_id },
            { sort: { timestamp: -1 } }
          );

          return {
            bidder_id: b.bidder_id,
            display_name: b.display_name,
            compliance_score: evalData.compliance_score ?? 0,
            risk_level: evalData.risk_level ?? "Unknown",
            officer_decision: latestAudit?.officer_decision || null,
            officer_id: latestAudit?.officer_id || null,
            last_evaluated: latestAudit?.timestamp || evalData.audit_log_entry?.timestamp,
            checks_summary: {
              total: evalData.checks?.length || 6,
              mandatory: evalData.checks?.filter((c) => c.is_mandatory).length || 0,
              compliant_mandatory: evalData.checks?.filter((c) => c.is_mandatory && c.status === "compliant").length || 0,
            },
          };
        } catch (e) {
          return {
            bidder_id: b.bidder_id,
            display_name: b.display_name,
            compliance_score: 0,
            risk_level: "Error",
            officer_decision: null,
            officer_id: null,
          };
        }
      })
    );

    const totalBidders = bidderCards.length;
    const lowRiskCount = bidderCards.filter((b) => b.risk_level === "Low").length;
    const mediumRiskCount = bidderCards.filter((b) => b.risk_level === "Medium").length;
    const highRiskCount = bidderCards.filter((b) => b.risk_level === "High").length;
    const pendingDecisionCount = bidderCards.filter((b) => !b.officer_decision).length;
    const decidedCount = bidderCards.filter((b) => Boolean(b.officer_decision)).length;

    return response.json({
      tender_id: activeTender?.tender_id,
      tender_title: activeTender?.title,
      tender_category: activeTender?.category,
      aggregates: {
        total_bidders: totalBidders,
        low_risk: lowRiskCount,
        medium_risk: mediumRiskCount,
        high_risk: highRiskCount,
        pending_decision: pendingDecisionCount,
        decided: decidedCount,
      },
      bidders: bidderCards,
    });
  } catch (error) {
    return next(error);
  }
});

// =============================================================================
// COMPLIANCE EVALUATION & AUDIT TRAIL (PRESERVED & SYNCHRONIZED)
// =============================================================================

app.post("/api/compliance/verify", async (request, response, next) => {
  try {
    const engineResponse = await fetch(`${ENGINE_URL}/verify-compliance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
    });
    const assessment = await engineResponse.json();

    if (!engineResponse.ok) {
      return response.status(engineResponse.status).json(assessment);
    }

    const audit = await getAuditCollection();
    await audit.insertOne({
      bidder_id: assessment.bidder_id,
      tender_id: assessment.tender_id || request.body.tender_id || "ALL_CHECKS",
      timestamp: assessment.audit_log_entry.timestamp,
      compliance_score: assessment.compliance_score,
      risk_level: assessment.risk_level,
      pending_manual_review: assessment.pending_manual_review,
      llm_briefing: assessment.llm_briefing?.text || null,
      officer_decision: null,
      officer_id: null,
    });

    return response.json(assessment);
  } catch (error) {
    return next(error);
  }
});

app.post("/api/audit/decision", optionalAuth, async (request, response, next) => {
  try {
    const { bidder_id: bidderId, decision } = request.body;
    const officerId = request.user?.id || request.user?.full_name || request.body.officer_id;

    if (!bidderId || !officerId || !VALID_DECISIONS.has(decision)) {
      return response.status(400).json({
        error: "bidder_id, officer_id, and decision (approve/reject/request_more_info) are required.",
      });
    }

    const audit = await getAuditCollection();
    const result = await audit.findOneAndUpdate(
      { bidder_id: bidderId, officer_decision: null },
      { $set: { officer_decision: decision, officer_id: officerId, decided_at: new Date() } },
      { sort: { timestamp: -1 }, returnDocument: "after" },
    );

    if (!result) {
      return response.status(404).json({
        error: "No undecided scoring audit entry exists for this bidder.",
      });
    }

    try {
      const applications = await getApplicationsCollection();
      const mappedStatus = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "info_requested";
      await applications.updateOne(
        { bidder_id: bidderId, status: { $in: ["submitted", "under_review", "info_requested"] } },
        {
          $set: {
            status: mappedStatus,
            officer_id: officerId,
            decided_at: new Date(),
            updated_at: new Date(),
          },
        }
      );
    } catch (syncErr) {
      console.warn("Notice: Application status sync warning:", syncErr.message);
    }

    return response.json(result);
  } catch (error) {
    return next(error);
  }
});

app.get("/api/audit/:bidderId", async (request, response, next) => {
  try {
    const audit = await getAuditCollection();
    const entries = await audit
      .find({ bidder_id: request.params.bidderId })
      .sort({ timestamp: -1 })
      .toArray();
    return response.json(entries);
  } catch (error) {
    return next(error);
  }
});

// Guarantee JSON 404 response for any unhandled /api requests
app.all(/^\/api\/.*/, (request, response) => {
  response.status(404).json({
    error: `API route not found: ${request.method} ${request.originalUrl}`,
    status: 404,
  });
});

// SPA fallback: let React Router handle browser refreshes/deep links.
app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
  response.sendFile(path.join(frontendDist, "index.html"));
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(502).json({ error: error.message || "Gateway could not complete the requested operation." });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Gateway listening on ${port}`));
