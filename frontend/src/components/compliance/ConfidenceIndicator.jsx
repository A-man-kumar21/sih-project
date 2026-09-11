import React from "react";
import { getConfidenceMeta } from "./complianceHelpers";

export default function ConfidenceIndicator({ confidence }) {
  const { percent, level, variant } = getConfidenceMeta(confidence);

  return (
    <div className="compliance-confidence-container">
      <div className="confidence-header-row">
        <span className="confidence-title">Confidence</span>
        <div className="confidence-score-badge">
          <strong className="confidence-percentage">{percent}%</strong>
          <span className={`confidence-level-tag tag-${variant}`}>{level}</span>
        </div>
      </div>
      <div className="confidence-track" role="progressbar" aria-valuenow={percent} aria-valuemin="0" aria-valuemax="100">
        <div
          className={`confidence-bar fill-${variant}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
