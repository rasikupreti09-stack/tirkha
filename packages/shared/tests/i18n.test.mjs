import test from "node:test";
import assert from "node:assert/strict";
import { translateCatalogLabel, translatePriceLabel, translateUi } from "../src/i18n.ts";

test("main marketplace labels are available in English and Nepali", () => {
  assert.equal(translateUi("allServices", "en"), "All services");
  assert.equal(translateUi("allServices", "np"), "सबै सेवाहरू");
  assert.equal(translateUi("careWellness", "np"), "स्वास्थ्य तथा हेरचाह");
  assert.equal(translateUi("assistantButton", "np"), "घरायसी समस्याबारे सोध्नुहोस्");
});

test("service cards localize known catalog labels and preserve unknown labels", () => {
  assert.equal(translateCatalogLabel("Deep home cleaning", "np"), "घरको गहिरो सरसफाइ");
  assert.equal(translateCatalogLabel("per unit", "np"), "प्रति युनिट");
  assert.equal(translatePriceLabel("Rs. 350 / per unit", "np"), "रु. 350 प्रति युनिट");
  assert.equal(translateCatalogLabel("Custom service", "np"), "Custom service");
  assert.equal(translateCatalogLabel("Deep home cleaning", "en"), "Deep home cleaning");
});
