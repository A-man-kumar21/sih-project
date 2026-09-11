import assert from "assert";

const FRONTEND_URL = "http://localhost:5173";
const BACKEND_URL = "http://localhost:3001";

async function main() {
  console.log("===============================================================================");
  console.log("             VERIFYING TENDER APPLICATION SUBMISSION FIX                       ");
  console.log("===============================================================================\n");

  // ---------------------------------------------------------------------------
  // STEP 1: Verify servers are responsive
  // ---------------------------------------------------------------------------
  console.log(">>> [1] Verifying Backend (3001) & Frontend (5173) are running...");
  const backendHealth = await fetch(`${BACKEND_URL}/api/tenders`);
  assert.strictEqual(backendHealth.status, 200, "Backend /api/tenders should return 200");
  console.log("  ✓ Express Backend Gateway reachable on :3001");

  const frontendHealth = await fetch(`${FRONTEND_URL}`);
  assert.strictEqual(frontendHealth.status, 200, "Frontend root should return 200");
  console.log("  ✓ Vite Frontend Dev Server reachable on :5173");

  // ---------------------------------------------------------------------------
  // STEP 2: Verify JSON 404 on unhandled API routes (No HTML 404!)
  // ---------------------------------------------------------------------------
  console.log("\n>>> [2] Verifying JSON 404 Catch-All (No HTML error pages on /api)...");
  const badApiRes = await fetch(`${FRONTEND_URL}/api/non-existent-endpoint-xyz`);
  assert.strictEqual(badApiRes.status, 404, "Should return 404");
  const badApiType = badApiRes.headers.get("content-type") || "";
  assert.ok(badApiType.includes("application/json"), `Should return JSON, got: ${badApiType}`);
  const badApiJson = await badApiRes.json();
  assert.ok(badApiJson.error, "Should have error property in JSON");
  console.log("  ✓ Unmatched /api routes return clean JSON 404, never HTML:", badApiJson.error);

  // ---------------------------------------------------------------------------
  // STEP 3: Register a fresh Bidder & populate Document Vault
  // ---------------------------------------------------------------------------
  console.log("\n>>> [3] Registering Test Bidder & Populating Vault through Vite Proxy (5173)...");
  const bidderEmail = `fix_bidder_${Date.now()}@aerotech.in`;
  const regRes = await fetch(`${FRONTEND_URL}/api/auth/register/bidder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: bidderEmail,
      password: "TestPassword123!",
      confirm_password: "TestPassword123!",
      name: "AeroTech Defense Systems",
      company_name: "AeroTech Defense Systems Pvt Ltd",
      contact_person: "Vikram Malhotra",
      phone: "+91-9876543210",
      pan: "AABCA1234F",
      gstin: "27AABCA1234F1Z5",
      udyam_number: "UDYAM-MH-12-0044556",
      epfo_esic_number: "MH/PUN/0044556/000",
      category: "Defence & Aerospace",
    }),
  });
  assert.strictEqual(regRes.status, 201, "Bidder registration should return 201");
  const regData = await regRes.json();
  const bidderToken = regData.token;
  const bidderId = regData.user.bidder_id;
  console.log(`  ✓ Registered bidder: ${bidderId} (${bidderEmail})`);

  // Upload required documents into vault
  const uploadDoc = async (type, filename) => {
    const dummyPdf = "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF";
    const formData = new FormData();
    formData.append("file", new Blob([dummyPdf], { type: "application/pdf" }), filename);
    formData.append("document_type", type);
    const upRes = await fetch(`${FRONTEND_URL}/api/bidder/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bidderToken}` },
      body: formData,
    });
    assert.strictEqual(upRes.status, 201, `Document upload for ${type} should return 201`);
    return upRes.json();
  };

  await uploadDoc("pan_card", "pan_card.pdf");
  await uploadDoc("gstin_cert", "gstin_cert.pdf");
  await uploadDoc("udyam_cert", "udyam_cert.pdf");
  console.log("  ✓ Uploaded PAN, GSTIN, and Udyam certificates into reusable vault");

  // ---------------------------------------------------------------------------
  // STEP 4: Browse Tenders & Verify Mandatory Pre-Check
  // ---------------------------------------------------------------------------
  console.log("\n>>> [4] Testing Browse Tenders & Mandatory Document Pre-Check...");
  const tendersRes = await fetch(`${FRONTEND_URL}/api/bidder/tenders`, {
    headers: { Authorization: `Bearer ${bidderToken}` },
  });
  assert.strictEqual(tendersRes.status, 200, "Browse tenders should return 200");
  const tendersData = await tendersRes.json();
  assert.ok(tendersData.tenders.length > 0, "Should have available tenders");

  // Find the tender with slashes: GEM/2026/A/6766 or create one if not present
  let targetTender = tendersData.tenders.find((t) => t.tender_id === "GEM/2026/A/6766");
  if (!targetTender) {
    targetTender = tendersData.tenders.find((t) => t.tender_id.includes("/"));
  }
  if (!targetTender) {
    targetTender = tendersData.tenders.find((t) => t.all_requirements_satisfied) || tendersData.tenders[0];
  }

  console.log(`  Target Tender for Application: "${targetTender.tender_id}" - ${targetTender.title}`);
  console.log(`  Requirements satisfied: ${targetTender.all_requirements_satisfied} (${targetTender.satisfied_count}/${targetTender.required_count})`);

  // ---------------------------------------------------------------------------
  // STEP 5: Apply for Tender with Slash-Containing ID through Vite Proxy (5173)
  // ---------------------------------------------------------------------------
  console.log(`\n>>> [5] Testing Tender Application Submission via POST ${FRONTEND_URL}/api/tenders/.../apply...`);

  // Test with encoded tender ID (the frontend's primary path)
  const encodedTenderId = encodeURIComponent(targetTender.tender_id);
  const applyRes = await fetch(`${FRONTEND_URL}/api/tenders/${encodedTenderId}/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bidderToken}`,
    },
    body: JSON.stringify({ tender_id: targetTender.tender_id }),
  });

  const applyContentType = applyRes.headers.get("content-type") || "";
  console.log(`  Response Status: ${applyRes.status}`);
  console.log(`  Response Content-Type: ${applyContentType}`);
  assert.ok(applyContentType.includes("application/json"), `Expected JSON response, got: ${applyContentType}`);

  const applyData = await applyRes.json();
  assert.strictEqual(applyRes.status, 201, `Expected HTTP 201 Created, got: ${JSON.stringify(applyData)}`);
  assert.strictEqual(applyData.success, true, "Expected applyData.success to be true");
  assert.ok(applyData.application, "Expected applyData.application to exist");
  assert.strictEqual(applyData.application.tender_id, targetTender.tender_id);
  assert.ok(typeof applyData.application.compliance_score === "number", "Compliance score must be a number");

  console.log("  ✓ Application successfully submitted through Vite proxy!");
  console.log("  Application Details:", {
    id: applyData.application.id,
    tender_id: applyData.application.tender_id,
    compliance_score: `${applyData.application.compliance_score}/100`,
    risk_level: applyData.application.risk_level,
    status: applyData.application.status,
  });

  // ---------------------------------------------------------------------------
  // STEP 6: Verify unencoded slash-containing URL also succeeds
  // ---------------------------------------------------------------------------
  console.log("\n>>> [6] Testing Unencoded Slash-Containing Route (Regex Route Handler)...");
  // Register another quick bidder to test unencoded route directly
  const bidder2Email = `fix_bidder2_${Date.now()}@aerotech.in`;
  const reg2Res = await fetch(`${FRONTEND_URL}/api/auth/register/bidder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: bidder2Email,
      password: "TestPassword123!",
      confirm_password: "TestPassword123!",
      name: "AeroTech Systems Two",
      company_name: "AeroTech Two Pvt Ltd",
      contact_person: "Rohit Sharma",
      phone: "+91-9876543211",
      pan: "AABCB9876G",
      gstin: "27AABCB9876G1Z2",
      udyam_number: "UDYAM-MH-12-0099887",
      epfo_esic_number: "MH/PUN/0099887/000",
      category: "Defence & Aerospace",
    }),
  });
  const reg2Data = await reg2Res.json();
  const token2 = reg2Data.token;

  // Upload vault docs for bidder 2
  const dummyPdf = "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF";
  for (const t of ["pan_card", "gstin_cert", "udyam_cert"]) {
    const fd = new FormData();
    fd.append("file", new Blob([dummyPdf], { type: "application/pdf" }), `${t}.pdf`);
    fd.append("document_type", t);
    await fetch(`${FRONTEND_URL}/api/bidder/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token2}` },
      body: fd,
    });
  }

  // Submit with unencoded slashes in path: /api/tenders/GEM/2026/A/6766/apply
  const unencodedRes = await fetch(`${FRONTEND_URL}/api/tenders/${targetTender.tender_id}/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token2}`,
    },
    body: JSON.stringify({ tender_id: targetTender.tender_id }),
  });
  const unencodedData = await unencodedRes.json();
  assert.strictEqual(unencodedRes.status, 201, `Unencoded slash URL should return 201, got: ${JSON.stringify(unencodedData)}`);
  console.log("  ✓ Unencoded slash-containing URL handled cleanly by backend regex route!");

  // ---------------------------------------------------------------------------
  // STEP 7: Verify Duplicate Submission Protection
  // ---------------------------------------------------------------------------
  console.log("\n>>> [7] Testing Duplicate Application Protection...");
  const dupRes = await fetch(`${FRONTEND_URL}/api/tenders/${encodedTenderId}/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bidderToken}`,
    },
    body: JSON.stringify({ tender_id: targetTender.tender_id }),
  });
  assert.strictEqual(dupRes.status, 409, `Duplicate application should be rejected with 409 Conflict, got: ${dupRes.status}`);
  const dupData = await dupRes.json();
  assert.ok(dupData.error.includes("already applied"), `Expected already applied error message, got: ${dupData.error}`);
  console.log("  ✓ Duplicate submission blocked with HTTP 409 Conflict:", dupData.error);

  // ---------------------------------------------------------------------------
  // STEP 8: Verify Bidder's Application History
  // ---------------------------------------------------------------------------
  console.log("\n>>> [8] Verifying Application History for Bidder...");
  const myAppsRes = await fetch(`${FRONTEND_URL}/api/bidder/applications`, {
    headers: { Authorization: `Bearer ${bidderToken}` },
  });
  assert.strictEqual(myAppsRes.status, 200, "Should return 200");
  const myAppsData = await myAppsRes.json();
  const myApps = myAppsData.applications || myAppsData;
  const submittedApp = myApps.find((a) => a.tender_id === targetTender.tender_id);
  assert.ok(submittedApp, "Submitted application must be present in history");
  console.log("  ✓ Application confirmed in bidder history with status:", submittedApp.status);

  // ---------------------------------------------------------------------------
  // STEP 9: Verify Officer View with Slashed Tender ID & Descending Ranking
  // ---------------------------------------------------------------------------
  console.log("\n>>> [9] Testing Officer Applicant Evaluation for Slashed Tender ID...");
  const officerEmail = `officer_eval_${Date.now()}@gem.gov.in`;
  const offReg = await fetch(`${FRONTEND_URL}/api/auth/register/officer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: officerEmail,
      password: "OfficerSecure123!",
      confirm_password: "OfficerSecure123!",
      full_name: "Evaluation Director S. Rao",
      department: "Defence & Strategic Procurement Division",
      designation: "Procurement Director",
    }),
  });
  const offData = await offReg.json();
  const officerToken = offData.token;

  // Retrieve applicants using encoded route
  const applicantsRes = await fetch(`${FRONTEND_URL}/api/tenders/${encodedTenderId}/applications`, {
    headers: { Authorization: `Bearer ${officerToken}` },
  });
  assert.strictEqual(applicantsRes.status, 200, "Officer applicants request should return 200");
  const applicantsData = await applicantsRes.json();
  assert.ok(applicantsData.applicants.length >= 2, "Should have at least our 2 applied bidders");

  // Verify descending score order
  const scores = applicantsData.applicants.map((a) => a.compliance_score);
  for (let i = 0; i < scores.length - 1; i++) {
    assert.ok(scores[i] >= scores[i + 1], `Scores must be in descending order: ${scores}`);
  }
  console.log(`  ✓ Officer successfully retrieved applicants for "${targetTender.tender_id}"`);
  console.log("  Applicant Scores in Order:", scores);
  console.log("  Rank #1 Applicant:", {
    rank: applicantsData.applicants[0].rank,
    bidder_id: applicantsData.applicants[0].bidder_id,
    company_name: applicantsData.applicants[0].company_name,
    compliance_score: applicantsData.applicants[0].compliance_score,
  });

  console.log("\n===============================================================================");
  console.log("         ALL APPLICATION SUBMISSION & ROUTING CHECKS PASSED!                   ");
  console.log("===============================================================================");
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err);
  process.exit(1);
});
