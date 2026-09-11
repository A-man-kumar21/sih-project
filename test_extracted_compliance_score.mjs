import assert from "assert";
import fs from "fs";

const BASE_URL = "http://localhost:3001";
const TS = Date.now();

console.log("===============================================================================");
console.log("    TEST CASE: COMPLIANCE SCORE WITH EXTRACTED BIDDER DOCUMENTS");
console.log("===============================================================================");

async function main() {
  // 1. Register Officer
  console.log("\n>>> Step 1: Registering Officer...");
  const offRes = await fetch(`${BASE_URL}/api/auth/register/officer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: "Procurement Evaluator",
      email: `evaluator.${TS}@gem.gov.in`,
      department: "Directorate of Public Procurement",
      designation: "Evaluation Officer",
      password: "password123",
      confirm_password: "password123",
    }),
  });
  const offData = await offRes.json();
  assert.strictEqual(offRes.status, 201, "Officer registered successfully");
  const officerToken = offData.token;
  console.log("  ✓ Officer registered successfully.");

  // Create Tender requiring PAN, GSTIN, and Udyam
  const tenderId = `TENDER-STAT-${TS}`;
  const tenderRes = await fetch(`${BASE_URL}/api/tenders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${officerToken}`,
    },
    body: JSON.stringify({
      tender_id: tenderId,
      title: "Statutory Verification Compliance Tender",
      category: "Goods",
      mandatory_checks: ["pan_it", "gstn", "udyam"],
      description: "Requires PAN, GST, and Udyam compliance verification.",
    }),
  });
  const tenderData = await tenderRes.json();
  assert.strictEqual(tenderRes.status, 201, "Tender created");
  console.log(`  ✓ Tender created: ${tenderId} with mandatory checks: [pan_it, gstn, udyam]`);

  // 2. Register Bidder (ZERO statutory fields provided at registration)
  console.log("\n>>> Step 2: Registering Bidder with NO initial statutory data...");
  const bidRes = await fetch(`${BASE_URL}/api/auth/register/bidder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_name: "Kavach Tech Solutions Private Limited",
      contact_person: "Karan Verma",
      email: `kavach.${TS}@kavachtech.in`,
      phone: "+91 9988776655",
      password: "password123",
      confirm_password: "password123",
    }),
  });
  const bidData = await bidRes.json();
  assert.strictEqual(bidRes.status, 201, "Bidder registered successfully");
  const bidderToken = bidData.token;
  const bidderId = bidData.user.bidder_id;
  console.log(`  ✓ Bidder registered: ${bidderId} (${bidData.user.company_name})`);

  // 3. Bidder uploads PAN, GST, and Udyam documents to Document Vault
  console.log("\n>>> Step 3: Uploading statutory documents to Document Vault...");
  const docsToUpload = [
    { file: "PAN_Document.pdf", type: "pan_card", label: "PAN Document" },
    { file: "GST_Certificate.pdf", type: "gstin_cert", label: "GST Certificate" },
    { file: "Udyam.pdf", type: "udyam_cert", label: "Udyam Certificate" },
  ];

  for (const item of docsToUpload) {
    const fileBytes = fs.readFileSync(item.file);
    const fd = new FormData();
    fd.append("file", new Blob([fileBytes], { type: "application/pdf" }), item.file);
    fd.append("document_type", item.type);

    const upRes = await fetch(`${BASE_URL}/api/bidder/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bidderToken}` },
      body: fd,
    });
    const upData = await upRes.json();
    assert.strictEqual(upRes.status, 201, `Uploaded ${item.file}`);
    assert(upData.message.includes("successfully uploaded, extracted, and synced"), "Shows Extracted & Synced");
    console.log(`  ✓ ${item.label} (${item.file}) uploaded and marked 'Extracted & Synced'`);
  }

  // 4. Confirm Enterprise Profile contains extracted PAN, GSTIN, and Udyam
  console.log("\n>>> Step 4: Verifying Enterprise Profile synchronization...");
  const profRes = await fetch(`${BASE_URL}/api/bidder/profile`, {
    headers: { Authorization: `Bearer ${bidderToken}` },
  });
  const profData = await profRes.json();
  assert.strictEqual(profRes.status, 200, "Profile retrieved");

  const ep = profData.profile?.enterprise_profile || profData.enterprise_profile;
  const panVal = ep?.pan?.value || profData.profile?.statutory?.pan;
  const gstinVal = ep?.gstin?.value || profData.profile?.statutory?.gstin;
  const udyamVal = ep?.udyam_number?.value || ep?.udyam?.value || profData.profile?.statutory?.udyam_number;

  console.log("  Enterprise Profile Extracted Values:", {
    PAN: panVal,
    GSTIN: gstinVal,
    Udyam: udyamVal,
  });

  assert.strictEqual(panVal, "AAACK1234D", "PAN matches extracted document");
  assert.strictEqual(gstinVal, "27AAACK1234D1Z8", "GSTIN matches extracted document");
  assert.strictEqual(udyamVal, "UDYAM-MH-12-0054321", "Udyam matches extracted document");
  console.log("  ✓ Enterprise Profile correctly populated with extracted statutory fields!");

  // 5. Bidder applies for the tender
  console.log("\n>>> Step 5: Bidder applies for tender requiring PAN, GST, and Udyam...");
  const applyRes = await fetch(`${BASE_URL}/api/tenders/${tenderId}/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bidderToken}`,
    },
    body: JSON.stringify({ tender_id: tenderId }),
  });
  const applyData = await applyRes.json();
  assert.strictEqual(applyRes.status, 201, "Application submitted successfully");

  console.log("\nApplication Submission Response Assessment:");
  console.log("  Compliance Score:", applyData.application.compliance_score);
  console.log("  Risk Level:", applyData.application.risk_level);
  console.log("  Checks:", applyData.application.checks.map(c => ({
    source: c.source,
    status: c.status,
    verified_value: c.verified_value,
    extraction_source: c.extraction_source,
  })));

  // Assert compliance score is NOT 0!
  assert(applyData.application.compliance_score >= 90, `Compliance score must be >= 90, received: ${applyData.application.compliance_score}`);
  assert.strictEqual(applyData.application.risk_level, "Low", "Risk level should be Low");

  // Check individual checks
  const checksMap = new Map(applyData.application.checks.map(c => [c.source, c]));
  assert.strictEqual(checksMap.get("pan_it")?.status, "compliant", "PAN/IT check must be compliant");
  assert.strictEqual(checksMap.get("gstn")?.status, "compliant", "GSTN check must be compliant");
  assert.strictEqual(checksMap.get("udyam")?.status, "compliant", "Udyam check must be compliant");
  console.log("  ✓ Application submitted with verified compliance score >= 90 (NOT 0!)");

  // 6. Officer opens the application in AI Evaluation Cockpit
  console.log("\n>>> Step 6: Officer opens application in AI Evaluation Cockpit...");

  // 6a. Overview list
  const overRes = await fetch(`${BASE_URL}/api/overview?tender_id=${tenderId}`, {
    headers: { Authorization: `Bearer ${officerToken}` },
  });
  const overData = await overRes.json();
  assert.strictEqual(overRes.status, 200, "Overview loaded");
  assert.strictEqual(overData.bidders.length, 1, "One applicant found");
  const appInOverview = overData.bidders[0];
  console.log("  Overview applicant card:", {
    bidder_id: appInOverview.bidder_id,
    compliance_score: appInOverview.compliance_score,
    risk_level: appInOverview.risk_level,
    checks_summary: appInOverview.checks_summary,
  });
  assert(appInOverview.compliance_score >= 90, "Overview compliance score must be >= 90");
  assert.strictEqual(appInOverview.risk_level, "Low", "Overview risk level is Low");

  // 6b. Verification Detail view
  const verifyRes = await fetch(`${BASE_URL}/api/compliance/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${officerToken}`,
    },
    body: JSON.stringify({
      bidder_id: bidderId,
      tender_id: tenderId,
      required_checks: ["pan_it", "gstn", "udyam"],
    }),
  });
  const verifyData = await verifyRes.json();
  assert.strictEqual(verifyRes.status, 200, "Compliance verify succeeded");

  console.log("\nCockpit Detail Verification:");
  console.log("  Compliance Score:", verifyData.compliance_score);
  console.log("  Risk Level:", verifyData.risk_level);
  console.log("  Pending Manual Review:", verifyData.pending_manual_review);

  for (const chk of verifyData.checks) {
    if (["pan_it", "gstn", "udyam"].includes(chk.source)) {
      console.log(`  - [${chk.source}] Status: ${chk.status} | Value: ${chk.verified_value} | Source: ${chk.extraction_source}`);
      assert.strictEqual(chk.status, "compliant", `${chk.source} must be compliant`);
      assert(chk.verified_value, `${chk.source} must have verified_value`);
      assert(chk.extraction_source, `${chk.source} must display extraction source badge`);
    }
  }

  assert.strictEqual(verifyData.pending_manual_review.length, 0, "No mandatory checks should be in pending_manual_review");
  assert(verifyData.compliance_score >= 90, "Cockpit compliance score is >= 90");

  console.log("\n===============================================================================");
  console.log("     ALL CHECKS PASSED: COMPLIANCE SCORE IS ACCURATELY EVALUATED (>= 90)!");
  console.log("===============================================================================");
}

main().catch(err => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});
