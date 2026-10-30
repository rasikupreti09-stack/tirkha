import test from "node:test";
import assert from "node:assert/strict";
import { HOME_ISSUES, detectHomeSafetyRisk, diagnosticBookingPrefillSchema, diagnosticDraftSchema, diagnosticLanguageForText, matchHomeIssue, normalizeHomeDiagnosticText } from "../src/home-diagnostics.ts";
import { romanizeNepaliText } from "../src/universal-diagnostics.ts";

 test("home symptom triage recognizes common plumbing and electrical issues without claiming root cause", () => {
  const cases = [
    ["My tap under sink is leaking", "tap-leak"], ["slow clogged kitchen drain", "blocked-drain"],
    ["air in water line and tap sputtering", "air-in-line"], ["muddy iron water from supply", "muddy-water"],
    ["well pump makes noise and no water", "pump"], ["solar water heater not heating", "solar-water-heater"], ["intermittent water supply", "intermittent-supply"], ["water pipes banging", "pipe-noise"],
    ["batti na-aako in one room", "no-power"], ["breaker keeps tripping", "breaker-trip"],
    ["voltage is low and flickering lights", "voltage"], ["inverter battery backup not working", "inverter"],
  ];
  for (const [description, expected] of cases) assert.equal(matchHomeIssue(description)?.id, expected, description);
  assert.equal(HOME_ISSUES.length, 30);
  assert.equal(normalizeHomeDiagnosticText("intermittent gas smell plumbingg"), "intermittent gas smell plumbing");
  assert.equal(diagnosticLanguageForText("saas ferna garo"), "nepali_romanized");
  assert.equal(matchHomeIssue("muddy iron water from supply")?.serviceId, null);
  assert.equal(matchHomeIssue("well pump makes noise and no water")?.serviceId, null);
 });

test("Romanized Nepali UI uses short, readable everyday spellings", () => {
  assert.equal(romanizeNepaliText("घरायसी सेवा प्रारम्भिक जाँच"), "gharayasi sewa prarambha jaach");
  assert.equal(romanizeNepaliText("सुरक्षा · प्रमाण · जाँच बुकिङ"), "suraksha · pramaan · jaach booking");
  assert.equal(romanizeNepaliText("तपाईंको जाँच फेरि सुरु भयो। तपाईंले देख्नुभएको बिजुलीको लक्षण कुनसँग बढी मिल्छ?"), "tapaiko jaach pheri suru bhayo। tapai le dekhnu bhayeko bijuli ko lakshan kun sanga badhi milchha?");
});

test("hazard cues escalate instead of suggesting DIY repair", () => {
  assert.equal(detectHomeSafetyRisk("sparking and burning smell near outlet"), "electric");
  assert.equal(detectHomeSafetyRisk("water flooded near live switch"), "water-electric");
  assert.equal(detectHomeSafetyRisk("gas smell in kitchen"), "gas");
  assert.equal(detectHomeSafetyRisk("slow drain"), null);
});

test("diagnostic booking details validate bounded, non-image records", () => {
  const parsed = diagnosticDraftSchema.parse({ symptom: "Tap leaking under sink", issue_title: "Tap leak", explanation: "A plumbing inspection is suggested.", confidence: "low", urgency: "routine", photo_assessed: true });
  assert.equal(parsed.photo_assessed, true);
  const prefill = diagnosticBookingPrefillSchema.parse({ category_slug: "plumbing", duration_minutes: 45, diagnostic: parsed });
  assert.equal(prefill.category_slug, "plumbing");
  assert.throws(() => diagnosticDraftSchema.parse({ symptom: "", issue_title: "x", explanation: "x" }));
});





