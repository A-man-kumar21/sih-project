import assert from "node:assert";
import fs from "node:fs";

const GATEWAY = "http://localhost:3001";
const ts = Date.now();

console.log("================================================================================");
console.log("     TENDERFLOW: OFFICER-SPECIFIC TENDER VISIBILITY & ISOLATION TEST SUITE");
console.log("================================================================================\n");

async function registerOfficer(name, email, password) {
  const res = await fetch(`${GATEWAY}/api/auth/register/officer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: name,
      email,
      password,
      confirm_password: password,
      officer_id: `OFFICER-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      designation: "Executive Procurement Director",
      department: "Ministry of Electronics & IT",
    }),
  });
  const data = await res.json();
  assert(res.ok, `Officer registration failed: ${JSON.stringify(data)}`);
  return data;
}

async function createTender(token, tender) {
  const res = await fetch(`${GATEWAY}/api/officer/tenders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(tender),
  });
  const data = await res.json();
  assert(res.status === 201, `Tender creation failed: ${JSON.stringify(data)}`);
  return data.tender;
}

async function runTests() {
  // TEST 1: Create Officer A
  console.log("TEST 1: Creating Officer A...");
  const officerA = await registerOfficer("Officer Alpha", `officer.a.${ts}@gov.in`, "Pass@12345");
  const tokenA = officerA.token;
  assert(tokenA, "Officer A token received");
  console.log("✓ Officer A registered successfully:", officerA.user.id);

  // TEST 2: Create Officer B
  console.log("\nTEST 2: Creating Officer B...");
  const officerB = await registerOfficer("Officer Bravo", `officer.b.${ts}@gov.in`, "Pass@12345");
  const tokenB = officerB.token;
  assert(tokenB, "Officer B token received");
  console.log("✓ Officer B registered successfully:", officerB.user.id);

  // TEST 3: Officer A creates Tender A1
  console.log("\nTEST 3: Officer A creates Tender A1...");
  const tenderA1Id = `TENDER-A1-${ts}`;
  const tenderA1 = await createTender(tokenA, {
    tender_id: tenderA1Id,
    title: "Officer A High-Performance Computing Cluster",
    category: "IT & Telecom",
    description: "Procurement of specialized supercomputing GPU cluster nodes",
    mandatory_checks: ["pan_it", "gstn", "udyam"],
  });
  assert.strictEqual(tenderA1.created_by, officerA.user.id, "Tender A1 created_by matches Officer A");
  console.log("✓ Tender A1 created by Officer A:", tenderA1Id);

  // TEST 4: Officer B creates Tender B1
  console.log("\nTEST 4: Officer B creates Tender B1...");
  const tenderB1Id = `TENDER-B1-${ts}`;
  const tenderB1 = await createTender(tokenB, {
    tender_id: tenderB1Id,
    title: "Officer B Drone Surveillance Equipment",
    category: "Goods",
    description: "Procurement of aerial UAV surveillance equipment for border defense",
    mandatory_checks: ["pan_it", "gstn", "blacklist"],
  });
  assert.strictEqual(tenderB1.created_by, officerB.user.id, "Tender B1 created_by matches Officer B");
  console.log("✓ Tender B1 created by Officer B:", tenderB1Id);

  // TEST 5: Login / Verify as Officer A
  console.log("\nTEST 5: Verify Officer A visibility & isolation...");
  // 5A: Officer A Overview metrics
  const overviewResA = await fetch(`${GATEWAY}/api/officer/overview`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const overviewDataA = await overviewResA.json();
  assert(overviewResA.ok, "Officer A overview request succeeded");
  assert.strictEqual(overviewDataA.metrics.total_tenders, 1, "Officer A metrics total_tenders must be 1");
  assert.strictEqual(overviewDataA.metrics.active_tenders, 1, "Officer A metrics active_tenders must be 1");
  console.log("✓ Officer A overview metrics show exactly 1 tender");

  // 5B: Officer A Tenders List
  const tendersResA = await fetch(`${GATEWAY}/api/officer/tenders`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const tendersDataA = await tendersResA.json();
  assert(tendersResA.ok, "Officer A tenders list request succeeded");
  assert.strictEqual(tendersDataA.tenders.length, 1, "Officer A must only see 1 tender in list");
  assert.strictEqual(tendersDataA.tenders[0].tender_id, tenderA1Id, "Officer A tender list has Tender A1");
  console.log("✓ Officer A My Tenders contains ONLY Tender A1");

  // 5C: Officer A AI Evaluation Cockpit data
  const cockpitResA = await fetch(`${GATEWAY}/api/overview?tender_id=${tenderA1Id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const cockpitDataA = await cockpitResA.json();
  assert(cockpitResA.ok, "Officer A can access cockpit for Tender A1");
  assert.strictEqual(cockpitDataA.tender_id, tenderA1Id, "Cockpit returns Tender A1");
  console.log("✓ AI Evaluation Cockpit loads Tender A1 for Officer A");

  // 5D: Direct URL/API Access by Officer A to Officer B's tender must return 403 Forbidden
  const forbiddenResA1 = await fetch(`${GATEWAY}/api/officer/tenders/${tenderB1Id}/applications`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(forbiddenResA1.status, 403, `Direct access to Tender B1 applicants by Officer A must return 403 (got ${forbiddenResA1.status})`);
  console.log("✓ Officer A directly accessing Tender B1 applicants is blocked with 403 Forbidden");

  const forbiddenResA2 = await fetch(`${GATEWAY}/api/tenders/${tenderB1Id}/applications`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(forbiddenResA2.status, 403, `Direct access via /api/tenders/:id/applications must return 403 (got ${forbiddenResA2.status})`);
  console.log("✓ Officer A accessing /api/tenders/TenderB1/applications is blocked with 403 Forbidden");

  const forbiddenResA3 = await fetch(`${GATEWAY}/api/overview?tender_id=${tenderB1Id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(forbiddenResA3.status, 403, `Cockpit overview for Tender B1 by Officer A must return 403 (got ${forbiddenResA3.status})`);
  console.log("✓ Officer A accessing Cockpit overview for Tender B1 is blocked with 403 Forbidden");

  const forbiddenDeleteA = await fetch(`${GATEWAY}/api/tenders/${tenderB1Id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(forbiddenDeleteA.status, 403, `Officer A deleting Tender B1 must return 403 (got ${forbiddenDeleteA.status})`);
  console.log("✓ Officer A attempting to delete Tender B1 is blocked with 403 Forbidden");

  // TEST 6: Login / Verify as Officer B
  console.log("\nTEST 6: Verify Officer B visibility & isolation...");
  // 6A: Officer B Overview metrics
  const overviewResB = await fetch(`${GATEWAY}/api/officer/overview`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const overviewDataB = await overviewResB.json();
  assert(overviewResB.ok, "Officer B overview request succeeded");
  assert.strictEqual(overviewDataB.metrics.total_tenders, 1, "Officer B metrics total_tenders must be 1");
  assert.strictEqual(overviewDataB.metrics.active_tenders, 1, "Officer B metrics active_tenders must be 1");
  console.log("✓ Officer B overview metrics show exactly 1 tender");

  // 6B: Officer B Tenders List
  const tendersResB = await fetch(`${GATEWAY}/api/officer/tenders`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const tendersDataB = await tendersResB.json();
  assert(tendersResB.ok, "Officer B tenders list request succeeded");
  assert.strictEqual(tendersDataB.tenders.length, 1, "Officer B must only see 1 tender in list");
  assert.strictEqual(tendersDataB.tenders[0].tender_id, tenderB1Id, "Officer B tender list has Tender B1");
  console.log("✓ Officer B My Tenders contains ONLY Tender B1");

  // 6C: Direct URL/API Access by Officer B to Officer A's tender must return 403 Forbidden
  const forbiddenResB1 = await fetch(`${GATEWAY}/api/officer/tenders/${tenderA1Id}/applications`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(forbiddenResB1.status, 403, `Direct access to Tender A1 applicants by Officer B must return 403 (got ${forbiddenResB1.status})`);
  console.log("✓ Officer B directly accessing Tender A1 applicants is blocked with 403 Forbidden");

  const forbiddenResB2 = await fetch(`${GATEWAY}/api/overview?tender_id=${tenderA1Id}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(forbiddenResB2.status, 403, `Cockpit overview for Tender A1 by Officer B must return 403 (got ${forbiddenResB2.status})`);
  console.log("✓ Officer B accessing Cockpit overview for Tender A1 is blocked with 403 Forbidden");

  // TEST 7: Create a brand-new Officer C
  console.log("\nTEST 7: Create brand-new Officer C and verify 0 state...");
  const officerC = await registerOfficer("Officer Charlie", `officer.c.${ts}@gov.in`, "Pass@12345");
  const tokenC = officerC.token;
  assert(tokenC, "Officer C token received");

  // 7A: Verify all metrics are 0
  const overviewResC = await fetch(`${GATEWAY}/api/officer/overview`, {
    headers: { Authorization: `Bearer ${tokenC}` },
  });
  const overviewDataC = await overviewResC.json();
  assert(overviewResC.ok, "Officer C overview request succeeded");
  assert.strictEqual(overviewDataC.metrics.total_tenders, 0, "Active Tenders must be 0");
  assert.strictEqual(overviewDataC.metrics.total_applications, 0, "Total Applications must be 0");
  assert.strictEqual(overviewDataC.metrics.under_review, 0, "Under Review must be 0");
  assert.strictEqual(overviewDataC.metrics.approved, 0, "Approved must be 0");
  assert.strictEqual(overviewDataC.metrics.rejected, 0, "Rejected must be 0");
  assert.strictEqual(overviewDataC.metrics.info_requested, 0, "Info Requested must be 0");
  console.log("✓ Brand-new Officer C metrics are cleanly all 0: Active Tenders=0, Applications=0, Review=0, Apprv=0, Rej=0, Info=0");

  // 7B: Verify empty tenders list
  const tendersResC = await fetch(`${GATEWAY}/api/officer/tenders`, {
    headers: { Authorization: `Bearer ${tokenC}` },
  });
  const tendersDataC = await tendersResC.json();
  assert.strictEqual(tendersDataC.tenders.length, 0, "Officer C must have 0 tenders");
  console.log("✓ Officer C My Tenders is empty (0 tenders)");

  // 7C: Verify empty cockpit overview
  const cockpitResC = await fetch(`${GATEWAY}/api/overview`, {
    headers: { Authorization: `Bearer ${tokenC}` },
  });
  const cockpitDataC = await cockpitResC.json();
  assert.strictEqual(cockpitDataC.bidders.length, 0, "Officer C cockpit has 0 bidders");
  assert.strictEqual(cockpitDataC.tender_id, null, "Officer C cockpit has null tender_id");
  console.log("✓ Officer C AI Evaluation Cockpit default overview is cleanly empty");

  // 7D: Verify Officer C cannot access Officer A or Officer B tenders
  const forbiddenC1 = await fetch(`${GATEWAY}/api/officer/tenders/${tenderA1Id}/applications`, {
    headers: { Authorization: `Bearer ${tokenC}` },
  });
  assert.strictEqual(forbiddenC1.status, 403, "Officer C blocked from Tender A1");

  const forbiddenC2 = await fetch(`${GATEWAY}/api/officer/tenders/${tenderB1Id}/applications`, {
    headers: { Authorization: `Bearer ${tokenC}` },
  });
  assert.strictEqual(forbiddenC2.status, 403, "Officer C blocked from Tender B1");
  console.log("✓ Officer C has zero visibility into Officer A and Officer B tenders (403 Forbidden)");

  // TEST 8: Officer C creates a tender
  console.log("\nTEST 8: Officer C creates Tender C1...");
  const tenderC1Id = `TENDER-C1-${ts}`;
  const tenderC1 = await createTender(tokenC, {
    tender_id: tenderC1Id,
    title: "Officer C Clean Energy Solar Grid",
    category: "Works",
    description: "Installation and verification of solar PV grid infrastructure",
    mandatory_checks: ["pan_it", "gstn"],
  });
  assert.strictEqual(tenderC1.created_by, officerC.user.id, "Tender C1 created_by matches Officer C");

  // Verify ONLY Officer C now sees that tender
  const tendersResC_after = await fetch(`${GATEWAY}/api/officer/tenders`, {
    headers: { Authorization: `Bearer ${tokenC}` },
  });
  const tendersDataC_after = await tendersResC_after.json();
  assert.strictEqual(tendersDataC_after.tenders.length, 1, "Officer C now sees exactly 1 tender");
  assert.strictEqual(tendersDataC_after.tenders[0].tender_id, tenderC1Id, "Officer C sees Tender C1");

  const tendersResA_after = await fetch(`${GATEWAY}/api/officer/tenders`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const tendersDataA_after = await tendersResA_after.json();
  assert(!tendersDataA_after.tenders.some((t) => t.tender_id === tenderC1Id), "Officer A DOES NOT see Tender C1");

  const tendersResB_after = await fetch(`${GATEWAY}/api/officer/tenders`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const tendersDataB_after = await tendersResB_after.json();
  assert(!tendersDataB_after.tenders.some((t) => t.tender_id === tenderC1Id), "Officer B DOES NOT see Tender C1");
  console.log("✓ ONLY Officer C sees Tender C1. Neither Officer A nor Officer B can see it.");

  // Cross access checks on Tender C1
  const forbiddenA_C1 = await fetch(`${GATEWAY}/api/officer/tenders/${tenderC1Id}/applications`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(forbiddenA_C1.status, 403, "Officer A blocked from Tender C1");

  const forbiddenB_C1 = await fetch(`${GATEWAY}/api/officer/tenders/${tenderC1Id}/applications`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(forbiddenB_C1.status, 403, "Officer B blocked from Tender C1");
  // TEST 9: Application Submission & Decision Access Control Isolation
  console.log("\nTEST 9: Testing Bidder Application & Officer Decision Authorization Isolation...");
  // Register bidder
  const bidderRegRes = await fetch(`${GATEWAY}/api/auth/register/bidder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: "Test Bidder Lead",
      email: `bidder.iso.${ts}@enterprise.com`,
      password: "Pass@12345",
      confirm_password: "Pass@12345",
      company_name: "Apex HyperScale Technologies Pvt Ltd",
      contact_person: "Test Bidder Lead",
      phone: "9876543210",
    }),
  });
  const bidderData = await bidderRegRes.json();
  assert(bidderRegRes.ok, "Bidder registered");
  const bidderToken = bidderData.token;

  // Upload mandatory documents to Document Vault
  const udyamPdfBuf = fs.readFileSync("test_assets/udyam_text.pdf");
  const upForm1 = new FormData();
  upForm1.append("file", new Blob([udyamPdfBuf], { type: "application/pdf" }), "udyam_cert.pdf");
  upForm1.append("document_type", "udyam_cert");
  await fetch(`${GATEWAY}/api/bidder/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidderToken}` },
    body: upForm1,
  });

  const gstJpgBuf = fs.readFileSync("test_assets/gst_cert.jpg");
  const upForm2 = new FormData();
  upForm2.append("file", new Blob([gstJpgBuf], { type: "image/jpeg" }), "gst_cert.jpg");
  upForm2.append("document_type", "gstin_cert");
  await fetch(`${GATEWAY}/api/bidder/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidderToken}` },
    body: upForm2,
  });

  const panPngBuf = fs.readFileSync("test_assets/pan_card.png");
  const upForm3 = new FormData();
  upForm3.append("file", new Blob([panPngBuf], { type: "image/png" }), "pan_card.png");
  upForm3.append("document_type", "pan_card");
  await fetch(`${GATEWAY}/api/bidder/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidderToken}` },
    body: upForm3,
  });

  // Apply to Tender A1
  const applyRes = await fetch(`${GATEWAY}/api/tenders/${tenderA1Id}/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bidderToken}`,
    },
    body: JSON.stringify({
      submitted_documents: [],
      declarations: {
        debarment_clearance: true,
        accurate_information: true,
        terms_acceptance: true,
      },
    }),
  });
  const applyData = await applyRes.json();
  assert(applyRes.ok, `Bid application failed: ${JSON.stringify(applyData)}`);
  const appId = applyData.application.id;
  console.log("✓ Bidder applied to Tender A1 successfully, Application ID:", appId);

  // Check Officer A Overview stats
  const ovA_afterApp = await (await fetch(`${GATEWAY}/api/officer/overview`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  })).json();
  assert.strictEqual(ovA_afterApp.metrics.total_applications, 1, "Officer A total_applications is 1");
  assert.strictEqual(ovA_afterApp.metrics.under_review, 1, "Officer A under_review is 1");
  console.log("✓ Officer A overview updated: total_applications=1, under_review=1");

  // Check Officer B Overview stats (must remain 0!)
  const ovB_afterApp = await (await fetch(`${GATEWAY}/api/officer/overview`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  })).json();
  assert.strictEqual(ovB_afterApp.metrics.total_applications, 0, "Officer B total_applications MUST remain 0");
  assert.strictEqual(ovB_afterApp.metrics.under_review, 0, "Officer B under_review MUST remain 0");
  console.log("✓ Officer B overview remains 0 (no leakage of Officer A's application stats)");

  // Cross-officer application view check (Officer B attempting to view Officer A's applicant application)
  const forbiddenAppView = await fetch(`${GATEWAY}/api/applications/${appId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(forbiddenAppView.status, 403, "Officer B blocked from viewing Officer A's application");
  console.log("✓ Officer B viewing Officer A's application detail blocked with 403 Forbidden");

  // Cross-officer decisions checks (Officer B attempting to approve/reject/request-info)
  const forbiddenApprove = await fetch(`${GATEWAY}/api/applications/${appId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ comment: "Fraudulent approval attempt" }),
  });
  assert.strictEqual(forbiddenApprove.status, 403, "Officer B approve attempt blocked with 403");

  const forbiddenReject = await fetch(`${GATEWAY}/api/applications/${appId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ comment: "Fraudulent reject attempt" }),
  });
  assert.strictEqual(forbiddenReject.status, 403, "Officer B reject attempt blocked with 403");

  const forbiddenReqInfo = await fetch(`${GATEWAY}/api/applications/${appId}/request-info`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ comment: "Fraudulent info request attempt" }),
  });
  assert.strictEqual(forbiddenReqInfo.status, 403, "Officer B request-info attempt blocked with 403");
  console.log("✓ Officer B attempts to approve/reject/request-info all blocked with 403 Forbidden");

  // Legitimate Officer A approves the application
  const approveResA = await fetch(`${GATEWAY}/api/applications/${appId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ comment: "Verified and approved by Officer A" }),
  });
  assert.strictEqual(approveResA.status, 200, "Officer A legitimate approval succeeds");
  console.log("✓ Officer A legitimately approves the application");

  // Verify Officer A stats updated to approved=1, under_review=0
  const ovA_afterApprove = await (await fetch(`${GATEWAY}/api/officer/overview`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  })).json();
  assert.strictEqual(ovA_afterApprove.metrics.approved, 1, "Officer A approved count is 1");
  assert.strictEqual(ovA_afterApprove.metrics.under_review, 0, "Officer A under_review count is 0");
  console.log("✓ Officer A overview updated: approved=1, under_review=0");

  console.log("\n================================================================================");
  console.log("     ALL 9 OFFICER ISOLATION & VISIBILITY TESTS PASSED WITH 100% SUCCESS!");
  console.log("================================================================================\n");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
