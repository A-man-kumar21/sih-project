import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
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
  verifyOfficerTenderAccess,
} from "./routes/officer.js";
import documentsRouter from "./routes/documents.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ service: "backend-gateway", status: "ready" });
});

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
app.get(/^\/api\/(?:officer\/)?tenders\/(.+)\/applicants$/, requireAuth, requireRole("officer"), (req, res, next) => {
  req.params.id = req.params[0];
  return getTenderApplicants(req, res, next);
});
app.get("/api/tenders/:id/applicants", requireAuth, requireRole("officer"), getTenderApplicants);
app.get("/api/officer/tenders/:id/applicants", requireAuth, requireRole("officer"), getTenderApplicants);
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

app.get("/api/tenders", optionalAuth, async (request, response, next) => {
  try {
    // If requested by an authenticated officer, return ONLY tenders created by that officer
    if (request.user && request.user.role === "officer") {
      const tenders = await getTendersCollection();
      const officerTenders = await tenders
        .find({ created_by: request.user.id })
        .sort({ created_at: -1 })
        .toArray();
      return response.json(officerTenders);
    }

    // For public / bidder browsing, return all published tenders
    const engineResponse = await fetch(`${ENGINE_URL}/tenders`);
    const data = await engineResponse.json();
    return response.status(engineResponse.status).json(data);
  } catch (error) {
    return next(error);
  }
});

app.post("/api/tenders", optionalAuth, async (request, response, next) => {
  try {
    // If request is authenticated, enforce that user must be an officer
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

app.delete("/api/tenders/:tenderId", requireAuth, requireRole("officer"), async (request, response, next) => {
  try {
    const access = await verifyOfficerTenderAccess(request.params.tenderId, request.user.id);
    if (!access.allowed) {
      return response.status(access.status || 403).json({ error: access.error });
    }

    const engineResponse = await fetch(`${ENGINE_URL}/tenders/${request.params.tenderId}`, {
      method: "DELETE",
    });
    const data = await engineResponse.json();

    const tenders = await getTendersCollection();
    await tenders.deleteOne({ tender_id: request.params.tenderId });

    return response.status(engineResponse.status).json(data);
  } catch (error) {
    return next(error);
  }
});

// =============================================================================
// OVERVIEW DASHBOARD ROUTE (PRESERVED)
// =============================================================================

app.get("/api/overview", optionalAuth, async (request, response, next) => {
  try {
    const rawId = request.query.tender_id;
    let targetTenderId = rawId ? decodeURIComponent(rawId).trim() : null;

    // If requested by an authenticated officer, enforce ownership
    if (request.user && request.user.role === "officer") {
      const tenders = await getTendersCollection();
      if (targetTenderId) {
        const access = await verifyOfficerTenderAccess(targetTenderId, request.user.id);
        if (!access.allowed) {
          return response.status(access.status || 403).json({ error: access.error });
        }
      } else {
        // Default to the officer's first tender
        const firstTender = await tenders.findOne({ created_by: request.user.id });
        if (!firstTender) {
          return response.json({
            tender_id: null,
            tender_title: "No Tenders Created Yet",
            tender_category: "General",
            aggregates: {
              total_bidders: 0,
              low_risk: 0,
              medium_risk: 0,
              high_risk: 0,
              pending_decision: 0,
              decided: 0,
            },
            bidders: [],
          });
        }
        targetTenderId = firstTender.tender_id;
      }
    } else {
      if (!targetTenderId) {
        targetTenderId = "TENDER-ALL-MANDATORY";
      }
    }

    // 1. Fetch tender details
    const tenders = await getTendersCollection();
    let activeTender = await tenders.findOne({ tender_id: targetTenderId });
    if (!activeTender) {
      const tendersRes = await fetch(`${ENGINE_URL}/tenders`);
      const tendersList = await tendersRes.json();
      activeTender = tendersList.find((t) => t.tender_id === targetTenderId);
    }

    // 2. Fetch ONLY actual applications submitted for this specific tender
    const applications = await getApplicationsCollection();
    const apps = await applications
      .find({ tender_id: targetTenderId })
      .sort({ compliance_score: -1, applied_at: 1 })
      .toArray();

    // 3. Map each application to an applicant overview card
    const bidderCards = apps.map((app) => ({
      bidder_id: app.bidder_id,
      display_name: app.company_name || app.bidder_id,
      company_name: app.company_name,
      contact_person: app.contact_person,
      email: app.email,
      phone: app.phone,
      compliance_score: app.compliance_score ?? 0,
      risk_level: app.risk_level ?? "Unknown",
      officer_decision:
        app.status === "approved"
          ? "approve"
          : app.status === "rejected"
          ? "reject"
          : app.status === "info_requested"
          ? "request_more_info"
          : null,
      officer_id: app.officer_id || null,
      last_evaluated: app.decided_at || app.applied_at,
      application_id: app._id.toString(),
      status: app.status,
      applied_at: app.applied_at,
      checks: app.checks || [],
      submitted_documents: app.submitted_documents || [],
      llm_briefing: app.llm_briefing || null,
      checks_summary: {
        total: app.checks?.length || 0,
        mandatory: app.checks?.filter((c) => c.is_mandatory).length || 0,
        compliant_mandatory:
          app.checks?.filter((c) => c.is_mandatory && c.status === "compliant").length || 0,
      },
    }));

    // 4. Calculate aggregates strictly for this tender's applicants
    const totalBidders = bidderCards.length;
    const lowRiskCount = bidderCards.filter((b) => b.risk_level === "Low").length;
    const mediumRiskCount = bidderCards.filter((b) => b.risk_level === "Medium").length;
    const highRiskCount = bidderCards.filter((b) => b.risk_level === "High").length;
    const pendingDecisionCount = bidderCards.filter((b) => !b.officer_decision).length;
    const decidedCount = bidderCards.filter((b) => Boolean(b.officer_decision)).length;

    return response.json({
      tender_id: targetTenderId,
      tender_title: activeTender?.title || targetTenderId,
      tender_category: activeTender?.category || "General",
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

/**
 * Proxies the AI engine unchanged. The assessment is persisted separately.
 */
app.post("/api/compliance/verify", optionalAuth, async (request, response, next) => {
  try {
    // If called by an officer with a specific tender_id, verify ownership
    if (request.user && request.user.role === "officer" && request.body.tender_id) {
      const access = await verifyOfficerTenderAccess(request.body.tender_id, request.user.id);
      if (!access.allowed) {
        return response.status(access.status || 403).json({ error: access.error });
      }
    }
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

/**
 * Records a human officer decision without modifying AI assessment fields.
 * Derives officer_id from authenticated session when available, preserving audit sync.
 */
app.post("/api/audit/decision", optionalAuth, async (request, response, next) => {
  try {
    const { bidder_id: bidderId, decision } = request.body;
    // Derive officer_id from authenticated JWT session; fallback to body for legacy tests
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

    // Keep tender_applications synchronized if an application exists for this bidder
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

/** Returns every scoring run and its independently recorded human decision. */
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

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(502).json({ error: error.message || "Gateway could not complete the requested operation." });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Gateway listening on ${port}`));
