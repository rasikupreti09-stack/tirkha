import assert from "node:assert/strict";
import test from "node:test";
import {
  profileSchema, profileUpdateSchema, professionalProfileSchema,
  serviceCategorySchema, bookingSchema, bookingCreateSchema, paisaSchema,
} from "../src/schemas.ts";

const customer = "10000000-0000-4000-8000-000000000001";
const professional = "10000000-0000-4000-8000-000000000002";
const category = "20000000-0000-4000-8000-000000000001";
const time = "2026-10-06T10:00:00+05:45";
const request = { customer_id: customer, category_id: category, service_address: "Kathmandu, ward 5", scheduled_at: time };
const booking = { ...request, id: category, professional_id: null, status: "requested", total_price_paisa: null, created_at: time };

test("row schemas accept nullable onboarding fields and Nepal timezone offsets", () => {
  profileSchema.parse({ id: customer, full_name: null, phone_number: null, phone: "+9779800000001", avatar_url: null, role: "customer", created_at: time });
  professionalProfileSchema.parse({
    profile_id: professional,
    bio: null,
    verification_status: "pending",
    rating: 0,
    hourly_rate_paisa: null,
    trade_code: null,
    trade_category: null,
    operational_zone: null,
    citizenship_document_path: null,
    suspended_at: null,
  });
  serviceCategorySchema.parse({ id: category, name: "Plumbing", slug: "home-plumbing", description: null, icon_name: null });
  bookingSchema.parse(booking);
});

test("client mutations reject privileged columns and invalid identity/address/time", () => {
  profileUpdateSchema.parse({ full_name: "Rasik" });
  assert.equal(profileUpdateSchema.safeParse({ role: "admin" }).success, false);
  assert.equal(profileUpdateSchema.safeParse({}).success, false);
  bookingCreateSchema.parse(request);
  for (const extra of [{ total_price_paisa: 1 }, { status: "completed" }, { professional_id: professional }, { id: category }]) {
    assert.equal(bookingCreateSchema.safeParse({ ...request, ...extra }).success, false);
  }
  for (const invalid of [{ customer_id: "not-a-uuid" }, { service_address: "   " }, { scheduled_at: "tomorrow" }]) {
    assert.equal(bookingCreateSchema.safeParse({ ...request, ...invalid }).success, false);
  }
});

test("money, ratings and assignment constraints match the database contract", () => {
  for (const bad of [-1, 0.1, 2_147_483_648, Infinity, NaN]) assert.equal(paisaSchema.safeParse(bad).success, false);
  paisaSchema.parse(2_147_483_647);
  assert.equal(bookingSchema.safeParse({ ...booking, status: "completed" }).success, false);
  assert.equal(bookingSchema.safeParse({ ...booking, professional_id: customer }).success, false);
  bookingSchema.parse({ ...booking, status: "completed", professional_id: professional, total_price_paisa: 10000 });
  assert.equal(professionalProfileSchema.safeParse({ profile_id: professional, bio: null, verification_status: "verified", rating: 5.01, hourly_rate_paisa: 0 }).success, false);
});

