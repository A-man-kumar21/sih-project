import fs from "fs";
import path from "path";
import assert from "assert";

const BASE_URL = "http://127.0.0.1:3001/api";

async function run() {
  console.log("=== Testing Enterprise Profile Document Extraction on GeM PDFs ===");

  const timestamp = Date.now();
  const bidderEmail = `gem_bidder_${timestamp}@test.gov`;
  const officerEmail = `gem_officer_${timestamp}@gem.gov.in`;
  const password = "Password@123";

  // 1. Register Officer
  console.log("1. Registering officer...");
  const offRes = await fetch(`${BASE_URL}/auth/register/officer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: "GeM Procurement Officer",
      email: officerEmail,
      department: "Directorate of Supplies",
      designation: "Director Procurement",
      password,
      confirm_password: password,
    }),
  });
  const offData = await offRes.json();
  assert.strictEqual(offRes.status, 201, `Officer register failed: ${JSON.stringify(offData)}`);
  const offToken = offData.token;

  // 2. Create Tender requiring PAN, GSTIN, Udyam, and EPFO/ESIC
  console.log("2. Creating tender with statutory requirements (pan_it, gstn, udyam, epfo_esic)...");
  const tenderRes = await fetch(`${BASE_URL}/tenders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${offToken}`,
    },
    body: JSON.stringify({
      tender_id: `TND-GEM-EXT-${timestamp}`,
      title: "GeM IT Infrastructure Supply & Services",
      category: "Works",
      description: "Procurement requiring PAN, GSTIN, Udyam MSME, and EPFO/ESIC labor compliance.",
      submission_deadline: "2026-10-31",
      mandatory_checks: ["pan_it", "gstn", "udyam", "epfo_esic"],
    }),
  });
  const tenderData = await tenderRes.json();
  assert.strictEqual(tenderRes.status, 201, `Tender creation failed: ${JSON.stringify(tenderData)}`);
  const tenderId = tenderData.tender.tender_id;

  // 3. Register Bidder
  console.log("3. Registering bidder with empty profile...");
  const bidRes = await fetch(`${BASE_URL}/auth/register/bidder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: bidderEmail,
      password,
      confirm_password: password,
      company_name: "Initial Unextracted Co",
      contact_person: "Vendor Admin",
      phone: "+91 9988776655",
    }),
  });
  const bidData = await bidRes.json();
  assert.strictEqual(bidRes.status, 201, `Bidder register failed: ${JSON.stringify(bidData)}`);
  const bidToken = bidData.token;
  const bidderId = bidData.user.bidder_id;

  // 4. Upload B001 00_Bidder_Profile.pdf to Document Vault
  const b001PdfPath = "C:\\Users\\krama\\Downloads\\GeM_10_Bidders_All_Documents\\GeM_10_Bidders_All_Documents\\B001\\00_Bidder_Profile.pdf";
  console.log(`4. Uploading 00_Bidder_Profile.pdf from ${b001PdfPath}...`);
  const fileBytes = fs.readFileSync(b001PdfPath);

  const formData = new FormData();
  const blob = new Blob([fileBytes], { type: "application/pdf" });
  formData.append("file", blob, "00_Bidder_Profile.pdf");
  formData.append("document_type", "other_statutory");

  const uploadRes = await fetch(`${BASE_URL}/bidder/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bidToken}`,
    },
    body: formData,
  });
  const uploadData = await uploadRes.json();
  assert(uploadRes.ok, `Upload failed: ${JSON.stringify(uploadData)}`);
  console.log("   ✓ Upload & extraction succeeded:", uploadData.message);

  const extFields = uploadData.document?.extracted_data?.fields;
  assert(extFields, "Extracted fields must be present in document response");

  console.log("   Extracted fields check:");
  console.log("   - enterprise_name:", extFields.enterprise_name);
  console.log("   - pan:", extFields.pan);
  console.log("   - gstin:", extFields.gstin);
  console.log("   - udyam:", extFields.udyam);
  console.log("   - cin:", extFields.cin);
  console.log("   - epfo:", extFields.epfo);
  console.log("   - esic:", extFields.esic);
  console.log("   - registration_date:", extFields.registration_date);
  console.log("   - enterprise_type:", extFields.enterprise_type);
  console.log("   - registered_address:", extFields.registered_address);

  assert.strictEqual(extFields.pan, "AABCA1001A", "PAN mismatch");
  assert.strictEqual(extFields.gstin, "19AABCA1001A1Z5", "GSTIN mismatch");
  assert.strictEqual(extFields.udyam, "UDYAM-WB-00-0000001", "Udyam mismatch");
  assert.strictEqual(extFields.cin, "U72900WB2020PTC000001", "CIN mismatch");
  assert.strictEqual(extFields.epfo, "WB/EPF/TEST/000001", "EPFO mismatch");
  assert.strictEqual(extFields.esic, "310000123450001", "ESIC mismatch");
  assert.strictEqual(extFields.registration_date, "15/06/2020", "Registration date mismatch");
  assert.strictEqual(extFields.enterprise_type, "Small", "Enterprise type mismatch");
  assert(extFields.enterprise_name.includes("Asteron Digital Systems"), "Company name mismatch");
  assert(extFields.registered_address.includes("12 Innovation Park"), "Address mismatch");

  // 5. Query Bidder Profile from API
  console.log("5. Fetching Enterprise Profile via GET /api/bidder/profile...");
  const profRes = await fetch(`${BASE_URL}/bidder/profile`, {
    headers: { Authorization: `Bearer ${bidToken}` },
  });
  const profData = await profRes.json();
  assert(profRes.ok, `Fetch profile failed: ${JSON.stringify(profData)}`);

  const ep = profData.profile?.enterprise_profile;
  assert(ep, "Enterprise profile must be returned");

  console.log("   Verifying Enterprise Profile synced values & provenance:");
  const expectedChecks = [
    { key: "enterprise_name", expectedVal: "Asteron Digital Systems Pvt. Ltd.", checkSubstring: true },
    { key: "pan", expectedVal: "AABCA1001A" },
    { key: "gstin", expectedVal: "19AABCA1001A1Z5" },
    { key: "udyam_number", expectedVal: "UDYAM-WB-00-0000001" },
    { key: "cin", expectedVal: "U72900WB2020PTC000001" },
    { key: "epfo_number", expectedVal: "WB/EPF/TEST/000001" },
    { key: "esic_number", expectedVal: "310000123450001" },
    { key: "registration_date", expectedVal: "15/06/2020" },
    { key: "enterprise_type", expectedVal: "Small" },
    { key: "registered_address", expectedVal: "12 Innovation Park", checkSubstring: true },
  ];

  for (const item of expectedChecks) {
    const fieldObj = ep[item.key];
    assert(fieldObj, `Field ${item.key} must exist in enterprise_profile`);
    assert.strictEqual(fieldObj.extraction_status, "successful", `Field ${item.key} status should be successful`);
    assert(fieldObj.value, `Field ${item.key} value must not be empty`);
    if (item.checkSubstring) {
      assert(fieldObj.value.includes(item.expectedVal), `Field ${item.key} value '${fieldObj.value}' does not contain '${item.expectedVal}'`);
    } else {
      assert.strictEqual(fieldObj.value, item.expectedVal, `Field ${item.key} mismatch: expected ${item.expectedVal}, got ${fieldObj.value}`);
    }
    assert(fieldObj.source_doc_name?.includes("00_Bidder_Profile.pdf"), `Source doc name for ${item.key} must be 00_Bidder_Profile.pdf`);
    console.log(`   ✓ ${item.key}: "${fieldObj.value}" (Status: ${fieldObj.extraction_status}, Conf: ${fieldObj.confidence}%)`);
  }

  // 6. Test Bidder Application & Compliance Engine Evaluation
  console.log("6. Submitting bid application to tender...");
  const applyRes = await fetch(`${BASE_URL}/bidder/tenders/${tenderId}/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bidToken}`,
    },
    body: JSON.stringify({
      bid_amount: 5000000,
      proposal_summary: "Complete GeM IT solution meeting all statutory labor and technical standards.",
    }),
  });
  const applyData = await applyRes.json();
  assert(applyRes.ok, `Application failed: ${JSON.stringify(applyData)}`);
  console.log("   ✓ Application submitted. Compliance score:", applyData.application?.compliance_score);
  console.log("   ✓ Risk level:", applyData.application?.risk_level);
  assert(applyData.application?.compliance_score >= 90, `Score ${applyData.application?.compliance_score} should be >= 90`);

  // 7. Verify Officer Cockpit Evaluation Endpoint
  console.log("7. Officer verifying compliance in Evaluation Cockpit...");
  const verifyRes = await fetch(`${BASE_URL}/compliance/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${offToken}`,
    },
    body: JSON.stringify({
      bidder_id: bidderId,
      tender_id: tenderId,
      required_checks: ["pan_it", "gstn", "udyam", "epfo_esic"],
    }),
  });
  const verifyData = await verifyRes.json();
  assert(verifyRes.ok, `Verify failed: ${JSON.stringify(verifyData)}`);
  const assessment = verifyData.assessment || verifyData;
  console.log("   ✓ Cockpit Compliance Score:", assessment.compliance_score);
  console.log("   ✓ Cockpit Risk Level:", assessment.risk_level);
  assert(assessment.compliance_score >= 90, "Cockpit compliance score should be >= 90");
  assert.strictEqual(assessment.risk_level, "Low", "Risk level should be Low");

  // Check that all 4 mandatory checks are compliant
  for (const check of assessment.checks) {
    console.log(`   ✓ Check '${check.check_type}': Status=${check.status}, VerifiedValue=${check.verified_value}`);
    assert.strictEqual(check.status, "compliant", `Check ${check.check_type} must be compliant`);
  }

  // 8. Test B007 00_Bidder_Profile.pdf (Testing Startup mapping and Telangana EPFO/ESIC codes)
  const b007PdfPath = "C:\\Users\\krama\\Downloads\\GeM_10_Bidders_All_Documents\\GeM_10_Bidders_All_Documents\\B007\\00_Bidder_Profile.pdf";
  console.log(`8. Uploading B007 00_Bidder_Profile.pdf (Startup category, Telangana codes)...`);
  const b007Bytes = fs.readFileSync(b007PdfPath);
  const b007FormData = new FormData();
  b007FormData.append("file", new Blob([b007Bytes], { type: "application/pdf" }), "00_Bidder_Profile_B007.pdf");
  b007FormData.append("document_type", "other_statutory");

  const b007UploadRes = await fetch(`${BASE_URL}/bidder/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bidToken}` },
    body: b007FormData,
  });
  const b007UploadData = await b007UploadRes.json();
  assert(b007UploadRes.ok, `B007 upload failed: ${JSON.stringify(b007UploadData)}`);

  const b007Fields = b007UploadData.document?.extracted_data?.fields;
  console.log("   B007 Extracted:");
  console.log("   - EPFO:", b007Fields.epfo);
  console.log("   - ESIC:", b007Fields.esic);
  console.log("   - Registration Date:", b007Fields.registration_date);
  console.log("   - Enterprise Type:", b007Fields.enterprise_type);
  assert.strictEqual(b007Fields.epfo, "TS/EPF/TEST/000007");
  assert.strictEqual(b007Fields.esic, "310000123450007");
  assert.strictEqual(b007Fields.registration_date, "05/01/2022");
  assert.strictEqual(b007Fields.enterprise_type, "Micro"); // Startup mapped to Micro
  console.log("   ✓ B007 all statutory values successfully extracted!");

  console.log("\nALL TESTS PASSED SUCCESSFULLY! 100% Deterministic Extraction Verified.");
}

run().catch((err) => {
  console.error("\nTEST FAILED WITH ERROR:", err);
  process.exit(1);
});
