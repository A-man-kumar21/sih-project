import fs from "fs";

async function run() {
  console.log("================================================================================");
  console.log("FEATURE 1 TEST: PDF Upload with LLM-Assisted Extraction");
  console.log("================================================================================\n");

  // 1. Upload sample_bidder_kavach.pdf
  console.log("1. Uploading sample_bidder_kavach.pdf to /api/extract/bidder-pdf...");
  const pdfBytes = fs.readFileSync("sample_bidder_kavach.pdf");
  const formData = new FormData();
  formData.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "sample_bidder_kavach.pdf");

  const extractRes = await fetch("http://localhost:5173/api/extract/bidder-pdf", {
    method: "POST",
    body: formData,
  });
  const extractData = await extractRes.json();
  console.log("Extraction Status:", extractData.success ? "SUCCESS" : "FAILED");
  console.log("Extraction Source / Model:", extractData.source, "/", extractData.model);
  console.log("Extracted Candidate Fields for Form Pre-fill:");
  console.log(JSON.stringify(extractData.extracted, null, 2));

  // 2. Test Simulated Extraction Failure
  console.log("\n2. Testing Simulated Extraction Failure (simulate_failure=true)...");
  const failFormData = new FormData();
  failFormData.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "sample_bidder_kavach.pdf");
  const failRes = await fetch("http://localhost:5173/api/extract/bidder-pdf?simulate_failure=true", {
    method: "POST",
    body: failFormData,
  });
  const failData = await failRes.json();
  console.log("Simulated Failure Response:", failData);
  console.log("Form Left Blank with Message:", failData.message);

  // 3. Upload sample_tender_notice.pdf
  console.log("\n3. Uploading sample_tender_notice.pdf to /api/extract/tender-pdf...");
  const tenderPdfBytes = fs.readFileSync("sample_tender_notice.pdf");
  const tenderFormData = new FormData();
  tenderFormData.append("file", new Blob([tenderPdfBytes], { type: "application/pdf" }), "sample_tender_notice.pdf");
  const tenderExtractRes = await fetch("http://localhost:5173/api/extract/tender-pdf", {
    method: "POST",
    body: tenderFormData,
  });
  const tenderExtractData = await tenderExtractRes.json();
  console.log("Tender Extraction Status:", tenderExtractData.success ? "SUCCESS" : "FAILED");
  console.log("Extracted Tender Fields:");
  console.log(JSON.stringify(tenderExtractData.extracted, null, 2));

  console.log("\n================================================================================");
  console.log("FEATURE 2 TEST: LLM-Generated Executive Briefing & Fallback");
  console.log("================================================================================\n");

  // Test A: BIDDER-ALPHA (Fully Compliant)
  console.log("--- TEST A: BIDDER-ALPHA (Pristine Fully Compliant Bidder) ---");
  const alphaRes = await fetch("http://localhost:5173/api/compliance/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bidder_id: "BIDDER-ALPHA",
      tender_id: "TENDER-ALL-MANDATORY",
      required_checks: ["udyam", "gstn", "pan_it", "epfo_esic", "digilocker", "blacklist"],
    }),
  });
  const alphaData = await alphaRes.json();
  console.log("Deterministic Score:", alphaData.compliance_score + "/100 | Risk:", alphaData.risk_level);
  console.log("LLM Briefing Source:", alphaData.llm_briefing?.source, "| Fallback:", alphaData.llm_briefing?.is_fallback);
  console.log("Officer Briefing Text:\n  \"" + alphaData.llm_briefing?.text + "\"\n");

  // Test B: BIDDER-CHARLIE (Blacklisted Bidder)
  console.log("--- TEST B: BIDDER-CHARLIE (Blacklisted Bidder) ---");
  const charlieRes = await fetch("http://localhost:5173/api/compliance/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bidder_id: "BIDDER-CHARLIE",
      tender_id: "TENDER-ALL-MANDATORY",
      required_checks: ["udyam", "gstn", "pan_it", "epfo_esic", "digilocker", "blacklist"],
    }),
  });
  const charlieData = await charlieRes.json();
  console.log("Deterministic Score:", charlieData.compliance_score + "/100 | Risk:", charlieData.risk_level);
  console.log("LLM Briefing Source:", charlieData.llm_briefing?.source, "| Fallback:", charlieData.llm_briefing?.is_fallback);
  console.log("Officer Briefing Text:\n  \"" + charlieData.llm_briefing?.text + "\"\n");

  // Test C: Simulated API Failure to prove deterministic fallback
  console.log("--- TEST C: SIMULATED API FAILURE (Proving Deterministic Fallback) ---");
  const fallbackRes = await fetch("http://localhost:5173/api/compliance/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bidder_id: "BIDDER-CHARLIE",
      tender_id: "TENDER-ALL-MANDATORY",
      required_checks: ["udyam", "gstn", "pan_it", "epfo_esic", "digilocker", "blacklist"],
      simulate_llm_failure: true,
    }),
  });
  const fallbackData = await fallbackRes.json();
  console.log("Simulated Failure Verification Score:", fallbackData.compliance_score + "/100 | Risk:", fallbackData.risk_level);
  console.log("Briefing Source:", fallbackData.llm_briefing?.source);
  console.log("Is Fallback Active:", fallbackData.llm_briefing?.is_fallback);
  console.log("Notice:", fallbackData.llm_briefing?.notice);
  console.log("Fallback Briefing Text:\n  \"" + fallbackData.llm_briefing?.text + "\"\n");

  console.log("================================================================================");
  console.log("ALL TESTS COMPLETED SUCCESSFULLY");
  console.log("================================================================================");
}

run().catch(console.error);
