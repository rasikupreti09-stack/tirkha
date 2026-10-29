import assert from "node:assert/strict";
import test from "node:test";
import { authDashboardPath, isDemoAuthPhone, isValidDemoOtp, safeAuthReturnTarget } from "../src/lib/auth.ts";

test("production demo interception only accepts configured test phones", () => {
  assert.equal(isDemoAuthPhone("+9779800000000", false), true);
  assert.equal(isValidDemoOtp("9800000000", "123456", false), true);
  assert.equal(isDemoAuthPhone("+9779812345679", false), false);
  assert.equal(isDemoAuthPhone("+9779812345679", true), true);
  assert.equal(isDemoAuthPhone("not a phone", true), false);
});

test("customer and Hero login destinations remain distinct and same-origin", () => {
  assert.equal(authDashboardPath("customer"), "/");
  assert.equal(authDashboardPath("professional"), "/hero/dashboard");
  assert.equal(safeAuthReturnTarget("/hero/register", "https://tirkha.example"), "/hero/register");
  assert.equal(safeAuthReturnTarget("//evil.example", "https://tirkha.example"), null);
});
