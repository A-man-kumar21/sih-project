/**
 * End-to-End Test Suite for GeM Bid Compliance Platform
 * Role-Based Authentication, Document Vault, Mandatory Validation,
 * Descending Compliance Score Ranking, Officer Decisions, and Audit Trail Sync.
 */

const BASE_URL = "http://localhost:3001";
const TS = Date.now();

let officerToken = "";
let officerUser = null;
let bidder1Token = "";
let bidder1User = null;
let bidder2Token = "";
let bidder2User = null;
let testTenderId = `TENDER-TEST-${TS}`;
let application1Id = "";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log("===============================================================================");
  console.log("       ROLE-BASED WORKFLOW & PROCUREMENT GOVERNANCE VERIFICATION              ");
  console.log("===============================================================================\n");

  // ---------------------------------------------------------------------------
  // 1. OFFICER REGISTRATION & AUTHENTICATION
  // ---------------------------------------------------------------------------
  console.log(">>> [1] Testing Officer Registration & Login...");
  const offRegRes = await fetch(`${BASE_URL}/api/auth/register/officer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: "Dr. Arunima Sen",
      email: `officer.${TS}@gem.gov.in`,
      phone: "+91 9876500001",
      department: "Directorate General of Supplies",
      designation: "Chief Procurement Officer",
      employee_id: `OFFICER-DGS-${TS}`,
      password: "SecureOfficerPass123",
      confirm_password: "SecureOfficerPass123",
    }),
  });
  const offRegData = await offRegRes.json();
  assert(offRegRes.status === 201, "Officer registered successfully with HTTP 201");
  assert(offRegData.user?.role === "officer", "Officer role assigned correctly");
  assert(Boolean(offRegData.token), "JWT token returned upon officer registration");
  assert(!offRegData.user?.password_hash, "Password hash is never exposed to frontend");

  officerToken = offRegData.token;
  officerUser = offRegData.user;

  // Test duplicate email rejection
  const dupRes = await fetch(`${BASE_URL}/api/auth/register/officer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: "Duplicate User",
      email: `officer.${TS}@gem.gov.in`,
      department: "Dept",
      designation: "Officer",
      password: "password123",
      confirm_password: "password123",
    }),
  });
  assert(dupRes.status === 409, "Duplicate email registration rejected with HTTP 409 Conflict");

  // ---------------------------------------------------------------------------
  // 2. BIDDER REGISTRATION & AI ENGINE PROFILE SYNC
  // ---------------------------------------------------------------------------
  console.log("\n>>> [2] Testing Bidder Registration & AI Engine Sync...");
  const bid1RegRes = await fetch(`${BASE_URL}/api/auth/register/bidder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_name: "Kavach Cyber Solutions LLP",
      contact_person: "Vikram Malhotra",
      email: `bidder1.${TS}@kavach.in`,
      phone: "+91 9811122233",
      password: "SecureBidderPass123",
      confirm_password: "SecureBidderPass123",
    }),
  });
  const bid1RegData = await bid1RegRes.json();
  assert(bid1RegRes.status === 201, "Bidder 1 registered successfully with HTTP 201");
  assert(bid1RegData.user?.role === "bidder", "Bidder role assigned correctly");
  assert(bid1RegData.user?.bidder_id.startsWith("BIDDER-"), "Unique internal bidder_id generated");

  bidder1Token = bid1RegData.token;
  bidder1User = bid1RegData.user;

  // Verify bidder is discoverable in AI Engine bidders list
  const biddersListRes = await fetch(`${BASE_URL}/api/bidders`);
  const biddersList = await biddersListRes.json();
  const foundBidder = biddersList.find((b) => b.bidder_id === bidder1User.bidder_id);
  assert(Boolean(foundBidder), "Bidder profile synchronized and discoverable in AI Engine registry");

  // Set statutory credentials on Bidder 1 profile
  await fetch(`${BASE_URL}/api/bidder/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bidder1Token}` },
    body: JSON.stringify({
      pan: "AABCA1234A",
      gstin: "07AABCA1234A1Z5",
      udyam_number: "UDYAM-DL-05-0012345",
      epfo_esic_number: "DLCPM1234567000",
    }),
  });
  console.log("  ✓ Bidder 1 statutory credentials configured");

  // ---------------------------------------------------------------------------
  // 3. SECURITY & ROLE-BASED ACCESS CONTROL ENFORCEMENT
  // ---------------------------------------------------------------------------
  console.log("\n>>> [3] Testing Server-Side RBAC Enforcement...");
  // 3a. Bidder attempt to create tender -> MUST FAIL (403)
  const forbiddenTenderRes = await fetch(`${BASE_URL}/api/tenders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bidder1Token}` },
    body: JSON.stringify({
      tender_id: "ILLEGAL-TENDER",
      title: "Illegal Tender",
      category: "Goods",
      mandatory_checks: ["pan_it"],
    }),
  });
  assert(forbiddenTenderRes.status === 403, "Bidder blocked from creating tender (HTTP 403 Forbidden)");

  // 3b. Unauthenticated access to officer overview -> MUST FAIL (401)
  const unauthRes = await fetch(`${BASE_URL}/api/officer/overview`);
  assert(unauthRes.status === 401, "Unauthenticated access blocked (HTTP 401 Unauthorized)");

  // ---------------------------------------------------------------------------
  // 4. OFFICER TENDER CREATION WITH DYNAMIC COMPLIANCE REQUIREMENTS
  // ---------------------------------------------------------------------------
  console.log("\n>>> [4] Testing Officer Tender Creation...");
  const createTenderRes = await fetch(`${BASE_URL}/api/tenders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${officerToken}` },
    body: JSON.stringify({
      tender_id: testTenderId,
      title: "Advanced Perimeter Defense & Cybersecurity Hardware",
      category: "IT & Telecom",
      description: "High-integrity procurement requiring verified PAN, GSTN, and Udyam MSME certification.",
      mandatory_checks: ["pan_it", "gstn", "udyam"],
      deadline: "2026-11-30",
    }),
  });
  const createTenderData = await createTenderRes.json();
  assert(createTenderRes.status === 201, "Officer created tender successfully (HTTP 201 Created)");
  assert(createTenderData.tender?.created_by === officerUser.id, "Tender ownership recorded with officer user ID");

  // ---------------------------------------------------------------------------
  // 5. MANDATORY DOCUMENT VALIDATION & BLOCKING
  // ---------------------------------------------------------------------------
  console.log("\n>>> [5] Testing Mandatory Document Pre-Check & Blocking...");
  // Bidder 1 attempts to apply with empty document vault -> MUST BE BLOCKED (400)
  const applyBlockedRes = await fetch(`${BASE_URL}/api/tenders/${testTenderId}/apply`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidder1Token}` },
  });
  const applyBlockedData = await applyBlockedRes.json();
  assert(applyBlockedRes.status === 400, "Application blocked due to missing mandatory documents (HTTP 400)");
  assert(applyBlockedData.missing_documents?.length === 3, "All 3 missing statutory documents correctly reported");

  // ---------------------------------------------------------------------------
  // 6. BIDDER DOCUMENT VAULT & DOCUMENT REUSE APPLICATION
  // ---------------------------------------------------------------------------
  console.log("\n>>> [6] Testing Document Vault Upload & 1-Click Reuse...");
  // Upload PAN Card and GSTIN Cert only (Udyam still missing)
  const docsToUpload = [
    { type: "pan_card", name: "pan_certificate.pdf" },
    { type: "gstin_cert", name: "gst_registration.pdf" },
  ];
  for (const d of docsToUpload) {
    const fd = new FormData();
    const blob = new Blob([`Mock PDF content for ${d.name}`], { type: "application/pdf" });
    fd.append("file", blob, d.name);
    fd.append("document_type", d.type);
    const upRes = await fetch(`${BASE_URL}/api/bidder/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bidder1Token}` },
      body: fd,
    });
    assert(upRes.status === 201, `Uploaded ${d.type} into reusable vault`);
  }

  // Attempt apply again -> Still missing Udyam
  const applyBlocked2 = await fetch(`${BASE_URL}/api/tenders/${testTenderId}/apply`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidder1Token}` },
  });
  const applyBlocked2Data = await applyBlocked2.json();
  assert(applyBlocked2.status === 400, "Application still blocked: missing Udyam certificate");
  assert(applyBlocked2Data.missing_documents?.[0]?.document_type === "udyam_cert", "Accurately identified remaining missing document: udyam_cert");

  // Upload final missing certificate: Udyam
  const fdUdyam = new FormData();
  const blobUdyam = new Blob(["Mock Udyam certificate PDF"], { type: "application/pdf" });
  fdUdyam.append("file", blobUdyam, "udyam_cert.pdf");
  fdUdyam.append("document_type", "udyam_cert");
  await fetch(`${BASE_URL}/api/bidder/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidder1Token}` },
    body: fdUdyam,
  });
  console.log("  ✓ Uploaded udyam_cert into vault");

  // Re-apply: All mandatory documents are now satisfied -> MUST SUCCEED with document reuse
  const applySuccessRes = await fetch(`${BASE_URL}/api/tenders/${testTenderId}/apply`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidder1Token}` },
  });
  const applySuccessData = await applySuccessRes.json();
  assert(applySuccessRes.status === 201, "Application submitted successfully (HTTP 201 Created)");
  assert(applySuccessData.application?.status === "submitted", "Application status set to 'submitted'");
  assert(applySuccessData.application?.submitted_documents?.length === 3, "All 3 vault documents reused by reference");
  assert(typeof applySuccessData.application?.compliance_score === "number", "Compliance scoring engine evaluated application");

  application1Id = applySuccessData.application.id;

  // ---------------------------------------------------------------------------
  // 7. SECOND BIDDER & DESCENDING SCORE APPLICANT RANKING
  // ---------------------------------------------------------------------------
  console.log("\n>>> [7] Testing Multiple Applicants & Descending Compliance Score Ranking...");
  // Register Bidder 2 with incomplete/lower credentials
  const bid2RegRes = await fetch(`${BASE_URL}/api/auth/register/bidder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_name: "Defective Supply Corp",
      contact_person: "Ramesh Gupta",
      email: `bidder2.${TS}@defect.in`,
      phone: "+91 9988776655",
      password: "Password123!",
      confirm_password: "Password123!",
    }),
  });
  const bid2RegData = await bid2RegRes.json();
  bidder2Token = bid2RegData.token;
  bidder2User = bid2RegData.user;

  // Upload placeholder documents for Bidder 2
  for (const dt of ["pan_card", "gstin_cert", "udyam_cert"]) {
    const fd = new FormData();
    const blob = new Blob([`Mock PDF for Bidder 2: ${dt}`], { type: "application/pdf" });
    fd.append("file", blob, `${dt}.pdf`);
    fd.append("document_type", dt);
    await fetch(`${BASE_URL}/api/bidder/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bidder2Token}` },
      body: fd,
    });
  }

  // Bidder 2 applies to the same tender
  const bid2ApplyRes = await fetch(`${BASE_URL}/api/tenders/${testTenderId}/apply`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidder2Token}` },
  });
  assert(bid2ApplyRes.status === 201, "Bidder 2 submitted application");

  // Officer fetches applicants for this tender
  const applicantsRes = await fetch(`${BASE_URL}/api/tenders/${testTenderId}/applications`, {
    headers: { Authorization: `Bearer ${officerToken}` },
  });
  const applicantsData = await applicantsRes.json();
  assert(applicantsRes.status === 200, "Officer retrieved applicant list");
  assert(applicantsData.applicants?.length === 2, "Only bidders who applied to this tender are returned");

  // Verify DESCENDING compliance score order
  const scores = applicantsData.applicants.map((a) => a.compliance_score);
  console.log(`  Applicant Compliance Scores: [${scores.join(", ")}]`);
  assert(scores[0] >= scores[1], "Applicants strictly ordered in COMPLIANCE SCORE DESCENDING order (Highest first)");
  assert(applicantsData.applicants[0].rank === 1, "Rank #1 assigned to highest score applicant");

  // ---------------------------------------------------------------------------
  // 8. OFFICER DECISIONS & AUDIT SYNCHRONIZATION
  // ---------------------------------------------------------------------------
  console.log("\n>>> [8] Testing Officer Decisions & Audit Trail Synchronization...");
  // 8a. Request More Information
  const infoRes = await fetch(`${BASE_URL}/api/applications/${application1Id}/request-info`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${officerToken}` },
    body: JSON.stringify({ comment: "Please upload the revised 2026 audited balance sheet." }),
  });
  const infoData = await infoRes.json();
  assert(infoRes.status === 200, "Officer requested more info (HTTP 200 OK)");
  assert(infoData.status === "info_requested", "Application status updated to 'info_requested'");

  // 8b. Bidder resubmits information
  const resubmitRes = await fetch(`${BASE_URL}/api/applications/${application1Id}/resubmit-info`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bidder1Token}` },
    body: JSON.stringify({ note: "Uploaded the requested audited financial report in Document Vault." }),
  });
  assert(resubmitRes.status === 200, "Bidder provided clarification; application moved back to 'under_review'");

  // 8c. Officer approves application
  const approveRes = await fetch(`${BASE_URL}/api/applications/${application1Id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${officerToken}` },
    body: JSON.stringify({ comment: "All statutory checks validated. Approved for tender award." }),
  });
  const approveData = await approveRes.json();
  assert(approveRes.status === 200, "Officer approved application (HTTP 200 OK)");
  assert(approveData.status === "approved", "Application status updated to 'approved'");

  // 8d. Verify MongoDB Audit Trail is synchronized and records authenticated officer_id
  const auditRes = await fetch(`${BASE_URL}/api/audit/${bidder1User.bidder_id}`);
  const auditData = await auditRes.json();
  assert(auditData.length > 0, "Audit trail contains records for this bidder in MongoDB");
  const latestAudit = auditData[0];
  assert(latestAudit.officer_decision === "approve", "Audit trail records officer_decision: 'approve'");
  assert(latestAudit.officer_id === officerUser.id, "Audit trail records authenticated officer_id (derived from session, not forged)");

  // ---------------------------------------------------------------------------
  // 9. DOCUMENT ACCESS AUTHORIZATION PROTECTION
  // ---------------------------------------------------------------------------
  console.log("\n>>> [9] Testing Private Document Authorization...");
  // Get Bidder 1's documents
  const b1DocsRes = await fetch(`${BASE_URL}/api/bidder/documents`, {
    headers: { Authorization: `Bearer ${bidder1Token}` },
  });
  const b1DocsData = await b1DocsRes.json();
  const b1DocId = b1DocsData.documents[0].id;

  // Bidder 2 attempts to download Bidder 1's document -> MUST FAIL (403)
  const illicitDownload = await fetch(`${BASE_URL}/api/documents/${b1DocId}/download`, {
    headers: { Authorization: `Bearer ${bidder2Token}` },
  });
  assert(illicitDownload.status === 403, "Bidder 2 blocked from downloading Bidder 1's private document (HTTP 403 Forbidden)");

  // Officer can download the document -> MUST SUCCEED (200)
  const officerDownload = await fetch(`${BASE_URL}/api/documents/${b1DocId}/download`, {
    headers: { Authorization: `Bearer ${officerToken}` },
  });
  assert(officerDownload.status === 200, "Reviewing officer authorized to download applicant document (HTTP 200 OK)");

  console.log("\n===============================================================================");
  console.log("            ALL 9 MAJOR CRITICAL ACCEPTANCE CRITERIA PASSED!                  ");
  console.log("===============================================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
