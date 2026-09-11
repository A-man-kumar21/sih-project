/**
 * Statutory Compliance Helpers for TenderFlow AI Evaluation Cockpit
 * Provides human-readable label mapping, value formatting, confidence styling,
 * and status interpretations for government procurement officers.
 */

export const SOURCE_CONFIG = {
  udyam: {
    title: "Udyam / MSME Registration",
    shortName: "Udyam / MSME",
    icon: "🏢",
    registryName: "Ministry of MSME / Udyam Registry",
    primaryFields: [
      "udyam_registration_number",
      "enterprise_name",
      "enterprise_category",
      "registration_date",
      "registration_valid_until",
      "registered_address",
      "business_constitution",
      "registration_active",
    ],
  },
  gstn: {
    title: "GST Registration & Tax Compliance",
    shortName: "GST Compliance",
    icon: "📑",
    registryName: "Goods and Services Tax Network (GSTN)",
    primaryFields: [
      "gstin",
      "legal_name",
      "registration_status",
      "latest_return_period",
      "latest_return_filed",
      "filing_status",
      "registered_address",
      "registration_date",
    ],
  },
  pan_it: {
    title: "PAN & Income Tax Compliance",
    shortName: "PAN & Income Tax",
    icon: "💳",
    registryName: "Income Tax Department / NSDL Registry",
    primaryFields: [
      "pan",
      "pan_status",
      "name_match",
      "income_tax_return_filed",
      "income_tax_return_assessment_year",
    ],
  },
  epfo_esic: {
    title: "EPFO / ESIC Labour Compliance",
    shortName: "EPFO / ESIC",
    icon: "👥",
    registryName: "Employees' Provident Fund & State Insurance",
    primaryFields: [
      "epfo_establishment_id",
      "epfo_contribution_status",
      "esic_employer_code",
      "esic_contribution_status",
      "latest_contribution_period",
    ],
  },
  digilocker: {
    title: "DigiLocker Credential Verification",
    shortName: "DigiLocker",
    icon: "🔒",
    registryName: "DigiLocker National Digital Entity Anchor",
    primaryFields: [
      "consent_status",
      "identity_document_verified",
      "authorized_signatory_verified",
      "credential_issued_at",
    ],
  },
  blacklist: {
    title: "Debarment & Blacklist Clearance",
    shortName: "Debarment Check",
    icon: "⚖️",
    registryName: "Central Procurement Debarment Registry",
    primaryFields: [
      "debarment_status",
      "registry_match",
      "registry_search_reference",
      "debarment_authority",
      "debarment_reason",
      "debarment_until",
    ],
  },
};

export const FIELD_LABELS = {
  // Udyam
  udyam_registration_number: "Udyam Registration Number",
  enterprise_name: "Enterprise Name",
  registration_valid_until: "Registration Valid Until",
  enterprise_category: "Enterprise Category",
  enterprise_type: "Enterprise Category",
  registered_address: "Registered Address",
  business_constitution: "Business Constitution",
  registration_active: "Registration Status",
  registration_status: "Registration Status",
  registration_date: "Registration Date",

  // GSTN
  gstin: "GSTIN",
  legal_name: "Legal Name",
  latest_return_period: "Latest Return Period",
  latest_return_filed: "Latest Return Filed",
  filing_status: "Filing Status",
  overdue_return_periods: "Overdue Return Periods",

  // PAN & IT
  pan: "PAN",
  pan_status: "PAN Status",
  name_match: "Name Match",
  income_tax_return_filed: "Income Tax Return Filed",
  income_tax_return_assessment_year: "Assessment Year",

  // EPFO / ESIC
  epfo_establishment_id: "EPFO Establishment ID",
  epfo_contribution_status: "EPFO Contribution Status",
  esic_employer_code: "ESIC Employer Code",
  esic_contribution_status: "ESIC Contribution Status",
  latest_contribution_period: "Latest Return Period",

  // DigiLocker
  consent_status: "Credential Status",
  identity_document_verified: "Identity Verification",
  authorized_signatory_verified: "Authorized Signatory Verification",
  credential_issued_at: "Credential Issued At",

  // Blacklist
  registry_match: "Blacklist Status",
  debarment_status: "Debarment Status",
  debarment_authority: "Debarment Authority",
  debarment_reason: "Debarment Reason",
  debarment_until: "Debarred Until",
  registry_search_reference: "Search Reference ID",

  // General & Fallbacks
  provided_value: "Submitted Identifier",
  reason: "Registry Assessment Note",
  bidder_id: "Bidder Reference",
  last_updated: "Last Verified At",
  note: "Evaluation Note",
};

/**
 * Format any snake_case key into an officer-friendly title
 */
export function formatFieldLabel(key) {
  if (!key) return "Property";
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Formats values into human-readable procurement format
 */
export function formatFieldValue(key, value) {
  if (value === null || value === undefined || value === "" || Number.isNaN(value)) {
    return { text: "Not Available", isBadge: false, type: "muted" };
  }

  // Boolean interpretations
  if (typeof value === "boolean") {
    if (key === "registration_active" || key === "registration_status") {
      return value
        ? { text: "✓ Active", isBadge: true, type: "success" }
        : { text: "✕ Inactive", isBadge: true, type: "danger" };
    }
    if (key === "name_match") {
      return value
        ? { text: "✓ Matched", isBadge: true, type: "success" }
        : { text: "✕ Mismatch", isBadge: true, type: "danger" };
    }
    if (key === "latest_return_filed" || key === "income_tax_return_filed") {
      return value
        ? { text: "✓ Yes", isBadge: true, type: "success" }
        : { text: "✕ No", isBadge: true, type: "danger" };
    }
    if (key === "identity_document_verified" || key === "authorized_signatory_verified") {
      return value
        ? { text: "✓ Verified Authentic", isBadge: true, type: "success" }
        : { text: "✕ Unverified", isBadge: true, type: "danger" };
    }
    if (key === "registry_match") {
      return value
        ? { text: "✕ Match Found (Debarred)", isBadge: true, type: "danger" }
        : { text: "✓ Clear (No Match)", isBadge: true, type: "success" };
    }
    return value
      ? { text: "✓ Yes", isBadge: true, type: "success" }
      : { text: "✕ No", isBadge: true, type: "muted" };
  }

  // Specific string statuses
  if (key === "epfo_contribution_status" || key === "esic_contribution_status") {
    const isPaid = String(value).toLowerCase() === "paid";
    return {
      text: isPaid ? "✓ Paid" : `✕ ${value}`,
      isBadge: true,
      type: isPaid ? "success" : "danger",
    };
  }

  if (key === "debarment_status") {
    const isClean = String(value).toLowerCase().includes("not listed") || String(value).toLowerCase().includes("clear") || String(value).toLowerCase().includes("none");
    return {
      text: isClean ? "✓ Clear / None Found" : `✕ ${value}`,
      isBadge: true,
      type: isClean ? "success" : "danger",
    };
  }

  if (key === "pan_status" || (key === "registration_status" && typeof value === "string")) {
    const isActive = String(value).toLowerCase() === "active";
    return {
      text: isActive ? "✓ Active" : value,
      isBadge: true,
      type: isActive ? "success" : "warning",
    };
  }

  if (key === "consent_status") {
    const isGranted = String(value).toLowerCase() === "granted";
    return {
      text: isGranted ? "✓ Verified / Granted" : value,
      isBadge: true,
      type: isGranted ? "success" : "muted",
    };
  }

  if (key === "filing_status") {
    const isRegular = String(value).toLowerCase() === "regular";
    return {
      text: value,
      isBadge: true,
      type: isRegular ? "success" : "warning",
    };
  }

  // Arrays (e.g. overdue_return_periods)
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { text: "None", isBadge: false, type: "muted" };
    }
    return { text: value.join(", "), isBadge: false, type: "normal" };
  }

  // ISO Dates formatting
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return {
          text: d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          isBadge: false,
          type: "normal",
        };
      }
    } catch (e) {}
  }

  return { text: String(value), isBadge: false, type: "normal" };
}

/**
 * Calculates visual confidence metrics without mutating raw backend value
 */
export function getConfidenceMeta(rawConfidence) {
  let num = typeof rawConfidence === "number" ? rawConfidence : parseFloat(rawConfidence);
  if (isNaN(num)) num = 0;
  // If confidence is between 0 and 1, convert to 0-100%
  const percent = num <= 1.0 ? Math.round(num * 100) : Math.min(100, Math.round(num));

  if (percent >= 90) {
    return {
      percent,
      level: "High Confidence",
      variant: "high",
      color: "#16a34a",
    };
  }
  if (percent >= 70) {
    return {
      percent,
      level: "Medium Confidence",
      variant: "medium",
      color: "#d97706",
    };
  }
  return {
    percent,
    level: "Low Confidence",
    variant: "low",
    color: "#dc2626",
  };
}

/**
 * Status Badge metadata: color, icon, label
 */
export function getStatusMeta(status) {
  const norm = (status || "").toLowerCase().trim();
  switch (norm) {
    case "compliant":
      return { label: "Compliant", icon: "✓", variant: "compliant" };
    case "non_compliant":
    case "failed":
      return { label: "Failed", icon: "✕", variant: "failed" };
    case "expired":
      return { label: "Expired", icon: "⚠", variant: "expired" };
    case "not_found":
      return { label: "Not Found", icon: "—", variant: "not-found" };
    case "warning":
    case "requires_review":
      return { label: "Requires Review", icon: "⚠", variant: "warning" };
    case "pending":
    case "pending_review":
      return { label: "Pending", icon: "◷", variant: "pending" };
    default:
      return {
        label: (status || "Unknown").replaceAll("_", " "),
        icon: "ℹ",
        variant: "default",
      };
  }
}
