import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const GATEWAY = "http://localhost:3001";
const ENGINE = "http://127.0.0.1:8000";

console.log("=========================================================");
console.log("TEST SUITE: VAULT TO PROFILE EXTRACTION & COMPLIANCE SCORE");
console.log("=========================================================");

// Helper to create a valid minimal PDF buffer with text
function createSimplePdf(lines) {
  const content = lines.join("\n");
  const stream = `BT /F1 12 Tf 50 720 Td (${content.replace(/[()\\]/g, "")}) Tj ET`;
  const streamLen = stream.length;

  return Buffer.from(
    `%PDF-1.4\n` +
    `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n` +
    `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n` +
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n` +
    `4 0 obj << /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n` +
    `xref\n0 5\n0000000000 65535 f \n` +
    `trailer << /Size 5 /Root 1 0 R >>\nstartxref\n180\n%%EOF\n`
  );
}

async function run() {
  const nonce = Date.now().toString().slice(-6);

  // 1. Register a test officer
  console.log("\n--- Setting up Officer & Tender ---");
  const offEmail = `officer_v2p_${nonce}@gem.gov.in`;
  const offReg = await fetch(`${GATEWAY}/api/auth/register/officer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: "Verification Officer",
      email: offEmail,
      department: "Defence Procurement",
      designation: "Director of Procurement",
      phone: "+91 9811223344",
      password: "Password123!",
      confirm_password: "Password123!",
    }),
  });
  assert.strictEqual(offReg.status, 201, "Officer registration should succeed");
  const offData = await offReg.json();
  const offToken = offData.token;

  // Create isolated tender
  const tenderId = `TENDER-V2P-${nonce}`;
  const tenderRes = await fetch(`${GATEWAY}/api/officer/tenders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${offToken}`,
    },
    body: JSON.stringify({
      tender_id: tenderId,
      title: "Advanced Surveillance Systems",
      category: "Electronics",
      mandatory_checks: ["udyam", "gstn", "pan_it"],
    }),
  });
  assert.strictEqual(tenderRes.status, 201, "Tender creation should succeed");
  console.log(`✓ Created isolated tender: ${tenderId}`);

  // 2. Register a new Bidder
  console.log("\n--- TEST 1: Registering Bidder without statutory numbers ---");
  const bidEmail = `bidder_v2p_${nonce}@enterprise.com`;
  const bidReg = await fetch(`${GATEWAY}/api/auth/register/bidder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_name: "AeroShield Technologies Pvt Ltd",
      contact_person: "Vikram Malhotra",
      email: bidEmail,
      phone: "+91 9811223344",
      password: "Password123!",
      confirm_password: "Password123!",
    }),
  });
  assert.strictEqual(bidReg.status, 201, "Bidder registration should succeed");
  const bidData = await bidReg.json();
  const bidToken = bidData.token;
  const bidderId = bidData.user.bidder_id;
  console.log(`✓ Registered Bidder: ${bidderId} (${bidEmail})`);

  // Verify initial profile has empty statutory credentials
  const initProfRes = await fetch(`${GATEWAY}/api/bidder/profile`, {
    headers: { Authorization: `Bearer ${bidToken}` },
  });
  const initProf = await initProfRes.json();
  assert.strictEqual(initProf.profile.statutory.gstin, "", "Initial GSTIN should be empty");
  assert.strictEqual(initProf.profile.statutory.pan, "", "Initial PAN should be empty");
  console.log("✓ Initial profile starts with empty statutory values as expected");

  // TEST 7 — Missing Document Pre-Check Blocking
  console.log("\n--- TEST 7: Mandatory document pre-check blocking ---");
  const blockedApply = await fetch(`${GATEWAY}/api/tenders/${tenderId}/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bidToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.strictEqual(blockedApply.status, 400, "Should block application when documents missing");
  const blockedData = await blockedApply.json();
  assert.ok(blockedData.missing_documents.length >= 3, "Should report all 3 missing statutory documents");
  console.log(`✓ Application correctly blocked (HTTP 400): missing ${blockedData.missing_documents.length} documents`);

  // TEST 1 — Document Upload & AI Extraction
  console.log("\n--- TEST 1: Document Vault Upload & Structured Extraction ---");
  // Upload Udyam Certificate
  const udyamPdf = createSimplePdf([
    "GOVERNMENT OF INDIA - MINISTRY OF MSME",
    "UDYAM REGISTRATION CERTIFICATE",
    "Enterprise Name: AeroShield Technologies Private Limited",
    "Udyam Registration Number: UDYAM-MH-12-0077889",
    "Classification: Small Enterprise",
    "Constitution of Business: Private Limited Company",
    "Date of Incorporation: 15/04/2019",
    "Principal Place of Business: Plot 42 MIDC Industrial Area Pune Maharashtra 411018",
  ]);

  const udyamForm = new FormData();
  udyamForm.append("file", new Blob([udyamPdf], { type: "application/pdf" }), "Udyam_Certificate.pdf");
  udyamForm.append("document_type", "udyam_cert");

  const udyamUpRes = await fetch(`${GATEWAY}/api/bidder/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidToken}` },
    body: udyamForm,
  });
  assert.strictEqual(udyamUpRes.status, 201, "Udyam upload should succeed");
  const udyamUpData = await udyamUpRes.json();
  console.log("✓ Uploaded Udyam.pdf, extraction returned:", udyamUpData.document.extracted_data?.extracted?.udyam_number);

  // Upload GST Certificate
  const gstPdf = createSimplePdf([
    "Government of India - Form GST REG-06",
    "REGISTRATION CERTIFICATE",
    "Registration Number: 27AABCA1234A1Z5",
    "Legal Name: AeroShield Technologies Private Limited",
    "Trade Name: AeroShield Defence",
    "Constitution of Business: Private Limited Company",
    "Principal Place of Business: Plot 42 MIDC Pune Maharashtra 411018",
    "Date of Liability: 01/07/2017",
  ]);

  const gstForm = new FormData();
  gstForm.append("file", new Blob([gstPdf], { type: "application/pdf" }), "GST_Registration.pdf");
  gstForm.append("document_type", "gstin_cert");

  const gstUpRes = await fetch(`${GATEWAY}/api/bidder/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidToken}` },
    body: gstForm,
  });
  assert.strictEqual(gstUpRes.status, 201, "GST upload should succeed");
  const gstUpData = await gstUpRes.json();
  console.log("✓ Uploaded GST_Registration.pdf, extracted GSTIN:", gstUpData.document.extracted_data?.extracted?.gstin);

  // Upload PAN Card
  const panPdf = createSimplePdf([
    "INCOME TAX DEPARTMENT - GOVT. OF INDIA",
    "Permanent Account Number Card",
    "AABCA1234A",
    "Name: AeroShield Technologies Private Limited",
  ]);

  const panForm = new FormData();
  panForm.append("file", new Blob([panPdf], { type: "application/pdf" }), "PAN_Card.pdf");
  panForm.append("document_type", "pan_card");

  const panUpRes = await fetch(`${GATEWAY}/api/bidder/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidToken}` },
    body: panForm,
  });
  assert.strictEqual(panUpRes.status, 201, "PAN upload should succeed");
  console.log("✓ Uploaded PAN_Card.pdf");

  // TEST 2 & TEST 3 — Enterprise Profile Auto-Population & Persistence
  console.log("\n--- TEST 2 & 3: Enterprise Profile Auto-Population & Persistence ---");
  const profRes = await fetch(`${GATEWAY}/api/bidder/profile`, {
    headers: { Authorization: `Bearer ${bidToken}` },
  });
  assert.strictEqual(profRes.status, 200);
  const profData = await profRes.json();
  const ep = profData.profile.enterprise_profile;

  console.log("Populated Enterprise Profile:");
  console.log(`  - Udyam: ${ep.udyam_number?.value} (Source: ${ep.udyam_number?.source}, Conf: ${ep.udyam_number?.confidence})`);
  console.log(`  - GSTIN: ${ep.gstin?.value} (Source: ${ep.gstin?.source}, Conf: ${ep.gstin?.confidence})`);
  console.log(`  - PAN: ${ep.pan?.value} (Source: ${ep.pan?.source}, Conf: ${ep.pan?.confidence})`);
  console.log(`  - Constitution: ${ep.business_constitution?.value}`);
  console.log(`  - Enterprise Type: ${ep.enterprise_type?.value}`);

  assert.strictEqual(ep.udyam_number.value, "UDYAM-MH-12-0077889");
  assert.strictEqual(ep.gstin.value, "27AABCA1234A1Z5");
  assert.strictEqual(ep.pan.value, "AABCA1234A");
  assert.ok(ep.udyam_number.source.includes("Udyam"));
  assert.ok(ep.gstin.source.includes("GST"));
  assert.ok(ep.pan.source.includes("PAN") || ep.pan.source.includes("GST"));
  console.log("✓ Enterprise Profile successfully auto-populated with provenance and confidence!");

  // TEST 4 — Document Update / Replacement
  console.log("\n--- TEST 4: Document Replacement updates Enterprise Profile ---");
  const newGstPdf = createSimplePdf([
    "Government of India - Form GST REG-06",
    "REGISTRATION CERTIFICATE (AMENDED)",
    "Registration Number: 07AABCA1234A1Z5",
    "Legal Name: AeroShield Technologies Private Limited",
  ]);
  const newGstForm = new FormData();
  newGstForm.append("file", new Blob([newGstPdf], { type: "application/pdf" }), "GST_Amended.pdf");
  newGstForm.append("document_type", "gstin_cert");

  const newGstRes = await fetch(`${GATEWAY}/api/bidder/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidToken}` },
    body: newGstForm,
  });
  assert.strictEqual(newGstRes.status, 201);

  // Check updated profile
  const updatedProfRes = await fetch(`${GATEWAY}/api/bidder/profile`, {
    headers: { Authorization: `Bearer ${bidToken}` },
  });
  const updatedProf = await updatedProfRes.json();
  assert.strictEqual(updatedProf.profile.enterprise_profile.gstin.value, "07AABCA1234A1Z5");
  console.log("✓ Enterprise Profile GSTIN successfully updated to amended certificate: 07AABCA1234A1Z5");

  // TEST 5 & TEST 6 — Compliance Evaluation & Deterministic Scoring
  console.log("\n--- TEST 5 & 6: Tender Application & Genuine Deterministic Compliance Scoring ---");
  const applyRes = await fetch(`${GATEWAY}/api/tenders/${tenderId}/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bidToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.strictEqual(applyRes.status, 201, "Application submission should succeed");
  const applyData = await applyRes.json();

  console.log("Compliance Result:");
  console.log(`  - Compliance Score: ${applyData.application.compliance_score} / 100`);
  console.log(`  - Risk Level: ${applyData.application.risk_level}`);
  const checksList = applyData.application.checks || [];
  console.log("  - Verification Checks:", checksList.map(c => `${c.source}: ${c.status} (${(c.confidence*100).toFixed(0)}%)`));

  assert.ok(applyData.application.compliance_score >= 80, "Compliance score must be >= 80 for verified enterprise");
  assert.strictEqual(applyData.application.risk_level, "Low", "Risk level must be Low for compliant entity");
  console.log(`✓ Compliance Score is ${applyData.application.compliance_score}/100 (>0), Risk Level: ${applyData.application.risk_level}!`);

  // TEST 8 — Officer Dashboard Applicant Filtering
  console.log("\n--- TEST 8: Officer Applicant Filtering by Tender ---");
  const applicantsRes = await fetch(`${GATEWAY}/api/officer/tenders/${tenderId}/applicants`, {
    headers: { Authorization: `Bearer ${offToken}` },
  });
  assert.strictEqual(applicantsRes.status, 200);
  const appListData = await applicantsRes.json();
  assert.strictEqual(appListData.applicants.length, 1, "Should show exactly 1 applicant for this tender");
  assert.strictEqual(appListData.applicants[0].bidder_id, bidderId);
  console.log(`✓ Officer applicants list shows exactly 1 applicant for tender ${tenderId}: ${appListData.applicants[0].company_name}`);

  // TEST 9 & TEST 10 — Document View, Download & Security
  console.log("\n--- TEST 9 & 10: Authenticated Document Access & RBAC Authorization ---");
  const myDocsRes = await fetch(`${GATEWAY}/api/bidder/documents`, {
    headers: { Authorization: `Bearer ${bidToken}` },
  });
  const myDocsData = await myDocsRes.json();
  const testDocId = myDocsData.documents[0].id;

  // Bidder view
  const viewRes = await fetch(`${GATEWAY}/api/documents/${testDocId}/view`, {
    headers: { Authorization: `Bearer ${bidToken}` },
  });
  assert.strictEqual(viewRes.status, 200, "Bidder should be able to view their own document");

  // Bidder download
  const dlRes = await fetch(`${GATEWAY}/api/documents/${testDocId}/download`, {
    headers: { Authorization: `Bearer ${bidToken}` },
  });
  assert.strictEqual(dlRes.status, 200, "Bidder should be able to download their own document");

  // Unauthenticated access blocked
  const unauthRes = await fetch(`${GATEWAY}/api/documents/${testDocId}/view`);
  assert.strictEqual(unauthRes.status, 401, "Unauthenticated access must be blocked with HTTP 401");

  // Officer viewing applicant document
  const offDocView = await fetch(`${GATEWAY}/api/documents/${testDocId}/view`, {
    headers: { Authorization: `Bearer ${offToken}` },
  });
  assert.strictEqual(offDocView.status, 200, "Reviewing officer should be authorized to view applicant's document");

  console.log("✓ Document access strictly authenticated (401 unauthenticated, 200 authorized bidder and officer)");

  console.log("\n=========================================================");
  console.log("ALL 10 TEST CASES PASSED SUCCESSFULLY (100%)");
  console.log("=========================================================");
  process.exit(0);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
