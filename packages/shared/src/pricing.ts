/** Published starting labour rates for the Kathmandu Valley catalog (integer paisa). */
export const NPR_SERVICE_PRICING = {
  plumbingInspection: { amount_paisa: 65_000, label: "Initial inspection / leak diagnosis" },
  tapLeakRepair: { amount_paisa: 35_000, label: "Tap & faucet leakage repair", unit: "per unit" },
  drainageClearing: { amount_paisa: 50_000, label: "Waste pipe / drainage clearing", mode: "starting_at" },
  motorPumpFitting: { amount_paisa: 200_000, label: "Water motor / sump pump fitting" },
  electricalInspection: { amount_paisa: 65_000, label: "Electrical safety inspection / MCB diagnosis" },
  switchSocketReplacement: { min_paisa: 35_000, max_paisa: 50_000, label: "Switch / socket / bulb replacement", unit: "per unit" },
  mcbFuseSwap: { amount_paisa: 75_000, label: "Single-phase MCB / fuse swap" },
  technicalAudit: { amount_paisa: 100_000, label: "General on-site technical audit" },
} as const;

export type NprServicePricing = typeof NPR_SERVICE_PRICING;

export type CatalogPriceOverride = {
  base_paisa: number;
  visit_paisa: number;
  pricing_mode: "fixed" | "starting_at" | "range";
  pricing_unit?: string;
  price_max_paisa?: number;
  pricing_note?: string;
};

/** Canonical catalog IDs mapped to the published standard Kathmandu rates. */
export const CATALOG_PRICE_OVERRIDES: Record<string, CatalogPriceOverride> = {
  "sink-leak": { base_paisa: NPR_SERVICE_PRICING.tapLeakRepair.amount_paisa, visit_paisa: 0, pricing_mode: "fixed", pricing_unit: "per unit", pricing_note: "Accessible tap or faucet leak; replacement parts are separate." },
  "switchboard": { base_paisa: NPR_SERVICE_PRICING.switchSocketReplacement.min_paisa, price_max_paisa: NPR_SERVICE_PRICING.switchSocketReplacement.max_paisa, visit_paisa: 0, pricing_mode: "range", pricing_unit: "per unit", pricing_note: "Rs. 350–500 per unit depending on fitting; parts are separate." },
  "plumbing-inspection": { base_paisa: NPR_SERVICE_PRICING.plumbingInspection.amount_paisa, visit_paisa: 0, pricing_mode: "fixed" },
  "drain-clearing": { base_paisa: NPR_SERVICE_PRICING.drainageClearing.amount_paisa, visit_paisa: 0, pricing_mode: "starting_at", pricing_note: "From Rs. 500; final scope confirmed on inspection." },
  "sump-pump-fitting": { base_paisa: NPR_SERVICE_PRICING.motorPumpFitting.amount_paisa, visit_paisa: 0, pricing_mode: "fixed" },
  "electrical-inspection": { base_paisa: NPR_SERVICE_PRICING.electricalInspection.amount_paisa, visit_paisa: 0, pricing_mode: "fixed" },
  "mcb-fuse-swap": { base_paisa: NPR_SERVICE_PRICING.mcbFuseSwap.amount_paisa, visit_paisa: 0, pricing_mode: "fixed" },
  "technical-audit": { base_paisa: NPR_SERVICE_PRICING.technicalAudit.amount_paisa, visit_paisa: 0, pricing_mode: "fixed" },
};

export function applyCatalogPriceOverride<T extends { id: string }>(service: T): T & Partial<CatalogPriceOverride> {
  const override = CATALOG_PRICE_OVERRIDES[service.id];
  if (!override) return service;
  return { ...service, ...override };
}

export function formatNprPaisa(paisa: number): string {
  if (!Number.isSafeInteger(paisa) || paisa < 0) throw new RangeError("Price must be a non-negative integer number of paisa.");
  return `Rs. ${new Intl.NumberFormat("en-NP", { maximumFractionDigits: 2 }).format(paisa / 100)}`;
}
