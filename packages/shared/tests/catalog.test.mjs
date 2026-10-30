import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import seed from "../src/service-catalog.json" with { type: "json" };
import { assistantReply, catalogServiceMatchesQuery, catalogServiceSchema, codCommissionPaisa, getServiceQuickRecommendations, matchServices, normalizeServiceSearchQuery, serviceTotal } from "../src/catalog.ts";
import { buildDemoPaymentQrUrl } from "../src/payments.ts";

test("seeded marketplace catalog has complete scopes, usable images and integer NPR estimates", () => {
  const parsed=catalogServiceSchema.array().parse(seed);
  assert.equal(parsed.length,23);
  assert.equal(new Set(parsed.map(service=>service.id)).size,23);
  for(const service of parsed){
    assert.ok(service.included.length>0&&service.excluded.length>0);
    assert.ok(Number.isSafeInteger(serviceTotal(service)));
    assert.ok(readFileSync(new URL("../../../apps/web/public/"+service.image.slice(1),import.meta.url)).length>1000);
  }
  assert.ok(parsed.some(service=>service.category_slug==="astrology"));
  assert.ok(parsed.some(service=>service.category_slug==="home-tutoring"));
  assert.ok(parsed.some(service=>service.category_slug==="home-decorators"));
});

test("assistant matches plumbing leaks, explains platform coverage and declines emergency diagnosis", () => {
  assert.deepEqual(matchServices("My tap under the sink is leaking water everywhere",seed).map(service=>service.id),["sink-leak"]);
  const leak=assistantReply("My tap under the sink is leaking water everywhere",seed);
  assert.deepEqual(leak.services.map(service=>service.id),["sink-leak"]);
  const coverage=assistantReply("Where does Tirkha operate?",seed);
  assert.match(coverage.text,/Kathmandu, Lalitpur, Bhaktapur and Pokhara/);
  const emergency=assistantReply("I have chest pain and cannot breathe",seed);
  assert.match(emergency.text,/not an emergency service/);
  assert.deepEqual(emergency.services,[]);
});

test("Romanized Nepali service phrases map to catalog entries and mirror the reply language", () => {
  const cases = [
    ["dhara leek bhairako chha", "sink-leak"],
    ["fohor tank cleaning", "tank-clean"],
    ["jyotish consultation", "astrology-session"],
    ["doctor home visit", "doctor-home"],
    ["batti na-aako", "electrical-wiring"],
  ];
  for (const [query, id] of cases) {
    const answer = assistantReply(query, seed);
    assert.deepEqual(answer.services.map(service => service.id), [id], query);
    if (query.startsWith("doctor ")) assert.match(answer.text, /These services match/);
    else assert.match(answer.text, /tapai|tapai le/i, query);
  }
  assert.match(assistantReply("My kitchen tap is leaking", seed).text, /These services match/);
});

test("messy Romanized Nepali faults normalize and stay searchable", () => {
  for (const spelling of ["kharabeee", "kharbi", "kharabi"]) {
    const matches = matchServices(`tap ko ${spelling}`, seed).map(service => service.id);
    assert.ok(matches.includes("sink-leak"), `${spelling} should find tap repair`);
    assert.ok(catalogServiceMatchesQuery(seed.find(service => service.id === "sink-leak"), `tap ko ${spelling}`));
  }
  assert.match(normalizeServiceSearchQuery("paani leakage"), /water/);
});

test("healthcare and event keywords produce relevant quick service recommendations", () => {
  assert.deepEqual(getServiceQuickRecommendations("doctor home visit", seed).map(service => service.id), ["doctor-home"]);
  assert.deepEqual(getServiceQuickRecommendations("nurse for elderly care", seed).map(service => service.id), ["home-nurse"]);
  assert.deepEqual(getServiceQuickRecommendations("health service", seed).map(service => service.id), ["doctor-home", "home-nurse", "physiotherapy"]);
  assert.deepEqual(getServiceQuickRecommendations("bihe party decorations", seed).map(service => service.id), ["home-decorator"]);
});

test("assistant gives measured follow-up guidance and escalates household hazards", () => {
  const followUp = assistantReply("Can you help me find a nearby service?", seed);
  assert.match(followUp.text, /neighborhood or landmark/);
  assert.match(followUp.text, /availability is checked/);
  const hazard = assistantReply("I smell gas in my kitchen", seed);
  assert.match(hazard.text, /avoid flames and electrical switches/);
  assert.deepEqual(hazard.services, []);
  const safety = assistantReply("How do I know the provider is verified?", seed);
  assert.match(safety.text, /matches the provider details/);
});

test("COD commission helper rounds integer paisa and restricts platform rates to 10–15%", () => {
  assert.equal(codCommissionPaisa(18827), 2353);
  assert.equal(codCommissionPaisa(10000, 1000), 1000);
  assert.equal(codCommissionPaisa(10000, 1500), 1500);
  assert.throws(() => codCommissionPaisa(-1), /non-negative/);
  assert.throws(() => codCommissionPaisa(10000, 900), /10% and 15%/);
});

test("test payment QR encodes only the gateway, reference, and integer paisa amount", () => {
  const url = new URL(buildDemoPaymentQrUrl("FONEPAY", "TIR-TEST-42", 18827));
  assert.equal(url.origin, "https://api.qrserver.com");
  assert.equal(decodeURIComponent(url.searchParams.get("data")), "TIRKHA-DEMO|FONEPAY|TIR-TEST-42|18827");
  assert.throws(() => buildDemoPaymentQrUrl("ESEWA", "", 1), /test reference/);
});
