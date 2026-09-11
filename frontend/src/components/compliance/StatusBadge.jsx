import React from "react";
import { getStatusMeta } from "./complianceHelpers";

export default function StatusBadge({ status, customLabel = null }) {
  const meta = getStatusMeta(status);
  const displayLabel = customLabel || meta.label;

  return (
    <span className={`compliance-status-badge badge-${meta.variant}`}>
      <span className="badge-symbol" aria-hidden="true">{meta.icon}</span>
      <span className="badge-text">{displayLabel}</span>
    </span>
  );
}
