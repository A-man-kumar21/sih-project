import fs from "fs";
import path from "path";

const GATEWAY_URL = "http://127.0.0.1:3001";
const ENGINE_URL = "http://127.0.0.1:8000";

async function runTests() {
  console.log("================================================================================");
  console.log("BIDSETU: LOCAL DETERMINISTIC EXTRACTION (NO LLM / NO EXTERNAL API) VERIFICATION");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`[PASS] Test ${total}: ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${total}: ${message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // PART 1: Direct AI-Engine Local Extraction Tests
  // ---------------------------------------------------------------------------
  console.log("\n--- PART 1: DIRECT AI-ENGINE LOCAL EXTRACTION ---");

  // Test 1: Text-based Udyam PDF -> PyMuPDF
  const textPdfBuf = fs.readFileSync("test_assets/udyam_text.pdf");
  const form1 = new FormData();
  form1.append("file", new Blob([textPdfBuf], { type: "application/pdf" }), "udyam_text.pdf");
  const res1 = await fetch(`${ENGINE_URL}/extract-bidder-pdf?document_type=udyam_cert`, {
    method: "POST",
    body: form1,
  });
  const data1 = await res1.json();

  assert(res1.ok && data1.success === true, "AI Engine extract text PDF returns 200 OK and success: true");
  assert(data1.extractionMethod === "pymupdf", `Text PDF uses PyMuPDF (actual: ${data1.extractionMethod})`);
  assert(data1.fields.udyam_number === "UDYAM-MH-12-0077889", `Extracted Udyam: ${data1.fields.udyam_number}`);
  assert(data1.fields.cin === "U72900MH2021PTC123456", `Extracted CIN: ${data1.fields.cin}`);
  assert(data1.fields.epfo_number === "MH/BAN/0012345/000", `Extracted EPFO: ${data1.fields.epfo_number}`);
  assert(data1.fields.enterprise_type === "Micro", `Extracted Enterprise Type: ${data1.fields.enterprise_type}`);
  assert(data1.confidence >= 90, `Extraction confidence is high (actual: ${data1.confidence}%)`);

  // Test 2: Scanned Udyam PDF -> PaddleOCR
  const scannedPdfBuf = fs.readFileSync("test_assets/udyam_scanned.pdf");
  const form2 = new FormData();
  form2.append("file", new Blob([scannedPdfBuf], { type: "application/pdf" }), "udyam_scanned.pdf");
  const res2 = await fetch(`${ENGINE_URL}/extract-bidder-pdf?document_type=udyam_cert`, {
    method: "POST",
    body: form2,
  });
  const data2 = await res2.json();

  assert(res2.ok && data2.success === true, "AI Engine extract scanned PDF returns 200 OK and success: true");
  assert(data2.extractionMethod === "paddleocr", `Scanned PDF falls back to PaddleOCR (actual: ${data2.extractionMethod})`);
  assert(data2.fields.udyam_number === "UDYAM-MH-12-0077889", `Scanned PDF extracted Udyam: ${data2.fields.udyam_number}`);

  // Test 3: GST Certificate (JPG Image) -> PaddleOCR
  const gstJpgBuf = fs.readFileSync("test_assets/gst_cert.jpg");
  const form3 = new FormData();
  form3.append("file", new Blob([gstJpgBuf], { type: "image/jpeg" }), "gst_cert.jpg");
  const res3 = await fetch(`${ENGINE_URL}/extract-bidder-pdf?document_type=gstin_cert`, {
    method: "POST",
    body: form3,
  });
  const data3 = await res3.json();

  assert(res3.ok && data3.success === true, "AI Engine extract JPG returns 200 OK and success: true");
  assert(data3.extractionMethod === "paddleocr", `JPG image uses PaddleOCR (actual: ${data3.extractionMethod})`);
  assert(data3.fields.gstin === "27AABCA1234A1Z5", `Extracted GSTIN: ${data3.fields.gstin}`);
  assert(data3.fields.pan === "AABCA1234A", `Extracted/derived PAN from GSTIN: ${data3.fields.pan}`);

  // Test 4: PAN Card (PNG Image) -> PaddleOCR
  const panPngBuf = fs.readFileSync("test_assets/pan_card.png");
  const form4 = new FormData();
  form4.append("file", new Blob([panPngBuf], { type: "image/png" }), "pan_card.png");
  const res4 = await fetch(`${ENGINE_URL}/extract-bidder-pdf?document_type=pan_card`, {
    method: "POST",
    body: form4,
  });
  const data4 = await res4.json();

  assert(res4.ok && data4.success === true, "AI Engine extract PNG returns 200 OK and success: true");
  assert(data4.extractionMethod === "paddleocr", `PNG image uses PaddleOCR (actual: ${data4.extractionMethod})`);
  assert(data4.fields.pan === "AABCA1234A", `Extracted PAN: ${data4.fields.pan}`);

  // ---------------------------------------------------------------------------
  // PART 2: End-to-End Bidder Document Vault & Profile Flow
  // ---------------------------------------------------------------------------
  console.log("\n--- PART 2: END-TO-END BIDDER DOCUMENT VAULT & ENTERPRISE PROFILE ---");

  const testId = Date.now();
  const bidderEmail = `det_bidder_${testId}@test.com`;
  const bidderPassword = "Password@123";

  // Register fresh bidder
  const regRes = await fetch(`${GATEWAY_URL}/api/auth/register/bidder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: bidderEmail,
      password: bidderPassword,
      confirm_password: bidderPassword,
      company_name: "Acme Initial Name",
      contact_person: "Rohit Sharma",
      phone: "9876543210",
    }),
  });
  const regData = await regRes.json();
  assert(regRes.ok && regData.token, "Registered fresh bidder successfully");
  const token = regData.token;

  // Upload Udyam PDF (Text)
  const upForm1 = new FormData();
  upForm1.append("file", new Blob([textPdfBuf], { type: "application/pdf" }), "udyam_cert.pdf");
  upForm1.append("document_type", "udyam_cert");
  const upRes1 = await fetch(`${GATEWAY_URL}/api/bidder/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: upForm1,
  });
  const upData1 = await upRes1.json();
  assert(upRes1.ok && upData1.success, "Uploaded Udyam PDF to vault");
  assert(upData1.document?.extracted_data?.extractionMethod === "pymupdf", "Vault Udyam PDF extraction method is PyMuPDF");

  // Upload GST Certificate (JPG)
  const upForm2 = new FormData();
  upForm2.append("file", new Blob([gstJpgBuf], { type: "image/jpeg" }), "gst_cert.jpg");
  upForm2.append("document_type", "gstin_cert");
  const upRes2 = await fetch(`${GATEWAY_URL}/api/bidder/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: upForm2,
  });
  const upData2 = await upRes2.json();
  assert(upRes2.ok && upData2.success, "Uploaded GST JPG to vault");
  assert(upData2.document?.extracted_data?.extractionMethod === "paddleocr", "Vault GST JPG extraction method is PaddleOCR");

  // Upload PAN Card (PNG)
  const upForm3 = new FormData();
  upForm3.append("file", new Blob([panPngBuf], { type: "image/png" }), "pan_card.png");
  upForm3.append("document_type", "pan_card");
  const upRes3 = await fetch(`${GATEWAY_URL}/api/bidder/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: upForm3,
  });
  const upData3 = await upRes3.json();
  assert(upRes3.ok && upData3.success, "Uploaded PAN PNG to vault");
  assert(upData3.document?.extracted_data?.extractionMethod === "paddleocr", "Vault PAN PNG extraction method is PaddleOCR");

  // Verify Enterprise Profile Auto-Population
  const profRes = await fetch(`${GATEWAY_URL}/api/bidder/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const profData = await profRes.json();
  assert(profRes.ok, "Fetched bidder enterprise profile");
  const ep = profData.profile?.enterprise_profile || {};
  const stat = profData.profile?.statutory || {};

  assert(ep.udyam_number?.value === "UDYAM-MH-12-0077889", `Profile Udyam auto-populated: ${ep.udyam_number?.value}`);
  assert(ep.gstin?.value === "27AABCA1234A1Z5", `Profile GSTIN auto-populated: ${ep.gstin?.value}`);
  assert(ep.pan?.value === "AABCA1234A", `Profile PAN auto-populated: ${ep.pan?.value}`);
  assert(ep.cin?.value === "U72900MH2021PTC123456", `Profile CIN auto-populated: ${ep.cin?.value}`);
  assert(
    (ep.epfo_number?.value === "MH/BAN/0012345/000" || ep.epfo_esic_number?.value === "MH/BAN/0012345/000"),
    `Profile EPFO auto-populated: ${ep.epfo_number?.value || ep.epfo_esic_number?.value}`
  );
  assert(stat.pan === "AABCA1234A" && stat.gstin === "27AABCA1234A1Z5" && stat.udyam_number === "UDYAM-MH-12-0077889", "Statutory credentials synchronized");

  // ---------------------------------------------------------------------------
  // PART 3: Persistence & Manual Override
  // ---------------------------------------------------------------------------
  console.log("\n--- PART 3: PERSISTENCE & MANUAL OVERRIDE ---");

  // Logout / Re-login
  const loginRes = await fetch(`${GATEWAY_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: bidderEmail, password: bidderPassword }),
  });
  const loginData = await loginRes.json();
  const token2 = loginData.token;

  const profRes2 = await fetch(`${GATEWAY_URL}/api/bidder/profile`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const profData2 = await profRes2.json();
  assert(profData2.profile?.enterprise_profile?.gstin?.value === "27AABCA1234A1Z5", "Profile persisted in MongoDB across re-login");

  // Manual Override
  const putRes = await fetch(`${GATEWAY_URL}/api/bidder/profile`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token2}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      business_constitution: "Private Limited Company (Manually Confirmed)",
    }),
  });
  const putData = await putRes.json();
  assert(putRes.ok, "PUT /api/bidder/profile succeeded");
  assert(
    putData.profile?.enterprise_profile?.business_constitution?.source === "Manual Entry",
    "Manual override correctly reflects 'Manual Entry' provenance"
  );

  // ---------------------------------------------------------------------------
  // PART 4: Tender Application Pre-Check & Auto-Reuse
  // ---------------------------------------------------------------------------
  console.log("\n--- PART 4: TENDER APPLICATION & AUTO-REUSE ---");

  // Create Officer and Tender
  const officerEmail = `det_officer_${testId}@gem.gov.in`;
  const offRegRes = await fetch(`${GATEWAY_URL}/api/auth/register/officer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: officerEmail,
      password: bidderPassword,
      confirm_password: bidderPassword,
      full_name: "Procurement Officer",
      department: "Ministry of Power",
      designation: "Deputy Director",
      employee_id: "EMP9876",
      phone: "9876543210",
    }),
  });
  const offRegData = await offRegRes.json();
  const officerToken = offRegData.token;

  const tenderId = `TENDER-DET-${testId}`;
  const tCreateRes = await fetch(`${GATEWAY_URL}/api/officer/tenders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${officerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tender_id: tenderId,
      title: "Solar PV Rooftop Generation Equipment",
      category: "Solar Equipment",
      description: "Procurement of high efficiency solar PV modules for government buildings",
      department: "Ministry of Power",
      estimated_value: 8500000,
      closing_date: new Date(Date.now() + 86400000 * 30).toISOString(),
      mandatory_checks: ["udyam", "gstn", "pan_it"],
      evaluation_weights: { udyam: 25, gstn: 25, pan_it: 25, digilocker: 15, epfo_esic: 10 },
      status: "published",
    }),
  });
  const tCreateData = await tCreateRes.json();
  assert(tCreateRes.ok, `Created Tender ${tenderId}`);

  // Bidder checks tender application readiness
  const tListRes = await fetch(`${GATEWAY_URL}/api/bidder/tenders`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const tListData = await tListRes.json();
  assert(tListRes.ok, "Fetched bidder tenders list with readiness");
  const myTender = tListData.tenders?.find((t) => t.tender_id === tenderId);
  assert(myTender && myTender.all_requirements_satisfied === true, "Bidder is ready to apply (all mandatory docs ready in vault)");
  const udyamReq = myTender?.requirements?.find((r) => r.check_key === "udyam");
  const gstnReq = myTender?.requirements?.find((r) => r.check_key === "gstn");
  const panReq = myTender?.requirements?.find((r) => r.check_key === "pan_it");
  assert(
    udyamReq?.satisfied === true &&
    gstnReq?.satisfied === true &&
    panReq?.satisfied === true,
    "All mandatory checks (Udyam, GSTN, PAN) recognized as Ready in Vault (Auto-Reused)"
  );

  // Submit Bid Application
  const applyRes = await fetch(`${GATEWAY_URL}/api/tenders/${tenderId}/apply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token2}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tender_id: tenderId,
      financial_bid: { proposed_amount: 8200000 },
      remarks: "Bid submitted with auto-reused verified statutory credentials",
    }),
  });
  const applyData = await applyRes.json();
  assert(applyRes.ok && applyData.success === true, "Tender application submitted successfully");

  // ---------------------------------------------------------------------------
  // PART 5: Officer Cockpit & Deterministic Scoring
  // ---------------------------------------------------------------------------
  console.log("\n--- PART 5: OFFICER COCKPIT & DETERMINISTIC SCORING ---");

  const appsRes = await fetch(`${GATEWAY_URL}/api/officer/tenders/${tenderId}/applications`, {
    headers: { Authorization: `Bearer ${officerToken}` },
  });
  const appsData = await appsRes.json();
  assert(appsRes.ok && appsData.applicants?.length > 0, "Officer cockpit lists submitted application");

  const submittedApp = appsData.applicants[0];
  assert(submittedApp.compliance_score >= 80, `Compliance Score >= 80 (actual: ${submittedApp.compliance_score}/100)`);
  assert(
    (submittedApp.risk_level || submittedApp.compliance_risk || "").toUpperCase() === "LOW",
    `Compliance Risk is LOW (actual: ${submittedApp.risk_level || submittedApp.compliance_risk})`
  );

  // Verify scoring.py was NOT modified
  const scoringPath = path.resolve("ai-engine/app/scoring.py");
  const scoringContent = fs.readFileSync(scoringPath, "utf-8");
  assert(
    scoringContent.includes("def evaluate_bidder") &&
    scoringContent.includes("CHECK_WEIGHTS"),
    "scoring.py preserved intact without modification"
  );

  // ---------------------------------------------------------------------------
  // PART 6: Negative Test - Missing Required Document Blocks Application
  // ---------------------------------------------------------------------------
  console.log("\n--- PART 6: NEGATIVE TEST - MISSING DOCUMENT BLOCKS APPLICATION ---");

  const unreadyBidderEmail = `unready_${testId}@test.com`;
  const unreadyReg = await fetch(`${GATEWAY_URL}/api/auth/register/bidder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: unreadyBidderEmail,
      password: bidderPassword,
      confirm_password: bidderPassword,
      company_name: "Unready Enterprise",
      contact_person: "Ajay Singh",
      phone: "9876543211",
    }),
  });
  const unreadyData = await unreadyReg.json();
  const unreadyToken = unreadyData.token;

  // Attempt apply without uploading mandatory documents (Udyam, GST, PAN)
  const blockedApplyRes = await fetch(`${GATEWAY_URL}/api/tenders/${tenderId}/apply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${unreadyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tender_id: tenderId,
      financial_bid: { proposed_amount: 8100000 },
    }),
  });
  const blockedApplyData = await blockedApplyRes.json();
  assert(blockedApplyRes.status === 400, `Missing documents blocks application with HTTP 400 (actual: ${blockedApplyRes.status})`);
  assert(
    blockedApplyData.error && blockedApplyData.error.includes("Missing mandatory"),
    `Error message clearly indicates missing statutory documents: ${blockedApplyData.error}`
  );

  console.log("\n================================================================================");
  console.log(`VERIFICATION SUMMARY: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(0)}%)`);
  console.log("================================================================================\n");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
