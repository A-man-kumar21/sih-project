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
  "other_statutory",
]);

export const isMultiDocCategory = (type) => type === "other" || type === "other_statutory";

// Map tender mandatory checks to document types
export const CHECK_TO_DOC_TYPE = {
  udyam: "udyam_cert",
  gstn: "gstin_cert",
  pan_it: "pan_card",
  epfo_esic: "epfo_esic_cert",
  digilocker: "digilocker_proof",
  blacklist: "other",
};

// Map document types to friendly labels
export const DOC_TYPE_LABELS = {
  udyam_cert: "Udyam / MSME Certificate",
  gstin_cert: "GST Registration Certificate",
  pan_card: "Permanent Account Number (PAN) Card",
  epfo_esic_cert: "EPFO / ESIC Establishment Proof",
  digilocker_proof: "DigiLocker Verified Credential",
  other: "Other Statutory / Technical Document",
  other_statutory: "Other Statutory / Technical Document",
};

import {
  cleanIdentifier,
  resolveBidderCompliance,
  PAN_REGEX,
  GSTIN_REGEX,
  UDYAM_REGEX,
  EPFO_ESIC_REGEX,
  CIN_REGEX,
} from "../complianceResolver.js";

export function buildDefaultEnterpriseProfile() {
  const emptyField = () => ({
    value: "",
    source: null,
    source_doc_id: null,
    source_doc_name: null,
    confidence: null,
    extraction_method: null,
    extraction_status: "empty",
    last_updated: null,
  });

  return {
    enterprise_name: emptyField(),
    udyam_number: emptyField(),
    udyam: emptyField(),
    enterprise_type: emptyField(),
    gstin: emptyField(),
    pan: emptyField(),
    cin: emptyField(),
    business_constitution: emptyField(),
    registered_address: emptyField(),
    registration_date: emptyField(),
    epfo_number: emptyField(),
    esic_number: emptyField(),
    epfo_esic_number: emptyField(),
  };
}

export function mergeExtractedIntoProfile(existingProfile, extracted, docType, docId, docName, confidence = 0.98, extractionMethod = "pymupdf") {
  const profile = existingProfile || buildDefaultEnterpriseProfile();
  const nowIso = new Date().toISOString();
  const sourceLabel = DOC_TYPE_LABELS[docType] || docType || "Uploaded Document";

  const updateField = (key, val) => {
    if (!val || typeof val !== "string" || !val.trim()) return;
    const newVal = val.trim();
    const current = profile[key] || { value: "", extraction_status: "empty" };
    const currentVal = (current.value || "").trim();

    // Check equivalence (ignoring whitespace and casing)
    const isCleanMatch =
      currentVal.toLowerCase().replace(/[\s\-_]/g, "") ===
      newVal.toLowerCase().replace(/[\s\-_]/g, "");

    if (currentVal && !isCleanMatch) {
      // Conflicting value detected: do not silently overwrite reliable existing data
      // 1. If currently manual / user-confirmed, preserve manual value and flag conflict
      if (current.extraction_status === "manual") {
        profile[key].conflict = {
          detected: true,
          conflicting_value: newVal,
          conflicting_source: sourceLabel,
          conflicting_doc_name: docName || null,
          confidence: confidence != null ? confidence : 0.98,
          extraction_method: extractionMethod || "pymupdf",
          timestamp: nowIso,
          reason: "Newly extracted value differs from manually confirmed profile value",
        };
        return;
      }

      // 2. Primary document authority takes precedence over secondary/other documents
      const isCurrentPrimary =
        (key === "pan" && (current.source?.includes("PAN") || current.source_doc_name?.toLowerCase().includes("pan"))) ||
        (key === "gstin" && (current.source?.includes("GST") || current.source_doc_name?.toLowerCase().includes("gst"))) ||
        ((key === "udyam_number" || key === "udyam") && (current.source?.includes("Udyam") || current.source_doc_name?.toLowerCase().includes("udyam")));

      const isNewPrimary =
        (key === "pan" && docType === "pan_card") ||
        (key === "gstin" && docType === "gstin_cert") ||
        ((key === "udyam_number" || key === "udyam") && docType === "udyam_cert");

      if (isCurrentPrimary && !isNewPrimary) {
        profile[key].conflict = {
          detected: true,
          conflicting_value: newVal,
          conflicting_source: sourceLabel,
          conflicting_doc_name: docName || null,
          confidence: confidence != null ? confidence : 0.98,
          extraction_method: extractionMethod || "pymupdf",
          timestamp: nowIso,
          reason: "Extracted value differs from authoritative primary certificate",
        };
        return;
      }

      // 3. Compare confidences
      const currentConf = current.confidence != null ? current.confidence : 0.98;
      const newConf = confidence != null ? confidence : 0.98;

      if (currentConf >= newConf && !isNewPrimary) {
        profile[key].conflict = {
          detected: true,
          conflicting_value: newVal,
          conflicting_source: sourceLabel,
          conflicting_doc_name: docName || null,
          confidence: newConf,
          extraction_method: extractionMethod || "pymupdf",
          timestamp: nowIso,
          reason: "Extracted value has lower or equal confidence than existing record",
        };
        return;
      }

      // If new extraction is primary or significantly higher confidence, adopt with audit trail
      profile[key] = {
        value: newVal,
        source: sourceLabel,
        source_doc_id: docId ? docId.toString() : null,
        source_doc_name: docName || null,
        confidence: newConf,
        extraction_method: extractionMethod || "pymupdf",
        extraction_status: "successful",
        last_updated: nowIso,
        conflict: {
          detected: true,
          previous_value: currentVal,
          previous_source: current.source,
          conflicting_value: newVal,
          conflicting_source: sourceLabel,
          conflicting_doc_name: docName || null,
          timestamp: nowIso,
          reason: "Updated to higher confidence / primary extraction",
        },
      };
      return;
    }

    // No conflict or previously empty: populate field cleanly
    profile[key] = {
      value: newVal,
      source: sourceLabel,
      source_doc_id: docId ? docId.toString() : null,
      source_doc_name: docName || null,
      confidence: confidence != null ? confidence : 0.98,
      extraction_method: extractionMethod || "pymupdf",
      extraction_status: current.extraction_status === "manual" && isCleanMatch ? "manual" : "successful",
      last_updated: nowIso,
      conflict: null,
    };
  };

  const fields = extracted?.fields || extracted?.extracted || extracted || {};

  // Company / Enterprise Name aliases
  const compName = fields.enterprise_name || fields.company_name || fields.companyName || fields.legal_name || fields.trade_name;
  if (compName && typeof compName === "string" && compName.trim() && !compName.includes("DEMO DOCUMENT")) {
    updateField("enterprise_name", compName.trim());
  }

  // Udyam aliases
  const udyamVal = fields.udyam || fields.udyam_number || fields.udyamNumber || fields.udyam_registration || fields.udyam_registration_number || fields.msme;
  if (udyamVal) {
    const cleaned = cleanIdentifier(udyamVal);
    updateField("udyam_number", cleaned);
    updateField("udyam", cleaned);
  }

  if (fields.enterprise_type) {
    let et = fields.enterprise_type;
    if (typeof et === "string") {
      const etLow = et.toLowerCase();
      if (etLow.includes("micro") || etLow.includes("startup")) et = "Micro";
      else if (etLow.includes("small")) et = "Small";
      else if (etLow.includes("medium")) et = "Medium";
      else if (etLow.includes("large") || etLow.includes("non-msme")) et = "Large";
    }
    updateField("enterprise_type", et);
  }

  // GST aliases
  const gstVal = fields.gstin || fields.gst || fields.gstNumber || fields.gst_registration || fields.gst_number;
  if (gstVal) {
    const cleaned = cleanIdentifier(gstVal);
    updateField("gstin", cleaned);
    // Auto-derive PAN if not separately provided
    if (!fields.pan && cleaned.length === 15) {
      updateField("pan", cleaned.substring(2, 12).toUpperCase());
    }
  }

  // PAN aliases
  const panVal = fields.pan || fields.panNumber || fields.pan_it || fields.pan_it_number || fields.pan_card;
  if (panVal) {
    updateField("pan", cleanIdentifier(panVal));
  }

  // CIN aliases
  const cinVal = fields.cin || fields.cin_number;
  if (cinVal) {
    updateField("cin", cleanIdentifier(cinVal));
  }

  if (fields.business_constitution) {
    updateField("business_constitution", fields.business_constitution);
  }
  if (fields.registered_address) {
    updateField("registered_address", fields.registered_address);
  }
  if (fields.registration_date) {
    updateField("registration_date", fields.registration_date);
  }

  // EPFO / ESIC aliases
  const epfoVal = fields.epfo_number || fields.epfo || fields.epfo_code;
  if (epfoVal) {
    const cleanedEpfo = cleanIdentifier(epfoVal);
    updateField("epfo_number", cleanedEpfo);
    if (!profile.epfo_esic_number?.value) {
      updateField("epfo_esic_number", cleanedEpfo);
    }
  }
  const esicVal = fields.esic_number || fields.esic || fields.esic_code;
  if (esicVal) {
    const cleanedEsic = cleanIdentifier(esicVal);
    updateField("esic_number", cleanedEsic);
    if (!profile.epfo_esic_number?.value) {
      updateField("epfo_esic_number", cleanedEsic);
    }
  }
  if (fields.epfo_esic_number) {
    updateField("epfo_esic_number", cleanIdentifier(fields.epfo_esic_number));
  }

  return profile;
}

/**
 * GET /api/bidder/profile
 * Returns bidder profile, Enterprise Profile with field provenance, and statutory credentials.
 * Includes auto-backfill from existing Document Vault items if profile fields are empty.
 */
router.get("/profile", requireAuth, requireRole("bidder"), async (request, response, next) => {
  try {
    const users = await getUsersCollection();
    const user = await users.findOne({ _id: new ObjectId(request.user.id) });
    if (!user) {
      return response.status(404).json({ error: "Bidder profile not found." });
    }

    let enterpriseProfile = user.enterprise_profile || buildDefaultEnterpriseProfile();
    let currentStat = user.statutory || { pan: "", gstin: "", udyam_number: "", epfo_esic_number: "" };
    let hasBackfillUpdates = false;

    // Self-healing / backfill: check Document Vault for existing extracted certificates
    const docs = await getDocumentsCollection();
    const myDocs = await docs
      .find({
        $or: [{ bidder_user_id: request.user.id }, { bidder_id: request.user.bidder_id }],
      })
      .toArray();

    for (const doc of myDocs) {
      const ext = doc.extracted_data?.fields || doc.extracted_data?.extracted || doc.extracted_data;
      if (ext && typeof ext === "object") {
        const conf = doc.extracted_data?.confidence != null ? doc.extracted_data.confidence : 0.98;
        const method = doc.extracted_data?.extractionMethod || doc.extracted_data?.extraction_method || "pymupdf";
        enterpriseProfile = mergeExtractedIntoProfile(
          enterpriseProfile,
          ext,
          doc.document_type,
          doc._id,
          doc.original_name || doc.file_name,
          conf,
          method
        );

        // Update statutory credentials if document has verified statutory values
        if (ext.pan && PAN_REGEX.test(ext.pan) && (!currentStat.pan || !PAN_REGEX.test(currentStat.pan))) {
          currentStat.pan = ext.pan.trim().toUpperCase();
          hasBackfillUpdates = true;
        }
        if (ext.gstin && GSTIN_REGEX.test(ext.gstin) && (!currentStat.gstin || !GSTIN_REGEX.test(currentStat.gstin))) {
          currentStat.gstin = ext.gstin.trim().toUpperCase();
          hasBackfillUpdates = true;
          if (!currentStat.pan || !PAN_REGEX.test(currentStat.pan)) {
            currentStat.pan = currentStat.gstin.substring(2, 12).toUpperCase();
            hasBackfillUpdates = true;
          }
        }
        if (ext.udyam_number && UDYAM_REGEX.test(ext.udyam_number) && (!currentStat.udyam_number || !UDYAM_REGEX.test(currentStat.udyam_number))) {
          currentStat.udyam_number = ext.udyam_number.trim().toUpperCase();
          hasBackfillUpdates = true;
        }
        if (ext.cin && (!currentStat.cin || currentStat.cin.length < 5)) {
          currentStat.cin = ext.cin.trim().toUpperCase();
          hasBackfillUpdates = true;
        }
        if (ext.epfo_number && (!currentStat.epfo_number || currentStat.epfo_number.length < 5)) {
          currentStat.epfo_number = ext.epfo_number.trim().toUpperCase();
          hasBackfillUpdates = true;
        }
        if (ext.esic_number && (!currentStat.esic_number || currentStat.esic_number.length < 5)) {
          currentStat.esic_number = ext.esic_number.trim().toUpperCase();
          hasBackfillUpdates = true;
        }
        if ((ext.epfo_esic_number || ext.epfo_number) && (!currentStat.epfo_esic_number || currentStat.epfo_esic_number.length < 5)) {
          currentStat.epfo_esic_number = (ext.epfo_esic_number || ext.epfo_number).trim().toUpperCase();
          hasBackfillUpdates = true;
        }
        if (ext.registration_date && !currentStat.registration_date) {
          currentStat.registration_date = ext.registration_date;
          hasBackfillUpdates = true;
        }
        if (ext.enterprise_type && !currentStat.enterprise_type) {
          currentStat.enterprise_type = ext.enterprise_type;
          hasBackfillUpdates = true;
        }
        if (ext.registered_address && !currentStat.registered_address) {
          currentStat.registered_address = ext.registered_address;
          hasBackfillUpdates = true;
        }
        if (ext.business_constitution && !currentStat.business_constitution) {
          currentStat.business_constitution = ext.business_constitution;
          hasBackfillUpdates = true;
        }
      }
    }

    const profileKeys = [
      "enterprise_name", "udyam_number", "pan", "gstin", "cin",
      "epfo_number", "esic_number", "enterprise_type", "registration_date",
      "registered_address", "business_constitution"
    ];
    for (const k of profileKeys) {
      if (enterpriseProfile[k]?.value && (!user.enterprise_profile || !user.enterprise_profile[k]?.value)) {
        hasBackfillUpdates = true;
      }
    }

    if (hasBackfillUpdates || !user.enterprise_profile) {
      await users.updateOne(
        { _id: new ObjectId(request.user.id) },
        {
          $set: {
            enterprise_profile: enterpriseProfile,
            statutory: currentStat,
            updated_at: new Date(),
          },
        }
      );

      // Re-resolve canonical compliance & sync AI Engine
      try {
        await resolveBidderCompliance(request.user.id);
      } catch (e) {}

      // Sync repaired statutory details with AI Engine
      try {
        await fetch(`${ENGINE_URL}/bidders`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            bidder_id: user.bidder_id,
            company_name: enterpriseProfile.enterprise_name?.value || user.company_name,
            udyam_number: currentStat.udyam_number || "",
            gstin: currentStat.gstin || "",
            pan: currentStat.pan || "",
            cin: currentStat.cin || "",
            epfo_number: currentStat.epfo_number || "",
            esic_number: currentStat.esic_number || "",
            epfo_esic_number: currentStat.epfo_esic_number || "",
            business_constitution: enterpriseProfile.business_constitution?.value || "",
            registered_address: enterpriseProfile.registered_address?.value || "",
            registration_date: enterpriseProfile.registration_date?.value || "",
            enterprise_type: enterpriseProfile.enterprise_type?.value || "",
          }),
        });
      } catch (syncErr) {
        console.warn("Notice: AI Engine sync on backfill:", syncErr.message);
      }
    }

    return response.json({
      success: true,
      profile: {
        id: user._id.toString(),
        company_name: enterpriseProfile.enterprise_name?.value || user.company_name || "",
        contact_person: user.contact_person || "",
        email: user.email,
        phone: user.phone || "",
        bidder_id: user.bidder_id,
        enterprise_profile: enterpriseProfile,
        statutory: currentStat,
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
 * Updates bidder profile, handles manual Enterprise Profile overrides with provenance,
 * and synchronizes statutory details with AI Engine.
 */
router.put("/profile", requireAuth, requireRole("bidder"), async (request, response, next) => {
  try {
    const {
      company_name,
      contact_person,
      phone,
      enterprise_name,
      pan,
      gstin,
      udyam_number,
      cin,
      epfo_number,
      esic_number,
      epfo_esic_number,
      business_constitution,
      registered_address,
      registration_date,
      enterprise_type,
    } = request.body;

    const users = await getUsersCollection();
    const existing = await users.findOne({ _id: new ObjectId(request.user.id) });
    if (!existing) {
      return response.status(404).json({ error: "Bidder profile not found." });
    }

    const updatedCompany = (enterprise_name || company_name || existing.company_name || "").trim();
    const updatedContact = contact_person !== undefined ? contact_person.trim() : existing.contact_person;
    const updatedPhone = phone !== undefined ? phone.trim() : existing.phone;

    let enterpriseProfile = existing.enterprise_profile || buildDefaultEnterpriseProfile();
    const nowIso = new Date().toISOString();

    const applyManualField = (key, val) => {
      if (val !== undefined) {
        const cleanVal = typeof val === "string" ? val.trim() : "";
        enterpriseProfile[key] = {
          value: cleanVal,
          source: "Manual Entry",
          source_doc_id: null,
          source_doc_name: null,
          confidence: cleanVal ? 1.0 : null,
          extraction_method: "manual",
          extraction_status: cleanVal ? "manual" : "empty",
          last_updated: nowIso,
          conflict: null,
        };
      }
    };

    if (enterprise_name !== undefined || company_name !== undefined) {
      applyManualField("enterprise_name", updatedCompany);
    }
    if (pan !== undefined) applyManualField("pan", pan.toUpperCase());
    if (gstin !== undefined) applyManualField("gstin", gstin.toUpperCase());
    if (udyam_number !== undefined) applyManualField("udyam_number", udyam_number.toUpperCase());
    if (cin !== undefined) applyManualField("cin", cin.toUpperCase());
    if (epfo_number !== undefined) applyManualField("epfo_number", epfo_number.toUpperCase());
    if (esic_number !== undefined) applyManualField("esic_number", esic_number.toUpperCase());
    if (epfo_esic_number !== undefined) applyManualField("epfo_esic_number", epfo_esic_number);
    if (business_constitution !== undefined) applyManualField("business_constitution", business_constitution);
    if (registered_address !== undefined) applyManualField("registered_address", registered_address);
    if (registration_date !== undefined) applyManualField("registration_date", registration_date);
    if (enterprise_type !== undefined) applyManualField("enterprise_type", enterprise_type);

    const currentStat = existing.statutory || {};
    const updatedStatutory = {
      pan: pan !== undefined ? pan.trim().toUpperCase() : enterpriseProfile.pan?.value || currentStat.pan || "",
      gstin: gstin !== undefined ? gstin.trim().toUpperCase() : enterpriseProfile.gstin?.value || currentStat.gstin || "",
      udyam_number: udyam_number !== undefined ? udyam_number.trim().toUpperCase() : enterpriseProfile.udyam_number?.value || currentStat.udyam_number || "",
      cin: cin !== undefined ? cin.trim().toUpperCase() : enterpriseProfile.cin?.value || currentStat.cin || "",
      epfo_number: epfo_number !== undefined ? epfo_number.trim().toUpperCase() : enterpriseProfile.epfo_number?.value || currentStat.epfo_number || "",
      esic_number: esic_number !== undefined ? esic_number.trim().toUpperCase() : enterpriseProfile.esic_number?.value || currentStat.esic_number || "",
      epfo_esic_number: epfo_esic_number !== undefined ? epfo_esic_number.trim() : enterpriseProfile.epfo_esic_number?.value || currentStat.epfo_esic_number || "",
    };

    // Auto-extract PAN from GSTIN if PAN is missing
    if (!updatedStatutory.pan && updatedStatutory.gstin && updatedStatutory.gstin.length === 15) {
      updatedStatutory.pan = updatedStatutory.gstin.substring(2, 12).toUpperCase();
      if (!enterpriseProfile.pan?.value) {
        enterpriseProfile.pan = {
          value: updatedStatutory.pan,
          source: "Derived from GSTIN",
          source_doc_id: null,
          source_doc_name: null,
          confidence: 0.98,
          extraction_method: "derived",
          extraction_status: "successful",
          last_updated: nowIso,
        };
      }
    }

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
          cin: updatedStatutory.cin,
          epfo_number: updatedStatutory.epfo_number,
          esic_number: updatedStatutory.esic_number,
          epfo_esic_number: updatedStatutory.epfo_esic_number,
          business_constitution: enterpriseProfile.business_constitution?.value || "",
          registered_address: enterpriseProfile.registered_address?.value || "",
          registration_date: enterpriseProfile.registration_date?.value || "",
          enterprise_type: enterpriseProfile.enterprise_type?.value || "",
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
          enterprise_profile: enterpriseProfile,
          statutory: updatedStatutory,
          updated_at: new Date(),
        },
      }
    );

    // Sync canonical compliance resolver with AI engine
    await resolveBidderCompliance(request.user.id);

    return response.json({
      success: true,
      message: "Enterprise profile and statutory identifiers successfully synchronized with compliance engine.",
      profile: {
        company_name: updatedCompany,
        contact_person: updatedContact,
        phone: updatedPhone,
        enterprise_profile: enterpriseProfile,
        statutory: updatedStatutory,
      },
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

      // If document is PDF or image, trigger deterministic extraction
      const extName = path.extname(request.file.originalname).toLowerCase();
      const isPdfOrImage =
        [".pdf", ".png", ".jpg", ".jpeg"].includes(extName) ||
        (request.file.mimetype && (request.file.mimetype.startsWith("image/") || request.file.mimetype === "application/pdf"));

      if (isPdfOrImage) {
        try {
          const fileBuffer = fs.readFileSync(request.file.path);
          const formData = new FormData();
          const mimeType = request.file.mimetype || (extName === ".pdf" ? "application/pdf" : "image/png");
          const blob = new Blob([fileBuffer], { type: mimeType });
          formData.append("file", blob, request.file.originalname);

          const extractRes = await fetch(`${ENGINE_URL}/extract-bidder-pdf?document_type=${encodeURIComponent(docType)}`, {
            method: "POST",
            body: formData,
          });

          if (extractRes.ok) {
            extractedData = await extractRes.json();
          }
        } catch (extractErr) {
          console.warn("Notice: Document extraction warning:", extractErr.message);
        }
      }

      // Check if document of this type already exists in vault
      // Singleton categories (PAN, GST, Udyam, etc.) replace with newer version.
      // Multi-document categories ("other", "other_statutory") NEVER replace existing documents.
      const isMulti = isMultiDocCategory(docType);
      const existingDoc = isMulti
        ? null
        : await docs.findOne({
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

      // AUTOMATIC ENTERPRISE PROFILE EXTRACTION & STATUTORY SYNC (Part B, E, F, I, K)
      if (extractedData && (extractedData.fields || extractedData.extracted || typeof extractedData === "object")) {
        const ext = extractedData.fields || extractedData.extracted || extractedData;
        const user = await users.findOne({ _id: new ObjectId(request.user.id) });
        if (user) {
          const conf = extractedData.confidence != null ? extractedData.confidence : 0.98;
          const method = extractedData.extractionMethod || extractedData.extraction_method || "pymupdf";
          let enterpriseProfile = user.enterprise_profile || buildDefaultEnterpriseProfile();

          // Merge structured extracted fields with provenance
          enterpriseProfile = mergeExtractedIntoProfile(
            enterpriseProfile,
            ext,
            docType,
            docId,
            request.file.originalname,
            conf,
            method
          );

          await users.updateOne(
            { _id: new ObjectId(request.user.id) },
            {
              $set: {
                enterprise_profile: enterpriseProfile,
                updated_at: new Date(),
              },
            }
          );

          // Canonical statutory resolution and deterministic AI Engine synchronization
          await resolveBidderCompliance(request.user.id, { logDiagnostics: true });
        }
      }

      return response.status(201).json({
        success: true,
        message: `${DOC_TYPE_LABELS[docType] || docType} successfully uploaded, extracted, and synced with Enterprise Profile.`,
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
        let hasDoc = docType ? availableDocTypes.has(docType) : true;
        if (!hasDoc && (docType === "other" || docType === "other_statutory")) {
          hasDoc = availableDocTypes.has("other") || availableDocTypes.has("other_statutory");
        }
        // Also check if any uploaded document in vault (e.g. other_statutory / 00_Bidder_Profile.pdf) contains verified statutory field
        if (!hasDoc) {
          hasDoc = myDocs.some((d) => {
            const ext = d.extracted_data?.fields || d.extracted_data?.extracted || d.extracted_data;
            if (!ext) return false;
            if (check === "pan_it" && ext.pan) return true;
            if (check === "gstn" && ext.gstin) return true;
            if (check === "udyam" && (ext.udyam || ext.udyam_number)) return true;
            if (check === "epfo_esic" && (ext.epfo_number || ext.epfo || ext.esic_number || ext.esic || ext.epfo_esic_number)) return true;
            return false;
          });
        }
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
        let found = docMap.get(requiredDocType);
        if (!found && (requiredDocType === "other" || requiredDocType === "other_statutory")) {
          found = docMap.get("other_statutory") || docMap.get("other");
        }
        if (!found) {
          found = myDocs.find((d) => {
            const ext = d.extracted_data?.fields || d.extracted_data?.extracted || d.extracted_data;
            if (!ext) return false;
            if (check === "pan_it" && ext.pan) return true;
            if (check === "gstn" && ext.gstin) return true;
            if (check === "udyam" && (ext.udyam || ext.udyam_number)) return true;
            if (check === "epfo_esic" && (ext.epfo_number || ext.epfo || ext.esic_number || ext.esic || ext.epfo_esic_number)) return true;
            return false;
          });
        }
        if (!found) {
          missingDocs.push({
            check,
            document_type: requiredDocType,
            label: DOC_TYPE_LABELS[requiredDocType] || requiredDocType,
          });
        } else {
          // Reusing existing document from vault
          submittedDocuments.push({
            document_type: found.document_type || requiredDocType,
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

    // Ensure bidder's statutory credentials from profile and vault documents are synchronized to AI Engine
    const resolvedCompliance = await resolveBidderCompliance(request.user.id, {
      tenderId: tender.tender_id,
      requiredChecks: mandatoryChecks,
      logDiagnostics: true,
    });

    const stat = resolvedCompliance.statutory;
    const provenance = resolvedCompliance.provenance;

    // 4. Trigger AI Engine deterministic compliance verification for THIS tender
    const evalRes = await fetch(`${ENGINE_URL}/verify-compliance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bidder_id: request.user.bidder_id,
        tender_id: tender.tender_id,
        required_checks: mandatoryChecks,
        company_name: stat.company_name || request.user.company_name,
        udyam_number: stat.udyam_number || "",
        gstin: stat.gstin || "",
        pan: stat.pan || "",
        cin: stat.cin || "",
        epfo_esic_number: stat.epfo_esic_number || "",
        business_constitution: stat.business_constitution || "",
        registered_address: stat.registered_address || "",
        registration_date: stat.registration_date || "",
        enterprise_type: stat.enterprise_type || "",
      }),
    });

    const assessment = await evalRes.json();
    if (!evalRes.ok) {
      return response.status(evalRes.status).json(assessment);
    }

    // Enrich assessment checks with extraction provenance & verified values
    if (Array.isArray(assessment.checks)) {
      for (const chk of assessment.checks) {
        if (chk.source === "udyam" && stat.udyam_number) {
          chk.verified_value = stat.udyam_number;
          chk.extraction_source = provenance.udyam?.source || "✓ Auto-extracted from Udyam Certificate";
          chk.provenance = provenance.udyam;
        } else if (chk.source === "gstn" && stat.gstin) {
          chk.verified_value = stat.gstin;
          chk.extraction_source = provenance.gstin?.source || "✓ Auto-extracted from GST Certificate";
          chk.provenance = provenance.gstin;
        } else if (chk.source === "pan_it" && stat.pan) {
          chk.verified_value = stat.pan;
          chk.extraction_source = provenance.pan?.source || "✓ Auto-extracted from PAN Document";
          chk.provenance = provenance.pan;
        } else if (chk.source === "epfo_esic" && stat.epfo_esic_number) {
          chk.verified_value = stat.epfo_esic_number;
          chk.extraction_source = provenance.epfo_esic?.source || "✓ Auto-extracted from EPFO / ESIC Document";
          chk.provenance = provenance.epfo_esic;
        }
      }
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
        checks: newApplication.checks,
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
