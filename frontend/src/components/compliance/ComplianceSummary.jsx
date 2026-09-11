import React from "react";

export default function ComplianceSummary({
  score = 0,
  riskLevel = "Low",
  checks = [],
  companyName = "",
  bidderId = "",
  tenderId = "",
}) {
  // Count checks from existing backend checks array
  const totalChecks = checks.length;
  const compliantChecks = checks.filter((c) => c.status === "compliant").length;
  const failedChecks = checks.filter(
    (c) => c.status === "non_compliant" || c.status === "failed"
  ).length;
  const reviewChecks = checks.filter(
    (c) =>
      c.status === "not_found" ||
      c.status === "warning" ||
      c.status === "expired" ||
      c.status === "pending"
  ).length;

  // Determine overall status message using existing score & statuses
  const isFullyCompliant =
    score >= 80 && failedChecks === 0 && reviewChecks === 0;
  const hasKnockout =
    failedChecks > 0 || String(riskLevel).toLowerCase() === "high";

  let statusBannerText = "✓ Fully Compliant — All statutory mandates satisfied";
  let statusBannerClass = "summary-banner-compliant";

  if (hasKnockout) {
    statusBannerText = `✕ Non-Compliant — ${failedChecks} statutory check(s) failed`;
    statusBannerClass = "summary-banner-failed";
  } else if (reviewChecks > 0 || score < 80) {
    statusBannerText = `⚠ Conditional / Review Required — ${reviewChecks} check(s) require physical verification`;
    statusBannerClass = "summary-banner-warning";
  }

  const normRisk = String(riskLevel).toLowerCase();

  return (
    <div className="compliance-summary-hero">
      <div className="summary-hero-top">
        <div>
          <span className="summary-eyebrow">
            Deterministic Statutory Verification · GeM Procurement Standards
          </span>
          <h2 className="summary-title">AI Compliance Evaluation</h2>
          {companyName && (
            <p className="summary-target">
              Evaluating: <strong>{companyName}</strong> {bidderId ? `(${bidderId})` : ""} {tenderId ? `· Tender: ${tenderId}` : ""}
            </p>
          )}
        </div>
        <div className="summary-seal">
          <span className="seal-icon">🛡️</span>
          <span className="seal-text">Official Verification</span>
        </div>
      </div>

      <div className="summary-metrics-row">
        {/* Metric 1: Overall Score */}
        <div className="summary-metric-card score-metric">
          <span className="metric-header-title">Overall Score</span>
          <div className="metric-score-display">
            <span className="score-big-num">{score}</span>
            <span className="score-denom">/ 100</span>
          </div>
          <span className="metric-sub-note">Deterministic weighted total</span>
        </div>

        {/* Metric 2: Risk Level */}
        <div className="summary-metric-card risk-metric">
          <span className="metric-header-title">Risk Level</span>
          <div className="metric-risk-display">
            <span className={`risk-badge-large risk-${normRisk}`}>
              {String(riskLevel).toUpperCase()}
            </span>
          </div>
          <span className="metric-sub-note">
            {normRisk === "low"
              ? "Eligible for fast-track award"
              : normRisk === "medium"
              ? "Requires officer scrutiny"
              : "High risk defect detected"}
          </span>
        </div>

        {/* Metric 3: Checks Passed */}
        <div className="summary-metric-card checks-metric">
          <span className="metric-header-title">Statutory Checks</span>
          <div className="metric-checks-display">
            <span className="checks-fraction">
              {compliantChecks} / {totalChecks}
            </span>
          </div>
          <div className="checks-breakdown-tags">
            <span className="breakdown-tag tag-passed">✓ {compliantChecks} Compliant</span>
            {failedChecks > 0 && (
              <span className="breakdown-tag tag-failed">✕ {failedChecks} Failed</span>
            )}
            {reviewChecks > 0 && (
              <span className="breakdown-tag tag-review">⚠ {reviewChecks} Review</span>
            )}
          </div>
        </div>
      </div>

      {/* Compliance Status Banner */}
      <div className={`summary-status-banner ${statusBannerClass}`}>
        <span className="status-banner-text">{statusBannerText}</span>
      </div>
    </div>
  );
}
