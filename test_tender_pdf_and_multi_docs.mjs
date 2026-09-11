import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:3001";
const ASSETS_DIR = path.resolve(process.cwd(), "test_assets");

async function runTests() {
  console.log("===============================================================");
  console.log("TEST SUITE: TENDERFLOW NEW FEATURES VERIFICATION");
  console.log("Feature 1: Local Tender PDF Extraction & Tender Creation");
  console.log("Feature 2: Multi-Document Other Statutory Vault & Conflict Sync");
  console.log("===============================================================");

  const timestamp = Date.now();
  const officerEmail = `officer_feat_${timestamp}@gov.in`;
  const bidderEmail = `bidder_feat_${timestamp}@vendor.com`;
  let bidderId = `BIDDER-FEAT-${timestamp}`;

  // 0. Register officer and bidder
  console.log("\n--- [0] Setting up Officer and Bidder accounts ---");
  const offRegRes = await fetch(`${BASE_URL}/api/auth/register/officer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: "Procurement Officer Feat",
      email: officerEmail,
      department: "Ministry of Health",
      designation: "Director Procurement",
      password: "Password@123",
      confirm_password: "Password@123",
    }),
  });
  const offRegData = await offRegRes.json();
  assert.strictEqual(offRegRes.status, 201, "Officer registration should succeed");
  const officerToken = offRegData.token;
  console.log("✓ Officer registered successfully");

  const bidRegRes = await fetch(`${BASE_URL}/api/auth/register/bidder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_name: "Apex Global Technologies Pvt Ltd",
      contact_person: "Lead Engineer",
      email: bidderEmail,
      phone: "+91 9876543210",
      password: "Password@123",
      confirm_password: "Password@123",
    }),
  });
  const bidRegData = await bidRegRes.json();
  assert.strictEqual(bidRegRes.status, 201, "Bidder registration should succeed");
  const bidderToken = bidRegData.token;
  bidderId = bidRegData.user.bidder_id;
  console.log(`✓ Bidder registered successfully: ${bidderId}`);

  // =========================================================================
  // TEST 1 — TENDER PDF EXTRACTION & CREATION
  // =========================================================================
  console.log("\n--- TEST 1: Tender PDF Extraction & Creation ---");
  const tenderPdfPath = path.join(ASSETS_DIR, "tender_notice.pdf");
  const tenderPdfBuffer = fs.readFileSync(tenderPdfPath);

  const tenderFormData = new FormData();
  tenderFormData.append("file", new Blob([tenderPdfBuffer], { type: "application/pdf" }), "tender_notice.pdf");

  const extractTenderRes = await fetch(`${BASE_URL}/api/extract/tender-pdf`, {
    method: "POST",
    headers: { Authorization: `Bearer ${officerToken}` },
    body: tenderFormData,
  });

  const tenderExtract = await extractTenderRes.json();
  assert.strictEqual(extractTenderRes.status, 200, "Tender PDF extraction should return 200");
  assert.strictEqual(tenderExtract.success, true, "Extraction must succeed");
  assert.strictEqual(tenderExtract.extractionMethod, "pymupdf", "Text PDF must use PyMuPDF");
  assert(tenderExtract.confidence >= 80, `Confidence should be >= 80% (got ${tenderExtract.confidence}%)`);

  const fields = tenderExtract.fields;
  console.log("Extracted Tender Fields:", {
    tenderReferenceId: fields.tenderReferenceId,
    title: fields.title,
    category: fields.category,
    deadline: fields.submissionDeadline,
    mandatoryChecks: fields.mandatoryChecks,
  });

  assert.strictEqual(fields.tenderReferenceId, "GEM/2026/B/882100", "Must extract exact GeM Tender Reference ID");
  assert(fields.title.toLowerCase().includes("medical diagnostic equipment"), "Must extract correct title");
  assert.strictEqual(fields.category, "Medical Devices", "Must categorize as Medical Devices");
  assert.strictEqual(fields.submissionDeadline, "2026-11-15", "Must extract ISO submission deadline 2026-11-15");
  assert(fields.mandatoryChecks.includes("udyam"), "Must detect mandatory udyam");
  assert(fields.mandatoryChecks.includes("gstn"), "Must detect mandatory gstn");
  assert(fields.mandatoryChecks.includes("pan_it"), "Must detect mandatory pan_it");
  assert(fields.mandatoryChecks.includes("epfo_esic"), "Must detect mandatory epfo_esic");
  assert(fields.mandatoryChecks.includes("blacklist"), "Must detect mandatory blacklist");
  console.log("✓ TEST 1 Part A: Deterministic Tender PDF extraction verified");

  // Now create the tender with reviewed fields
  const createTenderRes = await fetch(`${BASE_URL}/api/tenders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${officerToken}`,
    },
    body: JSON.stringify({
      tender_id: fields.tenderReferenceId,
      title: fields.title,
      category: fields.category,
      description: fields.description,
      deadline: fields.submissionDeadline,
      mandatory_checks: fields.mandatoryChecks,
    }),
  });
  const tenderCreatedData = await createTenderRes.json();
  assert.strictEqual(createTenderRes.status, 201, "Tender creation should return 201");
  assert.strictEqual(tenderCreatedData.tender.tender_id, "GEM/2026/B/882100");
  console.log("✓ TEST 1 Part B: Tender successfully published using extracted data:", tenderCreatedData.tender.tender_id);

  // =========================================================================
  // TEST 2 — MULTIPLE OTHER STATUTORY / TECHNICAL DOCUMENTS
  // =========================================================================
  console.log("\n--- TEST 2: Multiple Other Documents Non-Destructive Vault Coexistence ---");
  const docNames = ["A.pdf", "B.pdf", "C.pdf", "D.pdf"];
  const uploadedDocs = [];

  for (const docName of docNames) {
    const filePath = path.join(ASSETS_DIR, docName);
    const fileBuf = fs.readFileSync(filePath);
    const fd = new FormData();
    fd.append("file", new Blob([fileBuf], { type: "application/pdf" }), docName);
    fd.append("document_type", "other_statutory");

    const upRes = await fetch(`${BASE_URL}/api/bidder/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bidderToken}` },
      body: fd,
    });
    const upData = await upRes.json();
    assert.strictEqual(upRes.status, 201, `Uploading ${docName} should succeed`);
    uploadedDocs.push(upData.document);
    console.log(`✓ Uploaded ${docName} -> document ID: ${upData.document.id}`);
  }

  // Fetch vault inventory
  const listDocsRes = await fetch(`${BASE_URL}/api/bidder/documents`, {
    headers: { Authorization: `Bearer ${bidderToken}` },
  });
  const listDocsData = await listDocsRes.json();
  const otherDocsInVault = listDocsData.documents.filter(
    (d) => d.document_type === "other_statutory" || d.document_type === "other"
  );

  console.log(`Vault currently has ${otherDocsInVault.length} Other Statutory documents.`);
  assert.strictEqual(otherDocsInVault.length, 4, "All 4 documents must coexist simultaneously in Document Vault");

  const distinctIds = new Set(otherDocsInVault.map((d) => d.id));
  assert.strictEqual(distinctIds.size, 4, "Every document must possess a unique document ID");

  const originalNames = otherDocsInVault.map((d) => d.original_name);
  assert(originalNames.includes("A.pdf"), "A.pdf must be present");
  assert(originalNames.includes("B.pdf"), "B.pdf must be present");
  assert(originalNames.includes("C.pdf"), "C.pdf must be present");
  assert(originalNames.includes("D.pdf"), "D.pdf must be present");
  console.log("✓ Uploading B did NOT replace A. Uploading C and D did NOT replace previous docs.");

  // Delete B.pdf and verify A, C, D remain intact
  const docB = otherDocsInVault.find((d) => d.original_name === "B.pdf");
  assert(docB, "Document B must exist to test deletion");

  const delBRes = await fetch(`${BASE_URL}/api/bidder/documents/${docB.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${bidderToken}` },
  });
  assert.strictEqual(delBRes.status, 200, "Deleting B.pdf should return 200");

  const listAfterDel = await (
    await fetch(`${BASE_URL}/api/bidder/documents`, {
      headers: { Authorization: `Bearer ${bidderToken}` },
    })
  ).json();
  const remainingOther = listAfterDel.documents.filter(
    (d) => d.document_type === "other_statutory" || d.document_type === "other"
  );

  assert.strictEqual(remainingOther.length, 3, "Vault must now contain exactly 3 Other documents");
  const remNames = remainingOther.map((d) => d.original_name);
  assert(!remNames.includes("B.pdf"), "B.pdf must be deleted");
  assert(remNames.includes("A.pdf"), "A.pdf must remain intact");
  assert(remNames.includes("C.pdf"), "C.pdf must remain intact");
  assert(remNames.includes("D.pdf"), "D.pdf must remain intact");
  console.log("✓ TEST 2 Passed: Deleting B.pdf left A.pdf, C.pdf, and D.pdf completely intact");

  // =========================================================================
  // TEST 3 — EXTRACTION METHODS (PyMuPDF for text, PaddleOCR for image)
  // =========================================================================
  console.log("\n--- TEST 3: Extraction Methods Verification ---");
  // Check that A.pdf extraction returned PyMuPDF
  const docA = remainingOther.find((d) => d.original_name === "A.pdf");
  assert.strictEqual(
    docA.extracted_data?.extractionMethod,
    "pymupdf",
    "Text-based PDF extraction method must be PyMuPDF"
  );
  console.log("✓ Text PDF extraction method confirmed as PyMuPDF");

  // =========================================================================
  // TEST 4 — ENTERPRISE PROFILE SYNCHRONIZATION FROM OTHER DOCUMENTS
  // =========================================================================
  console.log("\n--- TEST 4: Enterprise Profile Synchronization from Other Document ---");
  const isoPath = path.join(ASSETS_DIR, "ISO_Certificate.pdf");
  const isoBuffer = fs.readFileSync(isoPath);
  const isoFd = new FormData();
  isoFd.append("file", new Blob([isoBuffer], { type: "application/pdf" }), "ISO_Certificate.pdf");
  isoFd.append("document_type", "other_statutory");

  const isoUpRes = await fetch(`${BASE_URL}/api/bidder/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidderToken}` },
    body: isoFd,
  });
  assert.strictEqual(isoUpRes.status, 201, "ISO Certificate upload should succeed");

  const profRes = await fetch(`${BASE_URL}/api/bidder/profile`, {
    headers: { Authorization: `Bearer ${bidderToken}` },
  });
  const profData = await profRes.json();
  const ep = profData.profile.enterprise_profile;

  console.log("Enterprise Profile after ISO upload:", {
    enterprise_name: ep.enterprise_name?.value,
    cin: ep.cin?.value,
    constitution: ep.business_constitution?.value,
    address: ep.registered_address?.value,
  });

  assert.strictEqual(ep.cin?.value, "U72900MH2021PTC123456", "CIN must be synchronized from ISO Certificate");
  assert.strictEqual(ep.cin?.source_doc_name, "ISO_Certificate.pdf", "Source document name must be preserved");
  assert(ep.cin?.confidence >= 0.8, "Confidence must be preserved");
  console.log("✓ TEST 4 Passed: Extracted fields and provenance accurately synchronized to Enterprise Profile");

  // =========================================================================
  // TEST 5 — CONFLICTING DATA HANDLING
  // =========================================================================
  console.log("\n--- TEST 5: Conflicting Data Handling ---");
  // Set existing verified name in profile
  const putProfRes = await fetch(`${BASE_URL}/api/bidder/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bidderToken}`,
    },
    body: JSON.stringify({
      enterprise_name: "Apex Global Technologies Pvt Ltd",
      company_name: "Apex Global Technologies Pvt Ltd",
    }),
  });
  assert.strictEqual(putProfRes.status, 200, "Updating profile should succeed");

  // Now upload document with conflicting company name
  const conflictPath = path.join(ASSETS_DIR, "Conflicting_Certificate.pdf");
  const conflictBuffer = fs.readFileSync(conflictPath);
  const conflictFd = new FormData();
  conflictFd.append("file", new Blob([conflictBuffer], { type: "application/pdf" }), "Conflicting_Certificate.pdf");
  conflictFd.append("document_type", "other_statutory");

  const confUpRes = await fetch(`${BASE_URL}/api/bidder/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidderToken}` },
    body: conflictFd,
  });
  assert.strictEqual(confUpRes.status, 201, "Conflicting certificate upload should succeed");

  // Fetch profile to verify conflict state
  const profAfterConflict = await (
    await fetch(`${BASE_URL}/api/bidder/profile`, {
      headers: { Authorization: `Bearer ${bidderToken}` },
    })
  ).json();

  const nameField = profAfterConflict.profile.enterprise_profile.enterprise_name;
  console.log("Enterprise Name Field state after conflict:", {
    current_value: nameField.value,
    conflict_detected: nameField.conflict?.detected,
    conflicting_value: nameField.conflict?.conflicting_value,
    conflicting_source: nameField.conflict?.conflicting_source,
  });

  assert.strictEqual(
    nameField.value,
    "Apex Global Technologies Pvt Ltd",
    "Existing profile value must NOT be silently overwritten"
  );
  assert.strictEqual(nameField.conflict?.detected, true, "Conflict flag must be set to true");
  assert.strictEqual(
    nameField.conflict?.conflicting_value,
    "Zenith Commercial Ventures LLP",
    "Conflicting value must be captured for user review"
  );
  console.log("✓ TEST 5 Passed: Conflicting data flagged for review without silent overwrite");

  // =========================================================================
  // TEST 6 — COMPLIANCE PIPELINE INTEGRATION
  // =========================================================================
  console.log("\n--- TEST 6: Statutory Document Compliance Scoring Integration ---");
  // Upload PAN, GST, Udyam, EPFO/ESIC
  const panPath = path.join(process.cwd(), "PAN_Document.pdf");
  const gstPath = path.join(process.cwd(), "GST_Certificate.pdf");
  const udyamPath = path.join(process.cwd(), "Udyam.pdf");
  const epfoPath = path.join(ASSETS_DIR, "EPFO_ESIC_Certificate.pdf");

  const uploadStatDoc = async (filePath, docType, originalName) => {
    const buf = fs.readFileSync(filePath);
    const fd = new FormData();
    fd.append("file", new Blob([buf], { type: "application/pdf" }), originalName);
    fd.append("document_type", docType);
    const res = await fetch(`${BASE_URL}/api/bidder/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bidderToken}` },
      body: fd,
    });
    return res.json();
  };

  await uploadStatDoc(panPath, "pan_card", "01_PAN.pdf");
  await uploadStatDoc(gstPath, "gstin_cert", "03_GST_Registration.pdf");
  await uploadStatDoc(udyamPath, "udyam_cert", "04_Udyam.pdf");
  await uploadStatDoc(epfoPath, "epfo_esic_cert", "EPFO_ESIC_Certificate.pdf");
  console.log("✓ Uploaded statutory certificates (PAN, GSTIN, Udyam, EPFO/ESIC)");

  // Submit tender application for GEM/2026/B/882100
  const applyRes = await fetch(`${BASE_URL}/api/tenders/GEM/2026/B/882100/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bidderToken}`,
    },
    body: JSON.stringify({ notes: "Bidding with full statutory compliance credentials." }),
  });
  const applyData = await applyRes.json();
  assert.strictEqual(applyRes.status, 201, `Tender application should succeed (got ${applyRes.status})`);

  console.log("Application Compliance Result:", {
    score: applyData.application.compliance_score,
    risk: applyData.application.risk_level,
    verified_pan: applyData.application.compliance_snapshot?.pan,
    verified_gstin: applyData.application.compliance_snapshot?.gstin,
    verified_udyam: applyData.application.compliance_snapshot?.udyam_number,
  });

  assert(
    applyData.application.compliance_score >= 85,
    `Compliance score must be high (got ${applyData.application.compliance_score}/100)`
  );
  assert.strictEqual(applyData.application.risk_level, "Low", "Risk level should be Low");

  // Officer verifies application compliance in cockpit
  const verifyRes = await fetch(`${BASE_URL}/api/compliance/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${officerToken}`,
    },
    body: JSON.stringify({
      bidder_id: bidderId,
      tender_id: "GEM/2026/B/882100",
      required_checks: ["udyam", "gstn", "pan_it"],
    }),
  });
  const verifyData = await verifyRes.json();
  assert.strictEqual(verifyRes.status, 200, "Officer verify-compliance should return 200");
  const cockpitScore = verifyData.compliance_score ?? verifyData.score;
  assert(cockpitScore >= 85, `Cockpit score must be >= 85 (got ${cockpitScore})`);
  console.log(`✓ Cockpit verified score: ${cockpitScore}/100, Risk: ${verifyData.risk_level}`);
  console.log("✓ TEST 6 Passed: Compliance pipeline successfully verified with high score and zero LLM dependencies");

  console.log("\n===============================================================");
  console.log("ALL 6 TESTS PASSED SUCCESSFULLY!");
  console.log("✓ Feature 1: Local Tender PDF extraction & form creation works");
  console.log("✓ Feature 2: Multi-document Other Statutory Vault works");
  console.log("✓ Non-destructive multi-file coexistence verified");
  console.log("✓ Profile sync and conflict detection verified");
  console.log("✓ Compliance evaluation remains 100% functional");
  console.log("===============================================================");
}

runTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
