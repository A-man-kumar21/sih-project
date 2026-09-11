import assert from "assert";
import fs from "fs";

const BASE_URL = "http://localhost:3001";
const ENGINE_URL = "http://127.0.0.1:8000";
const TS = Date.now();

console.log("===============================================================================");
console.log("        COMPREHENSIVE FINAL VALIDATION SUITE: BIDSETU PLATFORM");
console.log("===============================================================================");

async function run() {
  // ---------------------------------------------------------------------------
  // TEST 1: BRANDING & UI CLEANUP (ISSUES 1A, 1B, 1C, 2)
  // ---------------------------------------------------------------------------
  console.log("\n>>> [1] Validating Branding & UI Cleanup in Frontend Source...");

  // 1A & 1C: Navbar checks
  const navbarSrc = fs.readFileSync("frontend/src/components/Navbar.jsx", "utf-8");
  assert(!navbarSrc.includes("btn-login-cta"), "Navbar: Redundant top-right Sign In button (btn-login-cta) removed");
  assert(navbarSrc.includes("TenderFlow"), "Navbar: Brand title updated to 'TenderFlow'");
  assert(!navbarSrc.includes("SIH 2026"), "Navbar: Visible 'SIH 2026' string removed");

  // 1B: ComplianceCockpit checks
  const cockpitSrc = fs.readFileSync("frontend/src/pages/ComplianceCockpit.jsx", "utf-8");
  assert(!cockpitSrc.includes("SIH 2026"), "ComplianceCockpit: Visible 'SIH 2026' removed");
  assert(cockpitSrc.includes("TenderFlow"), "ComplianceCockpit: Heading uses 'TenderFlow'");
  assert(!cockpitSrc.includes("+ Register New Bidder"), "ComplianceCockpit: '+ Register New Bidder' button removed");
  assert(!cockpitSrc.includes("+ New Tender"), "ComplianceCockpit: '+ New Tender' button removed");

  // 1C: Auth pages & index.html
  const indexHtml = fs.readFileSync("frontend/index.html", "utf-8");
  assert(indexHtml.includes("TenderFlow"), "index.html: Page title updated to 'TenderFlow'");

  const loginSrc = fs.readFileSync("frontend/src/pages/auth/Login.jsx", "utf-8");
  assert(loginSrc.includes("Sign In to TenderFlow"), "Login.jsx: Form title updated to 'Sign In to TenderFlow'");

  const regOfficerSrc = fs.readFileSync("frontend/src/pages/auth/RegisterOfficer.jsx", "utf-8");
  assert(regOfficerSrc.includes("TenderFlow"), "RegisterOfficer.jsx: Emblem updated to 'TenderFlow'");

  const regBidderSrc = fs.readFileSync("frontend/src/pages/auth/RegisterBidder.jsx", "utf-8");
  assert(regBidderSrc.includes("TenderFlow"), "RegisterBidder.jsx: Emblem updated to 'TenderFlow'");

  console.log("  ✓ All branding, title, SIH removal, and button cleanup tests PASSED!");

  // ---------------------------------------------------------------------------
  // TEST 2: SETUP TEST ACCOUNTS & TENDERS
  // ---------------------------------------------------------------------------
  console.log("\n>>> [2] Setting up Officer, Bidders, and Tenders for Isolation & Scoring...");

  // 2a. Register Officer
  const offRes = await fetch(`${BASE_URL}/api/auth/register/officer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: "Procurement Director",
      email: `director.${TS}@gem.gov.in`,
      department: "Central Procurement",
      designation: "Director",
      password: "password123",
      confirm_password: "password123",
    }),
  });
  const offData = await offRes.json();
  assert(offRes.status === 201, "Officer registered successfully");
  const officerToken = offData.token;

  // 2b. Register Bidder 1 (with statutory identifiers)
  const bid1Res = await fetch(`${BASE_URL}/api/auth/register/bidder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_name: "Apex Cyber Security Pvt Ltd",
      contact_person: "Rajesh Sharma",
      email: `apex.${TS}@apexsec.in`,
      phone: "+91 9876543210",
      password: "password123",
      confirm_password: "password123",
      pan: "AABCA1234A",
      gstin: "07AABCA1234A1Z5",
      udyam_number: "UDYAM-DL-05-0012345",
      epfo_esic_number: "DLCPM1234567000",
    }),
  });
  const bid1Data = await bid1Res.json();
  assert(bid1Res.status === 201, "Bidder 1 registered");
  const bidder1Token = bid1Data.token;
  const bidder1Id = bid1Data.user.bidder_id;

  // 2c. Register Bidder 2
  const bid2Res = await fetch(`${BASE_URL}/api/auth/register/bidder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_name: "Zenith Supplies LLP",
      contact_person: "Pooja Verma",
      email: `zenith.${TS}@zenith.in`,
      phone: "+91 9123456780",
      password: "password123",
      confirm_password: "password123",
      pan: "AACFB5678K",
      gstin: "27AACFB5678K1Z2",
      udyam_number: "UDYAM-MH-19-0087654",
    }),
  });
  const bid2Data = await bid2Res.json();
  assert(bid2Res.status === 201, "Bidder 2 registered");
  const bidder2Token = bid2Data.token;
  const bidder2Id = bid2Data.user.bidder_id;

  // 2d. Officer creates Tender A and Tender B
  const tenderAId = `TENDER-A-${TS}`;
  const tenderBId = `TENDER-B-${TS}`;

  await fetch(`${BASE_URL}/api/tenders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${officerToken}` },
    body: JSON.stringify({
      tender_id: tenderAId,
      title: "Secure Server Infrastructure Tender A",
      category: "IT & Telecom",
      mandatory_checks: ["pan_it", "gstn", "udyam"],
    }),
  });

  await fetch(`${BASE_URL}/api/tenders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${officerToken}` },
    body: JSON.stringify({
      tender_id: tenderBId,
      title: "Office Stationery Supplies Tender B",
      category: "Goods",
      mandatory_checks: ["pan_it", "gstn", "udyam"],
    }),
  });
  console.log(`  ✓ Created Tender A (${tenderAId}) and Tender B (${tenderBId})`);

  // ---------------------------------------------------------------------------
  // TEST 3: DOCUMENT UPLOAD & EXTRACTION (ISSUES 4, 5, 6)
  // ---------------------------------------------------------------------------
  console.log("\n>>> [3] Testing Document Vault Upload, Extraction & Ownership...");

  // Upload PAN Card for Bidder 1 using sample_bidder_kavach.pdf
  const pdfBytes = fs.readFileSync("sample_bidder_kavach.pdf");

  const fd1 = new FormData();
  fd1.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "pan_card.pdf");
  fd1.append("document_type", "pan_card");

  const upPanRes = await fetch(`${BASE_URL}/api/bidder/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidder1Token}` },
    body: fd1,
  });
  const upPanData = await upPanRes.json();
  assert(upPanRes.status === 201, "Bidder 1 uploaded pan_card.pdf");
  const doc1Id = upPanData.document.id;

  // Upload GST and Udyam for Bidder 1
  for (const dt of ["gstin_cert", "udyam_cert"]) {
    const fd = new FormData();
    fd.append("file", new Blob([pdfBytes], { type: "application/pdf" }), `${dt}.pdf`);
    fd.append("document_type", dt);
    await fetch(`${BASE_URL}/api/bidder/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bidder1Token}` },
      body: fd,
    });
  }
  console.log("  ✓ Bidder 1 uploaded all 3 mandatory documents to vault");

  // Upload documents for Bidder 2
  for (const dt of ["pan_card", "gstin_cert", "udyam_cert"]) {
    const fd = new FormData();
    fd.append("file", new Blob([pdfBytes], { type: "application/pdf" }), `b2_${dt}.pdf`);
    fd.append("document_type", dt);
    await fetch(`${BASE_URL}/api/bidder/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bidder2Token}` },
      body: fd,
    });
  }
  console.log("  ✓ Bidder 2 uploaded all 3 mandatory documents to vault");

  // ---------------------------------------------------------------------------
  // TEST 4: DOCUMENT ACCESS SECURITY & OWNERSHIP (ISSUES 5 & 6)
  // ---------------------------------------------------------------------------
  console.log("\n>>> [4] Testing Document Endpoint Protection & Ownership Enforcement...");

  // 4a. Unauthenticated access -> MUST FAIL (401)
  const unauthViewRes = await fetch(`${BASE_URL}/api/documents/${doc1Id}/view`);
  assert(unauthViewRes.status === 401, "Unauthenticated access blocked with HTTP 401");

  // 4b. Cross-bidder access: Bidder 2 attempts to view Bidder 1's document -> MUST FAIL (403)
  const crossBidderRes = await fetch(`${BASE_URL}/api/documents/${doc1Id}/view`, {
    headers: { Authorization: `Bearer ${bidder2Token}` },
  });
  assert(crossBidderRes.status === 403, "Cross-bidder document access blocked with HTTP 403");

  // 4c. Owner access: Bidder 1 views own document -> MUST SUCCEED (200)
  const ownerViewRes = await fetch(`${BASE_URL}/api/documents/${doc1Id}/view`, {
    headers: { Authorization: `Bearer ${bidder1Token}` },
  });
  assert(ownerViewRes.status === 200, "Bidder 1 can view own document (HTTP 200)");
  assert(ownerViewRes.headers.get("content-type")?.includes("pdf"), "Content-Type is PDF");
  assert(ownerViewRes.headers.get("content-disposition")?.includes("inline"), "Content-Disposition is inline for view");

  // 4d. Owner download: Bidder 1 downloads own document -> MUST SUCCEED (200)
  const ownerDownloadRes = await fetch(`${BASE_URL}/api/documents/${doc1Id}/download`, {
    headers: { Authorization: `Bearer ${bidder1Token}` },
  });
  assert(ownerDownloadRes.status === 200, "Bidder 1 can download own document (HTTP 200)");
  assert(ownerDownloadRes.headers.get("content-disposition")?.includes("attachment"), "Content-Disposition is attachment for download");

  console.log("  ✓ Document authentication, ownership, and headers verified!");

  // ---------------------------------------------------------------------------
  // TEST 5: TENDER APPLICATION & NON-ZERO COMPLIANCE SCORING (ISSUES 4 & 10)
  // ---------------------------------------------------------------------------
  console.log("\n>>> [5] Testing Tender Application & Deterministic Compliance Scoring...");

  // Bidder 1 applies to Tender A ONLY
  const applyRes1 = await fetch(`${BASE_URL}/api/tenders/${tenderAId}/apply`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidder1Token}` },
  });
  const applyData1 = await applyRes1.json();
  assert(applyRes1.status === 201, "Bidder 1 applied to Tender A successfully");
  assert(applyData1.application?.tender_id === tenderAId, "Application linked to Tender A");

  const score1 = applyData1.application.compliance_score;
  const risk1 = applyData1.application.risk_level;
  console.log(`  -> Bidder 1 Application Score for Tender A: ${score1}/100 (Risk: ${risk1})`);
  assert(typeof score1 === "number", "Compliance score is a number");
  assert(score1 > 0, `CRITICAL: Compliance score is ${score1} (> 0), NOT 0!`);
  assert(risk1 === "Low" || risk1 === "Medium", `Risk level is ${risk1}, NOT High risk`);

  // Issue 10: Duplicate submission test (same bidder, same tender) -> MUST RETURN 409
  const dupApplyRes = await fetch(`${BASE_URL}/api/tenders/${tenderAId}/apply`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidder1Token}` },
  });
  assert(dupApplyRes.status === 409, "Duplicate tender application prevented with HTTP 409 Conflict");

  // Bidder 2 applies to Tender B ONLY
  const applyRes2 = await fetch(`${BASE_URL}/api/tenders/${tenderBId}/apply`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidder2Token}` },
  });
  assert(applyRes2.status === 201, "Bidder 2 applied to Tender B successfully");
  const applyData2 = await applyRes2.json();
  const score2 = applyData2.application.compliance_score;
  console.log(`  -> Bidder 2 Application Score for Tender B: ${score2}/100`);
  assert(score2 > 0, `CRITICAL: Bidder 2 compliance score is ${score2} (> 0), NOT 0!`);

  // ---------------------------------------------------------------------------
  // TEST 6: CRITICAL APPLICANT ISOLATION (ISSUE 3)
  // ---------------------------------------------------------------------------
  console.log("\n>>> [6] Testing Critical Tender Applicant Isolation (/api/overview)...");

  // Overview for Tender A: MUST contain ONLY Bidder 1
  const overARes = await fetch(`${BASE_URL}/api/overview?tender_id=${tenderAId}`);
  const overA = await overARes.json();
  assert(overA.tender_id === tenderAId, "Tender A overview matches requested tender_id");
  assert(overA.aggregates.total_bidders === 1, "Tender A has exactly 1 applicant");
  assert(overA.bidders.length === 1, "Tender A bidders array contains exactly 1 applicant");
  assert(overA.bidders[0].bidder_id === bidder1Id, "Tender A applicant is Bidder 1");
  assert(overA.bidders[0].compliance_score === score1, "Overview reflects Bidder 1's non-zero compliance score");
  assert(!overA.bidders.some((b) => b.bidder_id === bidder2Id), "CRITICAL: Bidder 2 DOES NOT appear under Tender A!");

  // Overview for Tender B: MUST contain ONLY Bidder 2
  const overBRes = await fetch(`${BASE_URL}/api/overview?tender_id=${tenderBId}`);
  const overB = await overBRes.json();
  assert(overB.tender_id === tenderBId, "Tender B overview matches requested tender_id");
  assert(overB.aggregates.total_bidders === 1, "Tender B has exactly 1 applicant");
  assert(overB.bidders.length === 1, "Tender B bidders array contains exactly 1 applicant");
  assert(overB.bidders[0].bidder_id === bidder2Id, "Tender B applicant is Bidder 2");
  assert(!overB.bidders.some((b) => b.bidder_id === bidder1Id), "CRITICAL: Bidder 1 DOES NOT appear under Tender B!");

  // Overview for an empty tender: MUST contain 0 applicants
  const emptyTenderId = `TENDER-EMPTY-${TS}`;
  const overEmptyRes = await fetch(`${BASE_URL}/api/overview?tender_id=${emptyTenderId}`);
  const overEmpty = await overEmptyRes.json();
  assert(overEmpty.aggregates.total_bidders === 0, "Empty tender has 0 total applicants");
  assert(overEmpty.bidders.length === 0, "Empty tender has empty bidders array []");

  // Officer /api/tenders/:id/applications isolation check
  const offAppsARes = await fetch(`${BASE_URL}/api/tenders/${tenderAId}/applications`, {
    headers: { Authorization: `Bearer ${officerToken}` },
  });
  const offAppsA = await offAppsARes.json();
  assert(offAppsA.applicants.length === 1, "Officer tender view has exactly 1 applicant for Tender A");
  assert(offAppsA.applicants[0].bidder_id === bidder1Id, "Officer tender view has Bidder 1 only for Tender A");

  console.log("  ✓ Strict applicant isolation verified across all tenders!");

  // ---------------------------------------------------------------------------
  // TEST 7: OFFICER REVIEW & DOCUMENT VIEWING (ISSUE 6)
  // ---------------------------------------------------------------------------
  console.log("\n>>> [7] Testing Officer Review, Document Access, and Governance Decisions...");

  // Officer views Bidder 1's submitted document
  const offDocRes = await fetch(`${BASE_URL}/api/documents/${doc1Id}/view`, {
    headers: { Authorization: `Bearer ${officerToken}` },
  });
  assert(offDocRes.status === 200, "Authorized Officer can view applicant submitted document (HTTP 200)");

  // Officer records decision on Bidder 1 application
  const app1Id = applyData1.application.id;
  const approveRes = await fetch(`${BASE_URL}/api/applications/${app1Id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${officerToken}` },
    body: JSON.stringify({ comment: "All mandatory credentials verified and compliant." }),
  });
  const approveData = await approveRes.json();
  assert(approveRes.status === 200, "Officer approved application");
  assert(approveData.status === "approved" || approveData.application?.status === "approved", "Application status updated to 'approved'");

  console.log("  ✓ Officer evaluation, document review, and decision workflow PASSED!");

  console.log("\n===============================================================================");
  console.log("    ALL 7 VALIDATION SUITES PASSED FLAWLESSLY! ALL ACCEPTANCE CRITERIA MET.");
  console.log("===============================================================================\n");
}

run().catch((err) => {
  console.error("\n❌ TEST FAILED WITH ERROR:", err);
  process.exit(1);
});
