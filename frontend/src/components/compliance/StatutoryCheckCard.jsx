import React from "react";
import StatusBadge from "./StatusBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import TechnicalDetails from "./TechnicalDetails";
import {
  SOURCE_CONFIG,
  formatFieldLabel,
  formatFieldValue,
} from "./complianceHelpers";

export default function StatutoryCheckCard({ check }) {
  if (!check) return null;

  const sourceKey = check.source || check.check_type || "unknown";
  const config = SOURCE_CONFIG[sourceKey] || {
    title: formatFieldLabel(sourceKey),
    shortName: formatFieldLabel(sourceKey),
    icon: "📋",
    registryName: "Statutory Verification Adapter",
    primaryFields: [],
  };

  const rawFields = check.raw_fields || {};
  const status = check.status || "pending";
  const confidence = check.confidence != null ? check.confidence : 0;
  const isMandatory = check.is_mandatory !== false;

  // Extraction source provenance display (from vault / PyMuPDF)
  const extractionSource =
    check.extraction_source ||
    check.provenance?.source ||
    (status === "compliant" && check.verified_value
      ? `✓ Auto-extracted & verified via official documents`
      : null);

  // Technical error state check
  const isTechnicalError =
    status === "error" ||
    (rawFields.error && typeof rawFields.error === "string");

  // Determine fields to display
  // 1. Preferred primary fields from config
  const configuredKeys = config.primaryFields || [];
  // 2. Any additional keys present in rawFields not already in configuredKeys
  const extraKeys = Object.keys(rawFields).filter(
    (k) =>
      !configuredKeys.includes(k) &&
      k !== "bidder_id" &&
      k !== "error" &&
      !k.startsWith("_")
  );

  const displayKeys = [...configuredKeys, ...extraKeys];

  return (
    <div className={`statutory-check-card border-${status}`}>
      {/* Card Header */}
      <div className="statutory-card-header">
        <div className="statutory-card-title-group">
          <span className="statutory-icon" aria-hidden="true">
            {config.icon}
          </span>
          <div>
            <h4 className="statutory-title">{config.title}</h4>
            <span className="statutory-registry-sub">{config.registryName}</span>
          </div>
        </div>
        <div className="statutory-badges-group">
          <span className={`compliance-scope-pill ${isMandatory ? "scope-mandatory" : "scope-informational"}`}>
            {isMandatory ? "Mandatory Check" : "Informational (Optional)"}
          </span>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Provenance Banner if present */}
      {extractionSource && status === "compliant" && (
        <div className="statutory-provenance-banner">
          <span className="provenance-icon">🏷️</span>
          <span className="provenance-text">{extractionSource}</span>
        </div>
      )}

      {/* Verification / Technical Error alert */}
      {isTechnicalError ? (
        <div className="statutory-error-banner">
          <span className="error-icon">⚠</span>
          <div>
            <strong>Verification Unavailable</strong>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
              {rawFields.error || "The registry adapter could not complete verification for this record."}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Prominent Confidence Display */}
          <div className="statutory-confidence-wrapper">
            <ConfidenceIndicator confidence={confidence} />
          </div>

          {/* Structured Key-Value Information Grid */}
          <div className="statutory-fields-grid">
            {displayKeys.map((key) => {
              const val = rawFields[key];
              const { text, isBadge, type } = formatFieldValue(key, val);
              const label = formatFieldLabel(key);

              // Don't render empty supplementary fields if not in primary config
              if (
                !configuredKeys.includes(key) &&
                (val === undefined || val === null || val === "")
              ) {
                return null;
              }

              const isWide =
                key === "registered_address" ||
                key === "debarment_reason" ||
                key === "enterprise_name" ||
                key === "legal_name" ||
                key === "reason";

              return (
                <div
                  key={key}
                  className={`statutory-field-item ${isWide ? "field-span-2" : ""}`}
                >
                  <span className="field-label">{label}</span>
                  <div className="field-value-wrapper">
                    {isBadge ? (
                      <span className={`field-value-badge badge-val-${type}`}>
                        {text}
                      </span>
                    ) : (
                      <span className={`field-value-text val-${type}`}>
                        {text}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Verification Source / Provenance Note */}
          <div className="statutory-meta-footer">
            <div className="statutory-meta-col">
              <span className="meta-label">Verification Method</span>
              <span className="meta-value">Deterministic Compliance Engine</span>
            </div>
            {check.verified_value && (
              <div className="statutory-meta-col">
                <span className="meta-label">Verified Record Key</span>
                <span className="meta-value code-value">{check.verified_value}</span>
              </div>
            )}
            {check.weight_applied !== undefined && (
              <div className="statutory-meta-col">
                <span className="meta-label">Score Weight</span>
                <span className="meta-value">{check.weight_applied} pts</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Expandable Technical Details for Developers & Auditors */}
      <TechnicalDetails
        data={rawFields}
        title={`View Technical Verification Data (${config.shortName})`}
      />
    </div>
  );
}
