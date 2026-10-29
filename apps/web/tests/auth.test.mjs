import assert from "node:assert/strict";
import test from "node:test";
import { authDashboardPath, isDemoAuthPhone, isValidDemoOtp, safeAuthReturnTarget } from "../src/lib/auth.ts";

test("demo OTP is available for Nepal 97/98 numbers only while demo mode is enabled", () => {
  assert.equal(isDemoAuthPhone("+9779800000000", true), true);
  assert.equal(isValidDemoOtp("9800000000", "123456", true), true);
  assert.equal(isDemoAuthPhone("9855029577", false), false);
  assert.equal(isValidDemoOtp("9855029577", "123456", false), false);
  assert.equal(isDemoAuthPhone("+9779812345679", false), false);
  assert.equal(isDemoAuthPhone("+9779855029577", true), true);
  assert.equal(isValidDemoOtp("+9779855029577", "123456", true), true);
  assert.equal(isValidDemoOtp("+9779855029577", "654321", true), false);
  assert.equal(isDemoAuthPhone("+9779712345678", true), true);
  assert.equal(isDemoAuthPhone("+9779612345678", true), false);
  assert.equal(isDemoAuthPhone("not a phone", true), false);
});

test("customer and Hero login destinations remain distinct and same-origin", () => {
  assert.equal(authDashboardPath("customer"), "/");
  assert.equal(authDashboardPath("professional"), "/hero/dashboard");
  assert.equal(isValidDemoOtp("9855029577", "123456", true) && authDashboardPath("customer"), "/");
  assert.equal(isValidDemoOtp("9855029577", "123456", true) && authDashboardPath("professional"), "/hero/dashboard");
  assert.equal(safeAuthReturnTarget("/hero/register", "https://tirkha.example"), "/hero/register");
  assert.equal(safeAuthReturnTarget("//evil.example", "https://tirkha.example"), null);
});
