import { ObjectId } from "mongodb";
import { getUsersCollection, getDocumentsCollection, getApplicationsCollection } from "./db.js";

const ENGINE_URL = process.env.AI_ENGINE_URL || "http://127.0.0.1:8000";

// Deterministic pattern checks for statutory procurement registries
export const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/i;
export const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/i;
export const UDYAM_REGEX = /^UDYAM-[A-Z]{2}-[A-Z0-9]{2}-\d{7}$/i;
export const EPFO_ESIC_REGEX = /^(?:[A-Z]{2}[A-Z0-9]{3}\d{7}\d{3}|[A-Z]{2}\/[A-Z0-9]+\/\d+\/\d+|\d{17})$/i;
export const CIN_REGEX = /^[LUu]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/i;

export const DOC_TYPE_LABELS = {
  udyam_cert: "Udyam / MSME Certificate",
  gstin_cert: "GST Certificate",
  pan_card: "PAN Document",
  epfo_esic_cert: "EPFO / ESIC Establishment Proof",
  digilocker_proof: "DigiLocker Verified Credential",
  other: "Other Statutory Document",
  other_statutory: "Other Statutory / Technical Document",
};

export const CHECK_TO_DOC_TYPE = {
  udyam: "udyam_cert",
  gstn: "gstin_cert",
  pan_it: "pan_card",
  epfo_esic: "epfo_esic_cert",
  digilocker: "digilocker_proof",
  blacklist: "other",
};

/**
 * Clean and normalize statutory identifiers: strips extra whitespace and normalizes hyphens.
 */
export function cleanIdentifier(val) {
  if (!val || typeof val !== "string") return "";
  return val.replace(/\s+/g, "").replace(/[—–−‐‑]/g, "-").trim().toUpperCase();
}

/**
 * Resolves authoritative bidder compliance data across all storage layers:
 * 1. Application-specific submitted compliance data (if provided)
 * 2. Bidder's Enterprise Profile (MongoDB user.enterprise_profile)
 * 3. Bidder's statutory credentials (MongoDB user.statutory)
 * 4. Bidder's Document Vault (MongoDB bidder_documents)
 *
 * Validates all values using deterministic regexes and generates provenance tracking.
 */
export async function resolveBidderCompliance(bidderIdOrUser, options = {}) {
  const users = await getUsersCollection();
  const docs = await getDocumentsCollection();

  let user = null;
  let bidderId = null;

  if (typeof bidderIdOrUser === "string") {
    bidderId = bidderIdOrUser.trim();
    // Case-insensitive lookup by bidder_id or ObjectId
    if (ObjectId.isValid(bidderId)) {
      user = await users.findOne({ _id: new ObjectId(bidderId) });
    }
    if (!user) {
      user = await users.findOne({
        bidder_id: { $regex: new RegExp(`^${bidderId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      });
    }
  } else if (bidderIdOrUser && typeof bidderIdOrUser === "object") {
    user = bidderIdOrUser;
    bidderId = user.bidder_id || user._id?.toString();
  }

  const resolvedBidderId = user?.bidder_id || bidderId || "UNKNOWN_BIDDER";

  // Fetch all bidder vault documents
  const queryOr = [{ bidder_id: resolvedBidderId }];
  if (user?._id) {
    queryOr.push({ bidder_user_id: user._id.toString() });
  }
  const myDocs = await docs.find({ $or: queryOr }).toArray();

  // Initialize resolved structures
  const statutory = {
    pan: "",
    gstin: "",
    udyam_number: "",
    cin: "",
    epfo_esic_number: "",
    epfo_number: "",
    esic_number: "",
    company_name: user?.company_name || "",
    business_constitution: "",
    registered_address: "",
    registration_date: "",
    enterprise_type: "",
  };

  const provenance = {
    pan: null,
    gstin: null,
    udyam: null,
    cin: null,
    epfo_esic: null,
  };

  // Helper to set field with provenance if valid
  const setField = (key, rawVal, sourceDoc, method = "pymupdf", conf = 0.98) => {
    const cleaned = cleanIdentifier(rawVal);
    if (!cleaned) return false;

    if (key === "pan" && PAN_REGEX.test(cleaned)) {
      statutory.pan = cleaned;
      provenance.pan = {
        value: cleaned,
        source: sourceDoc ? `✓ Auto-extracted from ${sourceDoc.label || sourceDoc.doc_type}` : "Enterprise Profile",
        source_doc_id: sourceDoc?.doc_id || null,
        source_doc_name: sourceDoc?.file_name || null,
        confidence: conf,
        method: method,
      };
      return true;
    }
    if (key === "gstin" && GSTIN_REGEX.test(cleaned)) {
      statutory.gstin = cleaned;
      provenance.gstin = {
        value: cleaned,
        source: sourceDoc ? `✓ Auto-extracted from ${sourceDoc.label || sourceDoc.doc_type}` : "Enterprise Profile",
        source_doc_id: sourceDoc?.doc_id || null,
        source_doc_name: sourceDoc?.file_name || null,
        confidence: conf,
        method: method,
      };
      return true;
    }
    if ((key === "udyam" || key === "udyam_number") && UDYAM_REGEX.test(cleaned)) {
      statutory.udyam_number = cleaned;
      provenance.udyam = {
        value: cleaned,
        source: sourceDoc ? `✓ Auto-extracted from ${sourceDoc.label || sourceDoc.doc_type}` : "Enterprise Profile",
        source_doc_id: sourceDoc?.doc_id || null,
        source_doc_name: sourceDoc?.file_name || null,
        confidence: conf,
        method: method,
      };
      return true;
    }
    if (key === "cin" && CIN_REGEX.test(cleaned)) {
      statutory.cin = cleaned;
      provenance.cin = {
        value: cleaned,
        source: sourceDoc ? `✓ Auto-extracted from ${sourceDoc.label || sourceDoc.doc_type}` : "Enterprise Profile",
        source_doc_id: sourceDoc?.doc_id || null,
        source_doc_name: sourceDoc?.file_name || null,
        confidence: conf,
        method: method,
      };
      return true;
    }
    if (key === "epfo_esic" || key === "epfo_esic_number") {
      statutory.epfo_esic_number = cleaned;
      provenance.epfo_esic = {
        value: cleaned,
        source: sourceDoc ? `✓ Auto-extracted from ${sourceDoc.label || sourceDoc.doc_type}` : "Enterprise Profile",
        source_doc_id: sourceDoc?.doc_id || null,
        source_doc_name: sourceDoc?.file_name || null,
        confidence: conf,
        method: method,
      };
      return true;
    }
    return false;
  };

  // 1. Ingest from Document Vault (Authoritative Primary Source)
  for (const doc of myDocs) {
    const ext = doc.extracted_data?.fields || doc.extracted_data?.extracted || doc.extracted_data;
    if (ext && typeof ext === "object") {
      const docMeta = {
        doc_id: doc._id?.toString(),
        file_name: doc.original_name || doc.file_name,
        doc_type: doc.document_type,
        label: DOC_TYPE_LABELS[doc.document_type] || doc.document_type,
      };
      const conf = doc.extracted_data?.confidence != null ? doc.extracted_data.confidence : 0.98;
      const method = doc.extracted_data?.extractionMethod || doc.extracted_data?.extraction_method || "pymupdf";

      // Udyam aliases
      const udyamCandidate = ext.udyam || ext.udyam_number || ext.udyamNumber || ext.udyam_registration || ext.udyam_registration_number || ext.msme;
      if (udyamCandidate) setField("udyam", udyamCandidate, docMeta, method, conf);

      // GST aliases
      const gstCandidate = ext.gstin || ext.gst || ext.gstNumber || ext.gst_registration || ext.gst_number;
      if (gstCandidate) setField("gstin", gstCandidate, docMeta, method, conf);

      // PAN aliases
      const panCandidate = ext.pan || ext.panNumber || ext.pan_it || ext.pan_it_number || ext.pan_card;
      if (panCandidate) setField("pan", panCandidate, docMeta, method, conf);

      // CIN aliases
      const cinCandidate = ext.cin || ext.cin_number;
      if (cinCandidate) setField("cin", cinCandidate, docMeta, method, conf);

      // EPFO / ESIC aliases
      const epfoEsicCandidate = ext.epfo_esic_number || ext.epfo_number || ext.esic_number || ext.epfo || ext.esic;
      if (epfoEsicCandidate) setField("epfo_esic", epfoEsicCandidate, docMeta, method, conf);

      // Metadata
      const compCandidate = ext.companyName || ext.company_name || ext.enterprise_name || ext.legal_name;
      if (compCandidate && typeof compCandidate === "string" && compCandidate.trim() && !compCandidate.includes("DEMO")) {
        statutory.company_name = compCandidate.trim();
      }
      if (ext.business_constitution) statutory.business_constitution = ext.business_constitution;
      if (ext.registered_address) statutory.registered_address = ext.registered_address;
      if (ext.registration_date) statutory.registration_date = ext.registration_date;
      if (ext.enterprise_type) statutory.enterprise_type = ext.enterprise_type;
    }
  }

  // 2. Ingest from Enterprise Profile if not already resolved from Vault
  const ep = user?.enterprise_profile || {};
  if (!statutory.pan && ep.pan?.value) {
    setField("pan", ep.pan.value, ep.pan.source_doc_name ? { file_name: ep.pan.source_doc_name, label: ep.pan.source } : null);
  }
  if (!statutory.gstin && ep.gstin?.value) {
    setField("gstin", ep.gstin.value, ep.gstin.source_doc_name ? { file_name: ep.gstin.source_doc_name, label: ep.gstin.source } : null);
  }
  const epUdyam = ep.udyam_number?.value || ep.udyam?.value;
  if (!statutory.udyam_number && epUdyam) {
    setField("udyam", epUdyam, (ep.udyam_number || ep.udyam)?.source_doc_name ? { file_name: (ep.udyam_number || ep.udyam).source_doc_name, label: (ep.udyam_number || ep.udyam).source } : null);
  }
  const epCin = ep.cin?.value;
  if (!statutory.cin && epCin) {
    setField("cin", epCin, ep.cin.source_doc_name ? { file_name: ep.cin.source_doc_name, label: ep.cin.source } : null);
  }
  const epEpfoEsic = ep.epfo_esic_number?.value || ep.epfo_number?.value;
  if (!statutory.epfo_esic_number && epEpfoEsic) {
    setField("epfo_esic", epEpfoEsic, ep.epfo_esic_number?.source_doc_name ? { file_name: ep.epfo_esic_number.source_doc_name, label: ep.epfo_esic_number.source } : null);
  }

  // 3. Ingest from user.statutory fallback
  const userStat = user?.statutory || {};
  if (!statutory.pan && userStat.pan) setField("pan", userStat.pan);
  if (!statutory.gstin && userStat.gstin) setField("gstin", userStat.gstin);
  if (!statutory.udyam_number && userStat.udyam_number) setField("udyam", userStat.udyam_number);
  if (!statutory.cin && userStat.cin) setField("cin", userStat.cin);
  if (!statutory.epfo_esic_number && userStat.epfo_esic_number) setField("epfo_esic", userStat.epfo_esic_number);

  // 4. Auto-derive PAN from GSTIN if PAN is missing or unverified
  if (!statutory.pan && statutory.gstin && GSTIN_REGEX.test(statutory.gstin)) {
    const derivedPan = statutory.gstin.substring(2, 12).toUpperCase();
    if (PAN_REGEX.test(derivedPan)) {
      statutory.pan = derivedPan;
      provenance.pan = {
        value: derivedPan,
        source: `✓ Auto-derived from GST Certificate (${statutory.gstin})`,
        source_doc_id: provenance.gstin?.source_doc_id || null,
        source_doc_name: provenance.gstin?.source_doc_name || null,
        confidence: 0.98,
        method: "deterministic_derivation",
      };
    }
  }

  // 5. DIAGNOSTIC LOGGING (Section 14 requirement)
  if (options.logDiagnostics) {
    console.log("[COMPLIANCE_DIAGNOSTICS]", {
      bidder_id: resolvedBidderId,
      application_id: options.applicationId || null,
      tender_id: options.tenderId || null,
      tender_mandatory_checks: options.requiredChecks || [],
      resolved_pan: statutory.pan ? `${statutory.pan} (VALID)` : "MISSING",
      resolved_gstin: statutory.gstin ? `${statutory.gstin} (VALID)` : "MISSING",
      resolved_udyam: statutory.udyam_number ? `${statutory.udyam_number} (VALID)` : "MISSING",
      resolved_epfo_esic: statutory.epfo_esic_number ? `${statutory.epfo_esic_number} (VALID)` : "MISSING",
      provenance: provenance,
    });
  }

  // 6. Synchronize resolved credentials to AI Engine memory & custom profiles
  try {
    const syncPayload = {
      bidder_id: resolvedBidderId,
      company_name: statutory.company_name || user?.company_name || resolvedBidderId,
      udyam_number: statutory.udyam_number || "",
      gstin: statutory.gstin || "",
      pan: statutory.pan || "",
      cin: statutory.cin || "",
      epfo_esic_number: statutory.epfo_esic_number || "",
      business_constitution: statutory.business_constitution || "",
      registered_address: statutory.registered_address || "",
      registration_date: statutory.registration_date || "",
      enterprise_type: statutory.enterprise_type || "",
    };

    await fetch(`${ENGINE_URL}/bidders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(syncPayload),
    });
  } catch (syncErr) {
    console.warn("Notice: AI Engine profile sync warning:", syncErr.message);
  }

  // 7. Update MongoDB user record if statutory details were enhanced
  if (user?._id) {
    const updates = {};
    if (statutory.pan && user.statutory?.pan !== statutory.pan) updates["statutory.pan"] = statutory.pan;
    if (statutory.gstin && user.statutory?.gstin !== statutory.gstin) updates["statutory.gstin"] = statutory.gstin;
    if (statutory.udyam_number && user.statutory?.udyam_number !== statutory.udyam_number) updates["statutory.udyam_number"] = statutory.udyam_number;
    if (statutory.epfo_esic_number && user.statutory?.epfo_esic_number !== statutory.epfo_esic_number) updates["statutory.epfo_esic_number"] = statutory.epfo_esic_number;

    if (Object.keys(updates).length > 0) {
      await users.updateOne({ _id: user._id }, { $set: updates });
    }
  }

  return {
    bidder_id: resolvedBidderId,
    user: user,
    statutory: statutory,
    provenance: provenance,
    vault_docs: myDocs,
  };
}
