import express from "express";
import { ObjectId } from "mongodb";
import {
  getTendersCollection,
  getApplicationsCollection,
  getAuditCollection,
  getDocumentsCollection,
} from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();
const ENGINE_URL = process.env.AI_ENGINE_URL || "http://127.0.0.1:8000";

/**
 * Helper to verify that a tender belongs to the authenticated government officer.
 * Returns { allowed: true, tender } or { allowed: false, status, error }
 */
export async function verifyOfficerTenderAccess(tenderId, officerId) {
  if (!tenderId) {
    return { allowed: false, status: 400, error: "Missing required tender reference ID." };
  }
  if (!officerId) {
    return { allowed: false, status: 401, error: "Authentication required." };
  }

  const tenders = await getTendersCollection();
  const query = {
    $or: [{ tender_id: tenderId }, { tender_id: tenderId.toUpperCase() }],
  };
  if (ObjectId.isValid(tenderId)) {
    query.$or.push({ _id: new ObjectId(tenderId) });
  }

  const tender = await tenders.findOne(query);
  if (!tender) {
    return { allowed: false, status: 404, error: `Tender '${tenderId}' not found.` };
  }

  if (!tender.created_by || String(tender.created_by) !== String(officerId)) {
    return {
      allowed: false,
      status: 403,
      error: "Access denied. You can only view and manage tenders you created.",
    };
  }

  return { allowed: true, tender };
}

/**
 * GET /api/officer/overview
 * Overview metrics strictly for the authenticated Officer's own Dashboard.
 */
router.get("/overview", requireAuth, requireRole("officer"), async (request, response, next) => {
  try {
    const tenders = await getTendersCollection();
    const officerTenders = await tenders.find({ created_by: request.user.id }).toArray();
    const officerTenderIds = officerTenders.map((t) => t.tender_id);

    const applications = await getApplicationsCollection();
    const officerApps =
      officerTenderIds.length > 0
        ? await applications.find({ tender_id: { $in: officerTenderIds } }).toArray()
        : [];

    const totalApplications = officerApps.length;
    const underReview = officerApps.filter(
      (a) => a.status === "under_review" || a.status === "submitted"
    ).length;
    const approved = officerApps.filter((a) => a.status === "approved").length;
    const rejected = officerApps.filter((a) => a.status === "rejected").length;
    const infoRequested = officerApps.filter((a) => a.status === "info_requested").length;

    return response.json({
      success: true,
      metrics: {
        total_tenders: officerTenders.length,
        active_tenders: officerTenders.length,
        total_applications: totalApplications,
        under_review: underReview,
        approved,
        rejected,
        info_requested: infoRequested,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/officer/tenders
 * Lists ONLY tenders created by the authenticated officer with their applicant counts.
 */
router.get("/tenders", requireAuth, requireRole("officer"), async (request, response, next) => {
  try {
    const tenders = await getTendersCollection();
    const officerTenders = await tenders
      .find({ created_by: request.user.id })
      .sort({ created_at: -1 })
      .toArray();

    const officerTenderIds = officerTenders.map((t) => t.tender_id);

    const applications = await getApplicationsCollection();
    const officerApps =
      officerTenderIds.length > 0
        ? await applications.find({ tender_id: { $in: officerTenderIds } }).toArray()
        : [];

    const appCounts = new Map();
    for (const app of officerApps) {
      const current = appCounts.get(app.tender_id) || {
        total: 0,
        under_review: 0,
        approved: 0,
        rejected: 0,
        info_requested: 0,
      };
      current.total += 1;
      if (app.status === "submitted" || app.status === "under_review") current.under_review += 1;
      if (app.status === "approved") current.approved += 1;
      if (app.status === "rejected") current.rejected += 1;
      if (app.status === "info_requested") current.info_requested += 1;
      appCounts.set(app.tender_id, current);
    }

    const tendersWithCounts = officerTenders.map((t) => ({
      tender_id: t.tender_id,
      title: t.title,
      category: t.category,
      description: t.description,
      mandatory_checks: t.mandatory_checks,
      deadline: t.deadline,
      created_by: t.created_by,
      created_by_name: t.created_by_name,
      created_at: t.created_at,
      updated_at: t.updated_at,
      applications_summary: appCounts.get(t.tender_id) || {
        total: 0,
        under_review: 0,
        approved: 0,
        rejected: 0,
        info_requested: 0,
      },
    }));

    return response.json({
      success: true,
      tenders: tendersWithCounts,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/tenders
 * Officer creates a new procurement tender with dynamic compliance requirements.
 */
router.post("/tenders", requireAuth, requireRole("officer"), async (request, response, next) => {
  try {
    const { tender_id, title, category, description, mandatory_checks, deadline } = request.body;

    if (!tender_id || !title || !category || !mandatory_checks || !mandatory_checks.length) {
      return response.status(400).json({
        error: "Tender ID, Title, Category, and at least one Mandatory Compliance Check are required.",
      });
    }

    // 1. Register tender with AI Engine
    const engineRes = await fetch(`${ENGINE_URL}/tenders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tender_id: tender_id.trim().toUpperCase(),
        title: title.trim(),
        category: category.trim(),
        description: (description || "").trim(),
        mandatory_checks,
      }),
    });

    const engineData = await engineRes.json();
    if (!engineRes.ok) {
      return response.status(engineRes.status).json(engineData);
    }

    // 2. Persist tender record in MongoDB with Officer Ownership
    const tenders = await getTendersCollection();
    const now = new Date();
    const tenderRecord = {
      tender_id: tender_id.trim().toUpperCase(),
      title: title.trim(),
      category: category.trim(),
      description: (description || "").trim(),
      mandatory_checks,
      deadline: deadline || null,
      created_by: request.user.id,
      created_by_name: request.user.full_name || "Procurement Officer",
      created_at: now,
      updated_at: now,
    };

    await tenders.updateOne(
      { tender_id: tenderRecord.tender_id },
      { $set: tenderRecord },
      { upsert: true }
    );

    return response.status(201).json({
      success: true,
      status: "registered",
      message: `Tender '${tenderRecord.tender_id}' created successfully.`,
      tender: tenderRecord,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/tenders/:id/applications
 * Displays applicants for a tender, ranked strictly by COMPLIANCE SCORE DESCENDING.
 */
export const getTenderApplicants = async (request, response, next) => {
  try {
    const rawId = request.params.id || request.params[0] || request.query?.tender_id;
    const tenderId = rawId ? decodeURIComponent(rawId).trim() : null;

    if (!tenderId) {
      return response.status(400).json({ error: "Missing required tender_id parameter." });
    }

    // Role security check: Officer can ONLY view applicants for tenders they created
    if (request.user?.role === "officer") {
      const access = await verifyOfficerTenderAccess(tenderId, request.user.id);
      if (!access.allowed) {
        return response.status(access.status || 403).json({ error: access.error });
      }
    }

    // Fetch tender details
    const tenders = await getTendersCollection();
    let tender = await tenders.findOne({ tender_id: tenderId });
    if (!tender) {
      const tendersRes = await fetch(`${ENGINE_URL}/tenders`);
      const tendersList = await tendersRes.json();
      tender = tendersList.find((t) => t.tender_id === tenderId);
    }

    const applications = await getApplicationsCollection();

    // FETCH ONLY BIDDERS WHO ACTUALLY APPLIED TO THIS TENDER
    // SORT IN COMPLIANCE SCORE DESCENDING ORDER (HIGHEST FIRST)
    const appList = await applications
      .find({ tender_id: tenderId })
      .sort({ compliance_score: -1, applied_at: 1 })
      .toArray();

    const rankedApplicants = appList.map((app, index) => ({
      rank: index + 1,
      id: app._id.toString(),
      bidder_id: app.bidder_id,
      company_name: app.company_name,
      contact_person: app.contact_person,
      email: app.email,
      phone: app.phone,
      compliance_score: app.compliance_score,
      risk_level: app.risk_level,
      status: app.status,
      submitted_documents_count: app.submitted_documents?.length || 0,
      applied_at: app.applied_at,
      decided_at: app.decided_at,
      officer_comment: app.officer_comment,
    }));

    return response.json({
      success: true,
      tender: tender || { tender_id: tenderId },
      total_applicants: rankedApplicants.length,
      applicants: rankedApplicants,
    });
  } catch (error) {
    return next(error);
  }
};
router.get(/^\/tenders\/(.+)\/applications$/, requireAuth, requireRole("officer"), (req, res, next) => {
  req.params.id = req.params[0];
  return getTenderApplicants(req, res, next);
});
router.get("/tenders/:id/applications", requireAuth, requireRole("officer"), getTenderApplicants);

/**
 * GET /api/applications/:id
 * Retrieves detailed evaluation, statutory check breakdown, and document references.
 */
export const getApplicationDetail = async (request, response, next) => {
  try {
    const applications = await getApplicationsCollection();
    let query;
    try {
      query = { _id: new ObjectId(request.params.id) };
    } catch (e) {
      return response.status(400).json({ error: "Invalid application ID format." });
    }

    const app = await applications.findOne(query);
    if (!app) {
      return response.status(404).json({ error: "Application not found." });
    }

    // Role security check: Bidder can only view own application
    if (request.user.role === "bidder") {
      if (app.bidder_user_id !== request.user.id && app.bidder_id !== request.user.bidder_id) {
        return response.status(403).json({ error: "Access denied. You can only view your own applications." });
      }
    }

    // Role security check: Officer can only view applications for their own tenders
    if (request.user.role === "officer") {
      const access = await verifyOfficerTenderAccess(app.tender_id, request.user.id);
      if (!access.allowed) {
        return response.status(access.status || 403).json({ error: access.error });
      }
    }

    // Enrich submitted documents with secure download/view URLs
    const docs = await getDocumentsCollection();
    const enrichedDocs = await Promise.all(
      (app.submitted_documents || []).map(async (docRef) => {
        let originalDoc = null;
        try {
          originalDoc = await docs.findOne({ _id: new ObjectId(docRef.document_id) });
        } catch (e) {}

        return {
          document_id: docRef.document_id,
          document_type: docRef.document_type,
          file_name: docRef.file_name,
          mime_type: originalDoc?.mime_type || "application/pdf",
          file_size: originalDoc?.file_size || null,
          uploaded_at: docRef.uploaded_at || originalDoc?.uploaded_at,
          download_url: `/api/documents/${docRef.document_id}/download`,
          view_url: `/api/documents/${docRef.document_id}/view`,
        };
      })
    );

    return response.json({
      success: true,
      application: {
        id: app._id.toString(),
        tender_id: app.tender_id,
        tender_title: app.tender_title,
        tender_category: app.tender_category,
        bidder_id: app.bidder_id,
        company_name: app.company_name,
        contact_person: app.contact_person,
        phone: app.phone,
        email: app.email,
        compliance_score: app.compliance_score,
        risk_level: app.risk_level,
        checks: app.checks || [],
        llm_briefing: app.llm_briefing || null,
        status: app.status,
        submitted_documents: enrichedDocs,
        applied_at: app.applied_at,
        updated_at: app.updated_at,
        decided_at: app.decided_at,
        officer_id: app.officer_id,
        officer_name: app.officer_name,
        officer_comment: app.officer_comment,
        bidder_response_note: app.bidder_response_note || null,
      },
    });
  } catch (error) {
    return next(error);
  }
};
router.get("/applications/:id", requireAuth, getApplicationDetail);

/**
 * POST /api/applications/:id/approve
 * Approves applicant and synchronizes with immutable MongoDB audit trail.
 */
export const approveApplication = async (request, response, next) => {
  try {
    const { comment } = request.body;
    const applications = await getApplicationsCollection();

    let query;
    try {
      query = { _id: new ObjectId(request.params.id) };
    } catch (e) {
      return response.status(400).json({ error: "Invalid application ID format." });
    }

    const app = await applications.findOne(query);
    if (!app) {
      return response.status(404).json({ error: "Application not found." });
    }

    // Role security check: Officer can only approve applications for their own tenders
    const access = await verifyOfficerTenderAccess(app.tender_id, request.user.id);
    if (!access.allowed) {
      return response.status(access.status || 403).json({ error: access.error });
    }

    const now = new Date();
    const officerId = request.user.id;
    const officerName = request.user.full_name || "Procurement Officer";
    const decisionComment = (comment || "Approved by procurement officer.").trim();

    // 1. Update tender application
    await applications.updateOne(
      { _id: app._id },
      {
        $set: {
          status: "approved",
          officer_id: officerId,
          officer_name: officerName,
          officer_comment: decisionComment,
          decided_at: now,
          updated_at: now,
        },
      }
    );

    // 2. Synchronize with MongoDB audit trail
    const audit = await getAuditCollection();
    const updateAudit = await audit.findOneAndUpdate(
      { bidder_id: app.bidder_id, officer_decision: null },
      {
        $set: {
          officer_decision: "approve",
          officer_id: officerId,
          officer_comment: decisionComment,
          decided_at: now,
        },
      },
      { sort: { timestamp: -1 }, returnDocument: "after" }
    );

    if (!updateAudit) {
      // Fallback insert if no undecided entry existed
      await audit.insertOne({
        bidder_id: app.bidder_id,
        tender_id: app.tender_id,
        timestamp: now.toISOString(),
        compliance_score: app.compliance_score,
        risk_level: app.risk_level,
        pending_manual_review: false,
        llm_briefing: app.llm_briefing?.text || null,
        officer_decision: "approve",
        officer_id: officerId,
        officer_comment: decisionComment,
        decided_at: now,
      });
    }

    return response.json({
      success: true,
      message: `Application for ${app.company_name} approved successfully.`,
      status: "approved",
    });
  } catch (error) {
    return next(error);
  }
};
router.post("/applications/:id/approve", requireAuth, requireRole("officer"), approveApplication);

/**
 * POST /api/applications/:id/reject
 * Rejects applicant with mandatory reason and synchronizes with audit trail.
 */
export const rejectApplication = async (request, response, next) => {
  try {
    const { comment } = request.body;
    if (!comment || !comment.trim()) {
      return response.status(400).json({ error: "A rejection reason/comment is required." });
    }

    const applications = await getApplicationsCollection();

    let query;
    try {
      query = { _id: new ObjectId(request.params.id) };
    } catch (e) {
      return response.status(400).json({ error: "Invalid application ID format." });
    }

    const app = await applications.findOne(query);
    if (!app) {
      return response.status(404).json({ error: "Application not found." });
    }

    // Role security check: Officer can only reject applications for their own tenders
    const access = await verifyOfficerTenderAccess(app.tender_id, request.user.id);
    if (!access.allowed) {
      return response.status(access.status || 403).json({ error: access.error });
    }

    const now = new Date();
    const officerId = request.user.id;
    const officerName = request.user.full_name || "Procurement Officer";
    const decisionComment = comment.trim();

    // 1. Update application
    await applications.updateOne(
      { _id: app._id },
      {
        $set: {
          status: "rejected",
          officer_id: officerId,
          officer_name: officerName,
          officer_comment: decisionComment,
          decided_at: now,
          updated_at: now,
        },
      }
    );

    // 2. Synchronize with MongoDB audit trail
    const audit = await getAuditCollection();
    const updateAudit = await audit.findOneAndUpdate(
      { bidder_id: app.bidder_id, officer_decision: null },
      {
        $set: {
          officer_decision: "reject",
          officer_id: officerId,
          officer_comment: decisionComment,
          decided_at: now,
        },
      },
      { sort: { timestamp: -1 }, returnDocument: "after" }
    );

    if (!updateAudit) {
      await audit.insertOne({
        bidder_id: app.bidder_id,
        tender_id: app.tender_id,
        timestamp: now.toISOString(),
        compliance_score: app.compliance_score,
        risk_level: app.risk_level,
        pending_manual_review: false,
        llm_briefing: app.llm_briefing?.text || null,
        officer_decision: "reject",
        officer_id: officerId,
        officer_comment: decisionComment,
        decided_at: now,
      });
    }

    return response.json({
      success: true,
      message: `Application for ${app.company_name} rejected.`,
      status: "rejected",
    });
  } catch (error) {
    return next(error);
  }
};
router.post("/applications/:id/reject", requireAuth, requireRole("officer"), rejectApplication);

/**
 * POST /api/applications/:id/request-info
 * Requests more information with mandatory message and synchronizes with audit trail.
 */
export const requestInfo = async (request, response, next) => {
  try {
    const { comment } = request.body;
    if (!comment || !comment.trim()) {
      return response.status(400).json({
        error: "Please enter an explanation of what document or clarification is required.",
      });
    }

    const applications = await getApplicationsCollection();

    let query;
    try {
      query = { _id: new ObjectId(request.params.id) };
    } catch (e) {
      return response.status(400).json({ error: "Invalid application ID format." });
    }

    const app = await applications.findOne(query);
    if (!app) {
      return response.status(404).json({ error: "Application not found." });
    }

    // Role security check: Officer can only request information for their own tenders
    const access = await verifyOfficerTenderAccess(app.tender_id, request.user.id);
    if (!access.allowed) {
      return response.status(access.status || 403).json({ error: access.error });
    }

    const now = new Date();
    const officerId = request.user.id;
    const officerName = request.user.full_name || "Procurement Officer";
    const decisionComment = comment.trim();

    // 1. Update application
    await applications.updateOne(
      { _id: app._id },
      {
        $set: {
          status: "info_requested",
          officer_id: officerId,
          officer_name: officerName,
          officer_comment: decisionComment,
          decided_at: now,
          updated_at: now,
        },
      }
    );

    // 2. Synchronize with MongoDB audit trail
    const audit = await getAuditCollection();
    const updateAudit = await audit.findOneAndUpdate(
      { bidder_id: app.bidder_id, officer_decision: null },
      {
        $set: {
          officer_decision: "request_more_info",
          officer_id: officerId,
          officer_comment: decisionComment,
          decided_at: now,
        },
      },
      { sort: { timestamp: -1 }, returnDocument: "after" }
    );

    if (!updateAudit) {
      await audit.insertOne({
        bidder_id: app.bidder_id,
        tender_id: app.tender_id,
        timestamp: now.toISOString(),
        compliance_score: app.compliance_score,
        risk_level: app.risk_level,
        pending_manual_review: true,
        llm_briefing: app.llm_briefing?.text || null,
        officer_decision: "request_more_info",
        officer_id: officerId,
        officer_comment: decisionComment,
        decided_at: now,
      });
    }

    return response.json({
      success: true,
      message: `Information request sent to ${app.company_name}.`,
      status: "info_requested",
    });
  } catch (error) {
    return next(error);
  }
};
router.post("/applications/:id/request-info", requireAuth, requireRole("officer"), requestInfo);

/**
 * DELETE /api/officer/tenders/:id or /api/tenders/:id
 * Safely deletes a tender owned by the authenticated officer, ensuring no orphaned applications.
 */
export const deleteTender = async (request, response, next) => {
  try {
    const rawId =
      request.params.id ||
      request.params.tenderId ||
      request.params[0] ||
      request.query?.tender_id ||
      request.body?.tender_id ||
      "";
    const tenderId = decodeURIComponent(rawId).trim();

    if (!tenderId) {
      return response.status(400).json({ error: "Missing required tender identifier." });
    }

    // 1. Ownership & Existence check — officer can only delete their own tenders
    const access = await verifyOfficerTenderAccess(tenderId, request.user.id);
    if (!access.allowed) {
      return response.status(access.status || 403).json({ error: access.error });
    }
    const tender = access.tender;
    const resolvedTenderId = tender.tender_id;

    // 2. Cascade delete dependent applications belonging exclusively to this tender
    const applications = await getApplicationsCollection();
    const appCount = await applications.countDocuments({ tender_id: resolvedTenderId });
    if (appCount > 0) {
      await applications.deleteMany({ tender_id: resolvedTenderId });
    }

    // 3. Remove from AI engine in-memory list (fire-and-forget; not all tenders
    // exist there, so 404 from the engine is acceptable)
    try {
      await fetch(`${ENGINE_URL}/tenders/${encodeURIComponent(resolvedTenderId)}`, { method: "DELETE" });
    } catch (_) {
      // AI engine unavailability must not block MongoDB deletion
    }

    // 4. Delete tender from MongoDB (authoritative store)
    const tenders = await getTendersCollection();
    await tenders.deleteOne({ _id: tender._id });

    // 5. Record immutable audit event preserving compliance history
    try {
      const audit = await getAuditCollection();
      await audit.insertOne({
        action: "tender_deleted",
        tender_id: resolvedTenderId,
        officer_id: request.user.id,
        officer_email: request.user.email,
        tender_title: tender.title,
        applications_deleted: appCount,
        timestamp: new Date().toISOString(),
        deleted_at: new Date(),
      });
    } catch (_) {}

    return response.json({
      success: true,
      message:
        appCount > 0
          ? `Tender '${resolvedTenderId}' and ${appCount} application${appCount === 1 ? "" : "s"} deleted successfully.`
          : `Tender '${resolvedTenderId}' deleted successfully.`,
      tender_id: resolvedTenderId,
      applications_deleted: appCount,
    });
  } catch (error) {
    return next(error);
  }
};

router.delete(/^\/tenders\/(.+)$/, requireAuth, requireRole("officer"), deleteTender);
router.delete("/tenders/:id", requireAuth, requireRole("officer"), deleteTender);
router.delete("/tenders", requireAuth, requireRole("officer"), deleteTender);

export default router;
