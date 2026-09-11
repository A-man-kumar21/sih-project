import React, { useState } from "react";

export default function TechnicalDetails({ data, title = "View Technical Verification Data" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="technical-details-drawer">
      <button
        type="button"
        className="technical-details-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="toggle-icon">{isOpen ? "▲" : "▼"}</span>
        <span className="toggle-label">{title}</span>
        <span className="technical-badge">Audit / Debug</span>
      </button>

      {isOpen && (
        <div className="technical-details-content">
          <div className="technical-details-actions">
            <span className="technical-details-meta">Raw deterministic registry response</span>
            <button
              type="button"
              className="btn-copy-json"
              onClick={handleCopy}
              title="Copy JSON to clipboard"
            >
              {copied ? "✓ Copied" : "📋 Copy Raw JSON"}
            </button>
          </div>
          <pre className="technical-json-block">
            <code>{jsonString}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
