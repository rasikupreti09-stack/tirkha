import assert from "node:assert/strict";
import test from "node:test";
import { signInSchema, signUpSchema, signUpMetadata, authFieldErrors, observeAuthSession, parseAuthCallback } from "../src/auth.ts";

const signup = { full_name: "  Rasik Upreti  ", email: " RASIK@example.com ", password: "  valid-password  ", confirm_password: "  valid-password  ", role: "professional" };
test("signup normalizes contact fields, preserves passwords and allowlists roles", () => {
  const parsed = signUpSchema.parse(signup);
  assert.equal(parsed.email, "rasik@example.com");
  assert.equal(parsed.full_name, "Rasik Upreti");
  assert.equal(parsed.password, signup.password);
  assert.deepEqual(signUpMetadata(parsed), { full_name: "Rasik Upreti", requested_role: "professional" });
  for (const invalid of [{ role: "admin" }, { password: "short" }, { confirm_password: "different" }, { email: "not-an-email" }, { full_name: " " }, { verification_status: "verified" }]) {
    assert.equal(signUpSchema.safeParse({ ...signup, ...invalid }).success, false);
  }
  signUpSchema.parse({ ...signup, role: "customer" });
});
test("sign-in allows legacy shorter passwords but rejects empty credentials", () => {
  signInSchema.parse({ email: "hello@example.com", password: "short" });
  assert.equal(signInSchema.safeParse({ email: "", password: "" }).success, false);
  const result = signUpSchema.safeParse({ ...signup, confirm_password: "different" });
  assert.equal(result.success, false);
  assert.equal(authFieldErrors(result.error).confirm_password, "Passwords do not match.");
});

function source() {
  let callback;
  let resolve;
  let reject;
  let removed = false;
  return {
    auth: {
      onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() { removed = true; } } } }; },
      getSession() { return new Promise((yes, no) => { resolve = yes; reject = no; }); },
    },
    event(session) { callback("SIGNED_IN", session); },
    resolve(session) { resolve({ data: { session }, error: null }); },
    reject() { reject(new Error("offline")); },
    get removed() { return removed; },
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
test("restores saved sessions and propagates sign-out", async () => {
  const fake = source();
  const states = [];
  const stop = observeAuthSession(fake.auth, (state) => states.push(state));
  fake.resolve({ user: { id: "saved" } });
  await flush();
  assert.equal(states.at(-1).session.user.id, "saved");
  assert.equal(states.at(-1).loading, false);
  fake.event(null);
  assert.equal(states.at(-1).session, null);
  stop();
  assert.equal(fake.removed, true);
});
test("a stale initial session cannot undo a newer sign-out", async () => {
  const fake = source();
  const states = [];
  const stop = observeAuthSession(fake.auth, (state) => states.push(state));
  fake.event(null);
  fake.resolve({ user: { id: "old-account" } });
  await flush();
  assert.equal(states.length, 1);
  assert.equal(states[0].session, null);
  stop();
});
test("unmount removes subscriptions and ignores late storage responses", async () => {
  const fake = source();
  const states = [];
  const stop = observeAuthSession(fake.auth, (state) => states.push(state));
  stop();
  fake.resolve({ user: { id: "old-account" } });
  fake.event(null);
  await flush();
  assert.equal(states.length, 0);
});
test("restoration failure exits loading with an actionable error", async () => {
  const fake = source();
  const states = [];
  const stop = observeAuthSession(fake.auth, (state) => states.push(state));
  fake.reject();
  await flush();
  assert.equal(states.at(-1).loading, false);
  assert.ok(states.at(-1).error);
  stop();
});
test("confirmation links require the expected app route and complete credentials", () => {
  const expected = "tirkha://auth/callback";
  assert.deepEqual(parseAuthCallback(expected + "#access_token=test-access&refresh_token=test-refresh", expected),
    { kind: "session", access_token: "test-access", refresh_token: "test-refresh" });
  assert.equal(parseAuthCallback("https://unrelated.example/auth/callback#access_token=a&refresh_token=b", expected).kind, "ignore");
  assert.equal(parseAuthCallback("tirkha://auth/other#access_token=a&refresh_token=b", expected).kind, "ignore");
  assert.equal(parseAuthCallback(expected + "#error=access_denied", expected).kind, "error");
  assert.equal(parseAuthCallback(expected + "#access_token=test-only", expected).kind, "error");
});
