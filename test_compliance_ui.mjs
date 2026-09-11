import assert from "assert";
import {
  formatFieldLabel,
  formatFieldValue,
  getConfidenceMeta,
  getStatusMeta,
  SOURCE_CONFIG,
} from "./frontend/src/components/compliance/complianceHelpers.js";

console.log("===============================================================================");
console.log("   TESTING COMPLIANCE COCKPIT UI DATA TRANSFORMERS & FORMATTERS");
console.log("===============================================================================\n");

// 1. Label Formatting Test
console.log(">>> [1] Testing Human-Readable Label Formatting...");
assert.strictEqual(formatFieldLabel("udyam_registration_number"), "Udyam Registration Number");
assert.strictEqual(formatFieldLabel("registration_valid_until"), "Registration Valid Until");
assert.strictEqual(formatFieldLabel("enterprise_category"), "Enterprise Category");
assert.strictEqual(formatFieldLabel("business_constitution"), "Business Constitution");
assert.strictEqual(formatFieldLabel("registration_active"), "Registration Status");
assert.strictEqual(formatFieldLabel("latest_return_period"), "Latest Return Period");
assert.strictEqual(formatFieldLabel("latest_return_filed"), "Latest Return Filed");
assert.strictEqual(formatFieldLabel("filing_status"), "Filing Status");
assert.strictEqual(formatFieldLabel("pan_status"), "PAN Status");
assert.strictEqual(formatFieldLabel("name_match"), "Name Match");
assert.strictEqual(formatFieldLabel("epfo_establishment_id"), "EPFO Establishment ID");
assert.strictEqual(formatFieldLabel("epfo_contribution_status"), "EPFO Contribution Status");
assert.strictEqual(formatFieldLabel("esic_employer_code"), "ESIC Employer Code");
assert.strictEqual(formatFieldLabel("esic_contribution_status"), "ESIC Contribution Status");
assert.strictEqual(formatFieldLabel("debarment_status"), "Debarment Status");
assert.strictEqual(formatFieldLabel("custom_registry_property"), "Custom Registry Property");
console.log("  ✓ All labels converted from snake_case to official procurement titles!");

// 2. Value Formatting Tests (Officer-Friendly Language & Boolean mappings)
console.log("\n>>> [2] Testing Officer-Friendly Value Formatting...");
// Registration Active
const regActive = formatFieldValue("registration_active", true);
assert.strictEqual(regActive.text, "✓ Active");
assert.strictEqual(regActive.isBadge, true);
assert.strictEqual(regActive.type, "success");

const regInactive = formatFieldValue("registration_active", false);
assert.strictEqual(regInactive.text, "✕ Inactive");
assert.strictEqual(regInactive.type, "danger");

// Return Filed
const retFiled = formatFieldValue("latest_return_filed", true);
assert.strictEqual(retFiled.text, "✓ Yes");
assert.strictEqual(retFiled.type, "success");

const retNotFiled = formatFieldValue("latest_return_filed", false);
assert.strictEqual(retNotFiled.text, "✕ No");
assert.strictEqual(retNotFiled.type, "danger");

// Name Match
const nameMatched = formatFieldValue("name_match", true);
assert.strictEqual(nameMatched.text, "✓ Matched");
assert.strictEqual(nameMatched.type, "success");

const nameMismatch = formatFieldValue("name_match", false);
assert.strictEqual(nameMismatch.text, "✕ Mismatch");
assert.strictEqual(nameMismatch.type, "danger");

// Contribution Status
const epfoPaid = formatFieldValue("epfo_contribution_status", "Paid");
assert.strictEqual(epfoPaid.text, "✓ Paid");
assert.strictEqual(epfoPaid.type, "success");

// Debarment Status
const debClean = formatFieldValue("debarment_status", "Not listed");
assert.strictEqual(debClean.text, "✓ Clear / None Found");
assert.strictEqual(debClean.type, "success");

const debFound = formatFieldValue("debarment_status", "Debarred");
assert.strictEqual(debFound.text, "✕ Debarred");
assert.strictEqual(debFound.type, "danger");

console.log("  ✓ All booleans and status values mapped to officer-friendly icons and badges!");

// 3. Null / Undefined / Missing Data Handling (Section 18)
console.log("\n>>> [3] Testing Graceful Missing / Null / Undefined Data Handling...");
const nullVal = formatFieldValue("arbitrary_field", null);
assert.strictEqual(nullVal.text, "Not Available");
assert.strictEqual(nullVal.isBadge, false);

const undefVal = formatFieldValue("arbitrary_field", undefined);
assert.strictEqual(undefVal.text, "Not Available");

const emptyVal = formatFieldValue("arbitrary_field", "");
assert.strictEqual(emptyVal.text, "Not Available");

const nanVal = formatFieldValue("arbitrary_field", NaN);
assert.strictEqual(nanVal.text, "Not Available");
console.log("  ✓ Null, undefined, empty string, and NaN safely return 'Not Available'!");

// 4. Confidence Interpretations (Section 6)
console.log("\n>>> [4] Testing Confidence Interpretations...");
const confHigh = getConfidenceMeta(0.98);
assert.strictEqual(confHigh.percent, 98);
assert.strictEqual(confHigh.level, "High Confidence");
assert.strictEqual(confHigh.variant, "high");

const confMed = getConfidenceMeta(0.75);
assert.strictEqual(confMed.percent, 75);
assert.strictEqual(confMed.level, "Medium Confidence");
assert.strictEqual(confMed.variant, "medium");

const confLow = getConfidenceMeta(0.45);
assert.strictEqual(confLow.percent, 45);
assert.strictEqual(confLow.level, "Low Confidence");
assert.strictEqual(confLow.variant, "low");

// Confidence provided as 98 (already percentage)
const confPct = getConfidenceMeta(98);
assert.strictEqual(confPct.percent, 98);
assert.strictEqual(confPct.level, "High Confidence");
console.log("  ✓ Confidence interpretations verified: High (>=90%), Medium (70-89%), Low (<70%)!");

// 5. Status Badge Interpretations (Section 5)
console.log("\n>>> [5] Testing Status Badge Interpretations...");
assert.strictEqual(getStatusMeta("compliant").label, "Compliant");
assert.strictEqual(getStatusMeta("compliant").icon, "✓");

assert.strictEqual(getStatusMeta("non_compliant").label, "Failed");
assert.strictEqual(getStatusMeta("non_compliant").icon, "✕");

assert.strictEqual(getStatusMeta("expired").label, "Expired");
assert.strictEqual(getStatusMeta("expired").icon, "⚠");

assert.strictEqual(getStatusMeta("not_found").label, "Not Found");
assert.strictEqual(getStatusMeta("not_found").icon, "—");

assert.strictEqual(getStatusMeta("pending").label, "Pending");
assert.strictEqual(getStatusMeta("pending").icon, "◷");
console.log("  ✓ All status badge variants verified with icons and labels!");

// 6. Source Config Integrity
console.log("\n>>> [6] Testing Registry Source Configurations...");
const requiredSources = ["udyam", "gstn", "pan_it", "epfo_esic", "digilocker", "blacklist"];
for (const s of requiredSources) {
  assert(SOURCE_CONFIG[s], `Source config exists for ${s}`);
  assert(SOURCE_CONFIG[s].title, `Title exists for ${s}`);
  assert(SOURCE_CONFIG[s].icon, `Icon exists for ${s}`);
  assert(Array.isArray(SOURCE_CONFIG[s].primaryFields), `Primary fields array exists for ${s}`);
}
console.log("  ✓ All 6 statutory sources configured with icons, titles, and primary field sets!");

console.log("\n===============================================================================");
console.log("   ALL COMPLIANCE UI UNIT TESTS PASSED WITH 100% SUCCESS!");
console.log("===============================================================================\n");
