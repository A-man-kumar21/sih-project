import "dotenv/config";
import cors from "cors";
import express from "express";
import { getAuditCollection } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ service: "backend-gateway", status: "ready" });
});

const ENGINE_URL = process.env.AI_ENGINE_URL || "http://127.0.0.1:8000";
const VALID_DECISIONS = new Set(["approve", "reject", "request_more_info"]);

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

import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

app.post("/api/extract/bidder-pdf", upload.single("file"), async (request, response, next) => {
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

app.post("/api/extract/tender-pdf", upload.single("file"), async (request, response, next) => {
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

app.get("/api/tenders", async (_request, response, next) => {
  try {
    const engineResponse = await fetch(`${ENGINE_URL}/tenders`);
    const data = await engineResponse.json();
    return response.status(engineResponse.status).json(data);
  } catch (error) {
    return next(error);
  }
});

app.post("/api/tenders", async (request, response, next) => {
  try {
    const engineResponse = await fetch(`${ENGINE_URL}/tenders`, {
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

/**
 * Overview dashboard route: returns all active bidders with their compliance score,
 * risk level, and latest MongoDB officer decision status for the active tender.
 */
app.get("/api/overview", async (request, response, next) => {
  try {
    const tenderId = request.query.tender_id || "TENDER-ALL-MANDATORY";

    // 1. Fetch all active bidders
    const biddersRes = await fetch(`${ENGINE_URL}/bidders`);
    const biddersList = await biddersRes.json();

    // 2. Fetch tender details
    const tendersRes = await fetch(`${ENGINE_URL}/tenders`);
    const tendersList = await tendersRes.json();
    const activeTender = tendersList.find((t) => t.tender_id === tenderId) || tendersList[0];
    const requiredChecks = activeTender ? activeTender.mandatory_checks : ["udyam", "gstn", "pan_it", "epfo_esic", "digilocker", "blacklist"];

    const audit = await getAuditCollection();

    // 3. Evaluate each bidder against the active tender and match with latest Mongo decision
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

          // Query MongoDB for the latest decision for this bidder
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

    // 4. Calculate aggregates
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

/**
 * Proxies the AI engine unchanged. The assessment is persisted separately; the
 * gateway never recalculates or changes the engine response.
 */
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

/** Records a human decision without modifying AI assessment fields. */
app.post("/api/audit/decision", async (request, response, next) => {
  try {
    const { bidder_id: bidderId, decision, officer_id: officerId } = request.body;
    if (!bidderId || !officerId || !VALID_DECISIONS.has(decision)) {
      return response.status(400).json({
        error: "bidder_id, officer_id, and decision (approve/reject/request_more_info) are required.",
      });
    }

    const audit = await getAuditCollection();
    const result = await audit.findOneAndUpdate(
      { bidder_id: bidderId, officer_decision: null },
      { $set: { officer_decision: decision, officer_id: officerId } },
      { sort: { timestamp: -1 }, returnDocument: "after" },
    );

    if (!result) {
      return response.status(404).json({
        error: "No undecided scoring audit entry exists for this bidder.",
      });
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

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(502).json({ error: "Gateway could not complete the requested operation." });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Gateway listening on ${port}`));
