import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ObjectId } from "mongodb";
import {
  getUsersCollection,
  getDocumentsCollection,
  getApplicationsCollection,
  getAuditCollection,
  getTendersCollection,
} from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();
const ENGINE_URL = process.env.AI_ENGINE_URL || "http://127.0.0.1:8000";

// Ensure uploads directory exists
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage for secure local disk storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safeDocType = (req.body.document_type || "document").replace(/[^a-zA-Z0-9_]/g, "");
    const safeBidder = (req.user?.bidder_id || "bidder").replace(/[^a-zA-Z0-9_-]/g, "");
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    cb(null, `${safeBidder}_${safeDocType}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".png", ".jpg", ".jpeg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, PNG, and JPG files are supported."));
    }
  },
});

const VALID_DOC_TYPES = new Set([
  "udyam_cert",
  "gstin_cert",
  "pan_card",
  "epfo_esic_cert",
  "digilocker_proof",
  "other",
]);

// Map tender mandatory checks to document types
export const CHECK_TO_DOC_TYPE = {
  udyam: "udyam_cert",
  gstn: "gstin_cert",
  pan_it: "pan_card",
  epfo_esic: "epfo_esic_cert",
  digilocker: "digilocker_proof",
};

// Map document types to friendly labels
export const DOC_TYPE_LABELS = {
  udyam_cert: "Udyam / MSME Certificate",
  gstin_cert: "GST Registration Certificate",
  pan_card: "Permanent Account Number (PAN) Card",
  epfo_esic_cert: "EPFO / ESIC Establishment Proof",
  digilocker_proof: "DigiLocker Verified Credential",
  other: "Other Statutory Document",
};

/**
 * GET /api/bidder/profile
 * Returns bidder profile and statutory credentials.
 */
router.get("/profile", requireAuth, requireRole("bidder"), async (request, response, next) => {
  try {
    const users = await getUsersCollection();
    const user = await users.findOne({ _id: new ObjectId(request.user.id) });
    if (!user) {
      return response.status(404).json({ error: "Bidder profile not found." });
    }

    return response.json({
      success: true,
      profile: {
        id: user._id.toString(),
        company_name: user.company_name || "",
        contact_person: user.contact_person || "",
        email: user.email,
        phone: user.phone || "",
        bidder_id: user.bidder_id,
        statutory: user.statutory || {
          pan: "",
          gstin: "",
          udyam_number: "",
          epfo_esic_number: "",
        },
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/bidder/profile
 * Updates bidder profile and synchronizes statutory details with AI Engine.
 */
router.put("/profile", requireAuth, requireRole("bidder"), async (request, response, next) => {
  try {
    const {
      company_name,
      contact_person,
      phone,
      pan,
      gstin,
      udyam_number,
      epfo_esic_number,
    } = request.body;

    const users = await getUsersCollection();
    const existing = await users.findOne({ _id: new ObjectId(request.user.id) });
    if (!existing) {
      return response.status(404).json({ error: "Bidder profile not found." });
    }

    const updatedCompany = company_name ? company_name.trim() : existing.company_name;
    const updatedContact = contact_person ? contact_person.trim() : existing.contact_person;
    const updatedPhone = phone !== undefined ? phone.trim() : existing.phone;

    const currentStat = existing.statutory || {};
    const updatedStatutory = {
      pan: pan !== undefined ? pan.trim().toUpperCase() : currentStat.pan || "",
      gstin: gstin !== undefined ? gstin.trim().toUpperCase() : currentStat.gstin || "",
      udyam_number: udyam_number !== undefined ? udyam_number.trim().toUpperCase() : currentStat.udyam_number || "",
      epfo_esic_number: epfo_esic_number !== undefined ? epfo_esic_number.trim() : currentStat.epfo_esic_number || "",
    };

    // Synchronize with AI Engine profile registry
    try {
      await fetch(`${ENGINE_URL}/bidders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bidder_id: existing.bidder_id,
          company_name: updatedCompany,
          udyam_number: updatedStatutory.udyam_number,
          gstin: updatedStatutory.gstin,
          pan: updatedStatutory.pan,
          epfo_esic_number: updatedStatutory.epfo_esic_number,
        }),
      });
    } catch (engineErr) {
      console.warn("Notice: AI engine sync on profile update:", engineErr.message);
    }

    await users.updateOne(
      { _id: new ObjectId(request.user.id) },
      {
        $set: {
          company_name: updatedCompany,
          contact_person: updatedContact,
          phone: updatedPhone,
          statutory: updatedStatutory,
          updated_at: new Date(),
        },
      }
    );

    return response.json({
      success: true,
      message: "Bidder profile updated and synchronized with compliance engine.",
      statutory: updatedStatutory,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/bidder/documents
 * Lists all documents in the bidder's reusable document vault.
 */
router.get("/documents", requireAuth, requireRole("bidder"), async (request, response, next) => {
  try {
    const docs = await getDocumentsCollection();
    const documentList = await docs
      .find({
        $or: [
          { bidder_user_id: request.user.id },
          { bidder_id: request.user.bidder_id },
        ],
      })
      .sort({ uploaded_at: -1 })
      .toArray();

    return response.json({
      success: true,
      documents: documentList.map((d) => ({
        id: d._id.toString(),
        document_type: d.document_type,
        document_label: DOC_TYPE_LABELS[d.document_type] || d.document_type,
        file_name: d.file_name,
        original_name: d.original_name,
        mime_type: d.mime_type,
        file_size: d.file_size,
        extracted_data: d.extracted_data || null,
        uploaded_at: d.uploaded_at,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/bidder/documents
 * Uploads a reusable statutory document, performs AI PDF extraction, and syncs profile.
 */
router.post(
  "/documents",
  requireAuth,
  requireRole("bidder"),
  upload.single("file"),
  async (request, response, next) => {
    try {
      if (!request.file) {
        return response.status(400).json({ error: "Please select a document file to upload." });
      }

      const docType = request.body.document_type;
      if (!docType || !VALID_DOC_TYPES.has(docType)) {
        // Remove uploaded file if invalid type
        if (fs.existsSync(request.file.path)) fs.unlinkSync(request.file.path);
        return response.status(400).json({
          error: `Invalid document_type. Supported types: ${Array.from(VALID_DOC_TYPES).join(", ")}`,
        });
      }

      const docs = await getDocumentsCollection();
      const users = await getUsersCollection();

      let extractedData = null;

      // If document is PDF, trigger AI Engine extraction
      if (request.file.mimetype === "application/pdf" || request.file.originalname.endsWith(".pdf")) {
        try {
          const fileBuffer = fs.readFileSync(request.file.path);
          const formData = new FormData();
          const blob = new Blob([fileBuffer], { type: "application/pdf" });
          formData.append("file", blob, request.file.originalname);

          const extractRes = await fetch(`${ENGINE_URL}/extract-bidder-pdf`, {
            method: "POST",
            body: formData,
          });

          if (extractRes.ok) {
            const extractJson = await extractRes.json();
            extractedData = extractJson;

            // If statutory numbers are extracted, auto-update bidder profile!
            const user = await users.findOne({ _id: new ObjectId(request.user.id) });
            const currentStat = user?.statutory || {};
            let hasStatUpdate = false;

            if (extractJson.pan && !currentStat.pan) {
              currentStat.pan = extractJson.pan;
              hasStatUpdate = true;
            }
            if (extractJson.gstin && !currentStat.gstin) {
              currentStat.gstin = extractJson.gstin;
              hasStatUpdate = true;
            }
            if (extractJson.udyam_number && !currentStat.udyam_number) {
              currentStat.udyam_number = extractJson.udyam_number;
              hasStatUpdate = true;
            }
            if (extractJson.epfo_esic_number && !currentStat.epfo_esic_number) {
              currentStat.epfo_esic_number = extractJson.epfo_esic_number;
              hasStatUpdate = true;
            }

            if (hasStatUpdate) {
              await users.updateOne(
                { _id: new ObjectId(request.user.id) },
                { $set: { statutory: currentStat, updated_at: new Date() } }
              );

              // Sync updated statutory data with AI engine
              try {
                await fetch(`${ENGINE_URL}/bidders`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    bidder_id: request.user.bidder_id,
                    company_name: user.company_name,
                    udyam_number: currentStat.udyam_number || "",
                    gstin: currentStat.gstin || "",
                    pan: currentStat.pan || "",
                    epfo_esic_number: currentStat.epfo_esic_number || "",
                  }),
                });
              } catch (e) {
                console.warn("AI Engine sync error:", e.message);
              }
            }
          }
        } catch (extractErr) {
          console.warn("Notice: Document extraction warning:", extractErr.message);
        }
      }

      // Check if document of this type already exists in vault -> replace with newer version
      const existingDoc = await docs.findOne({
        bidder_id: request.user.bidder_id,
        document_type: docType,
      });

      const now = new Date();
      let docId;

      if (existingDoc) {
        // Clean up old file if distinct
        if (existingDoc.storage_path && fs.existsSync(existingDoc.storage_path)) {
          try {
            fs.unlinkSync(existingDoc.storage_path);
          } catch (e) {}
        }

        await docs.updateOne(
          { _id: existingDoc._id },
          {
            $set: {
              file_name: request.file.filename,
              original_name: request.file.originalname,
              mime_type: request.file.mimetype,
              file_size: request.file.size,
              storage_path: request.file.path,
              extracted_data: extractedData,
              uploaded_at: now,
              updated_at: now,
            },
          }
        );
        docId = existingDoc._id;
      } else {
        const insertRes = await docs.insertOne({
          bidder_user_id: request.user.id,
          bidder_id: request.user.bidder_id,
          document_type: docType,
          file_name: request.file.filename,
          original_name: request.file.originalname,
          mime_type: request.file.mimetype,
          file_size: request.file.size,
          storage_path: request.file.path,
          extracted_data: extractedData,
          uploaded_at: now,
          updated_at: now,
        });
        docId = insertRes.insertedId;
      }

      return response.status(201).json({
        success: true,
        message: `${DOC_TYPE_LABELS[docType] || docType} successfully uploaded and saved in vault.`,
        document: {
          id: docId.toString(),
          document_type: docType,
          document_label: DOC_TYPE_LABELS[docType] || docType,
          original_name: request.file.originalname,
          file_size: request.file.size,
          extracted_data: extractedData,
          uploaded_at: now,
        },
      });
    } catch (error) {
      if (request.file && fs.existsSync(request.file.path)) {
        fs.unlinkSync(request.file.path);
      }
      return next(error);
    }
  }
);

/**
 * DELETE /api/bidder/documents/:id
 * Removes document from bidder vault and disk.
 */
router.delete("/documents/:id", requireAuth, requireRole("bidder"), async (request, response, next) => {
  try {
    const docs = await getDocumentsCollection();
    let query;
    try {
      query = {
        _id: new ObjectId(request.params.id),
        $or: [{ bidder_user_id: request.user.id }, { bidder_id: request.user.bidder_id }],
      };
    } catch (e) {
      return response.status(400).json({ error: "Invalid document ID format." });
    }

    const doc = await docs.findOne(query);
    if (!doc) {
      return response.status(404).json({ error: "Document not found in your vault." });
    }

    if (doc.storage_path && fs.existsSync(doc.storage_path)) {
      try {
        fs.unlinkSync(doc.storage_path);
      } catch (e) {}
    }

    await docs.deleteOne({ _id: doc._id });

    return response.json({
      success: true,
      message: "Document removed from vault.",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/bidder/tenders
 * Lists available tenders with indicator of whether the bidder has already applied.
 */
router.get("/tenders", requireAuth, requireRole("bidder"), async (request, response, next) => {
  try {
    // 1. Fetch all tenders
    const tendersRes = await fetch(`${ENGINE_URL}/tenders`);
    const tendersList = await tendersRes.json();

    // 2. Fetch all applications by this bidder
    const applications = await getApplicationsCollection();
    const myApps = await applications
      .find({
        $or: [{ bidder_user_id: request.user.id }, { bidder_id: request.user.bidder_id }],
      })
      .toArray();

    const appMap = new Map();
    for (const app of myApps) {
      appMap.set(app.tender_id, app);
    }

    // 3. Fetch bidder's available documents
    const docs = await getDocumentsCollection();
    const myDocs = await docs
      .find({
        $or: [{ bidder_user_id: request.user.id }, { bidder_id: request.user.bidder_id }],
      })
      .toArray();

    const availableDocTypes = new Set(myDocs.map((d) => d.document_type));

    const enrichedTenders = tendersList.map((tender) => {
      const app = appMap.get(tender.tender_id);
      const mandatoryChecks = tender.mandatory_checks || [];

      // Determine required document types and which ones are currently satisfied
      const requirements = mandatoryChecks.map((check) => {
        const docType = CHECK_TO_DOC_TYPE[check];
        const hasDoc = docType ? availableDocTypes.has(docType) : true;
        return {
          check_key: check,
          doc_type: docType || null,
          label: DOC_TYPE_LABELS[docType] || check.toUpperCase(),
          satisfied: hasDoc,
        };
      });

      const missingRequirements = requirements.filter((r) => !r.satisfied);

      return {
        ...tender,
        requirements,
        all_requirements_satisfied: missingRequirements.length === 0,
        missing_count: missingRequirements.length,
        has_applied: Boolean(app),
        application: app
          ? {
              id: app._id.toString(),
              status: app.status,
              compliance_score: app.compliance_score,
              risk_level: app.risk_level,
              applied_at: app.applied_at,
              officer_comment: app.officer_comment,
            }
          : null,
      };
    });

    return response.json({
      success: true,
      tenders: enrichedTenders,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/tenders/:id/apply
 * Applies for a tender. Validates mandatory documents, reuses vault documents,
 * runs compliance engine evaluation, and saves snapshot to tender_applications.
 */
export const applyForTender = async (request, response, next) => {
  try {
    const rawId = request.params.id || request.params[0] || request.body?.tender_id;
    const tenderId = rawId ? decodeURIComponent(rawId).trim() : null;

    if (!tenderId) {
      return response.status(400).json({ error: "Missing required tender_id parameter." });
    }

    // 1. Fetch tender details
    const tendersRes = await fetch(`${ENGINE_URL}/tenders`);
    const tendersList = await tendersRes.json();
    const tender = tendersList.find((t) => t.tender_id === tenderId);

    if (!tender) {
      return response.status(404).json({ error: `Tender '${tenderId}' not found.` });
    }

    // 2. Check if already applied
    const applications = await getApplicationsCollection();
    const existingApp = await applications.findOne({
      tender_id: tenderId,
      $or: [{ bidder_user_id: request.user.id }, { bidder_id: request.user.bidder_id }],
    });

    if (existingApp) {
      return response.status(409).json({
        error: `You have already applied for tender '${tenderId}'. Current status: ${existingApp.status}`,
        application_id: existingApp._id.toString(),
      });
    }

    // 3. Mandatory Document Validation
    const docs = await getDocumentsCollection();
    const myDocs = await docs
      .find({
        $or: [{ bidder_user_id: request.user.id }, { bidder_id: request.user.bidder_id }],
      })
      .toArray();

    const docMap = new Map();
    for (const doc of myDocs) {
      docMap.set(doc.document_type, doc);
    }

    const mandatoryChecks = tender.mandatory_checks || [];
    const missingDocs = [];
    const submittedDocuments = [];

    for (const check of mandatoryChecks) {
      const requiredDocType = CHECK_TO_DOC_TYPE[check];
      if (requiredDocType) {
        const found = docMap.get(requiredDocType);
        if (!found) {
          missingDocs.push({
            check,
            document_type: requiredDocType,
            label: DOC_TYPE_LABELS[requiredDocType] || requiredDocType,
          });
        } else {
          // Reusing existing document from vault
          submittedDocuments.push({
            document_type: requiredDocType,
            document_id: found._id.toString(),
            file_name: found.original_name || found.file_name,
            uploaded_at: found.uploaded_at,
          });
        }
      }
    }

    // BLOCK APPLICATION if mandatory documents are missing!
    if (missingDocs.length > 0) {
      return response.status(400).json({
        error: "Application blocked: Missing mandatory compliance document(s).",
        missing_documents: missingDocs,
      });
    }

    // 4. Trigger AI Engine deterministic compliance verification for THIS tender
    const evalRes = await fetch(`${ENGINE_URL}/verify-compliance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bidder_id: request.user.bidder_id,
        tender_id: tender.tender_id,
        required_checks: mandatoryChecks,
      }),
    });

    const assessment = await evalRes.json();
    if (!evalRes.ok) {
      return response.status(evalRes.status).json(assessment);
    }

    const now = new Date();

    // 5. Record evaluation into immutable MongoDB audit collection
    const audit = await getAuditCollection();
    await audit.insertOne({
      bidder_id: request.user.bidder_id,
      tender_id: tender.tender_id,
      timestamp: assessment.audit_log_entry?.timestamp || now.toISOString(),
      compliance_score: assessment.compliance_score ?? 0,
      risk_level: assessment.risk_level ?? "Unknown",
      pending_manual_review: assessment.pending_manual_review ?? false,
      llm_briefing: assessment.llm_briefing?.text || null,
      officer_decision: null,
      officer_id: null,
    });

    // 6. Insert new tender application record
    const newApplication = {
      tender_id: tender.tender_id,
      tender_title: tender.title,
      tender_category: tender.category,
      bidder_user_id: request.user.id,
      bidder_id: request.user.bidder_id,
      company_name: request.user.company_name,
      contact_person: request.user.contact_person,
      phone: request.user.phone,
      email: request.user.email,
      submitted_documents: submittedDocuments,
      compliance_score: assessment.compliance_score ?? 0,
      risk_level: assessment.risk_level ?? "Unknown",
      checks: assessment.checks || [],
      llm_briefing: assessment.llm_briefing || null,
      status: "submitted", // 'submitted' | 'under_review' | 'info_requested' | 'approved' | 'rejected'
      applied_at: now,
      updated_at: now,
      decided_at: null,
      officer_id: null,
      officer_comment: null,
    };

    try {
      const insertResult = await applications.insertOne(newApplication);
      newApplication._id = insertResult.insertedId;
    } catch (insertErr) {
      if (insertErr.code === 11000) {
        return response.status(409).json({
          error: `You have already applied for tender '${tender.tender_id}'. Duplicate application prevented.`,
        });
      }
      throw insertErr;
    }

    return response.status(201).json({
      success: true,
      message: "Application submitted successfully with verified compliance evaluation.",
      application: {
        id: newApplication._id.toString(),
        tender_id: newApplication.tender_id,
        tender_title: newApplication.tender_title,
        compliance_score: newApplication.compliance_score,
        risk_level: newApplication.risk_level,
        status: newApplication.status,
        submitted_documents: newApplication.submitted_documents,
        applied_at: newApplication.applied_at,
      },
    });
  } catch (error) {
    return next(error);
  }
};
router.post(/^\/tenders\/(.+)\/apply$/, requireAuth, requireRole("bidder"), (req, res, next) => {
  req.params.id = req.params[0];
  return applyForTender(req, res, next);
});
router.post("/tenders/apply", requireAuth, requireRole("bidder"), applyForTender);
router.post("/tenders/:id/apply", requireAuth, requireRole("bidder"), applyForTender);

/**
 * GET /api/bidder/applications
 * Lists all tender applications submitted by this bidder with status and feedback.
 */
router.get("/applications", requireAuth, requireRole("bidder"), async (request, response, next) => {
  try {
    const applications = await getApplicationsCollection();
    const appList = await applications
      .find({
        $or: [{ bidder_user_id: request.user.id }, { bidder_id: request.user.bidder_id }],
      })
      .sort({ applied_at: -1 })
      .toArray();

    return response.json({
      success: true,
      applications: appList.map((a) => ({
        id: a._id.toString(),
        tender_id: a.tender_id,
        tender_title: a.tender_title,
        tender_category: a.tender_category,
        compliance_score: a.compliance_score,
        risk_level: a.risk_level,
        status: a.status,
        submitted_documents: a.submitted_documents || [],
        applied_at: a.applied_at,
        decided_at: a.decided_at,
        officer_comment: a.officer_comment,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/applications/:id/resubmit-info
 * Allows bidder to update application when 'info_requested' by an officer.
 */
export const resubmitInfo = async (request, response, next) => {
    try {
      const { note } = request.body;
      const applications = await getApplicationsCollection();

      let query;
      try {
        query = {
          _id: new ObjectId(request.params.id),
          $or: [{ bidder_user_id: request.user.id }, { bidder_id: request.user.bidder_id }],
        };
      } catch (e) {
        return response.status(400).json({ error: "Invalid application ID format." });
      }

      const app = await applications.findOne(query);
      if (!app) {
        return response.status(404).json({ error: "Application not found." });
      }

      if (app.status !== "info_requested") {
        return response.status(400).json({
          error: `Cannot resubmit information for application with status '${app.status}'.`,
        });
      }

      // Re-snapshot all current vault documents
      const docs = await getDocumentsCollection();
      const myDocs = await docs
        .find({
          $or: [{ bidder_user_id: request.user.id }, { bidder_id: request.user.bidder_id }],
        })
        .toArray();

      const updatedDocs = myDocs.map((d) => ({
        document_type: d.document_type,
        document_id: d._id.toString(),
        file_name: d.original_name || d.file_name,
        uploaded_at: d.uploaded_at,
      }));

      await applications.updateOne(
        { _id: app._id },
        {
          $set: {
            status: "under_review",
            submitted_documents: updatedDocs,
            bidder_response_note: (note || "").trim(),
            updated_at: new Date(),
          },
        }
      );

      return response.json({
        success: true,
        message: "Updated documents and clarification submitted for officer review.",
      });
    } catch (error) {
      return next(error);
    }
};
router.post("/applications/:id/resubmit-info", requireAuth, requireRole("bidder"), resubmitInfo);

export default router;
