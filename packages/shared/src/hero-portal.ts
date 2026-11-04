import { z } from "zod";
import type { Coordinates } from "./schemas";

export const HERO_TRADES = ["PLUMBING", "ELECTRICAL", "APPLIANCE_TECHNICIAN", "BEAUTICIAN", "PAINTER", "CLEANER", "HANDYMAN"] as const;
export const HERO_OPERATIONAL_ZONES = ["Kathmandu Valley", "Pokhara", "Hetauda", "Simara"] as const;
export const HERO_OPERATIONAL_REGION_BOUNDS: Readonly<Record<HeroOperationalZone, Readonly<{ south: number; west: number; north: number; east: number }>>> = {
  "Kathmandu Valley": { south: 27.625, west: 85.245, north: 27.755, east: 85.465 },
  Pokhara: { south: 28.175, west: 83.940, north: 28.255, east: 84.035 },
  Hetauda: { south: 27.350, west: 84.970, north: 27.500, east: 85.120 },
  Simara: { south: 27.120, west: 84.910, north: 27.240, east: 85.080 },
};

/** Keep client-side Hero GPS checks consistent across web and native clients. */
export function isCoordinateInHeroOperationalZone(value: unknown, zone: string | null | undefined): value is Coordinates {
  if (!value || typeof value !== "object" || !zone || !(zone in HERO_OPERATIONAL_REGION_BOUNDS)) return false;
  const point = value as Partial<Coordinates>;
  if (typeof point.latitude !== "number" || !Number.isFinite(point.latitude)
    || typeof point.longitude !== "number" || !Number.isFinite(point.longitude)) return false;
  const bounds = HERO_OPERATIONAL_REGION_BOUNDS[zone as HeroOperationalZone];
  return point.latitude >= bounds.south && point.latitude <= bounds.north
    && point.longitude >= bounds.west && point.longitude <= bounds.east;
}
export const heroTradeSchema = z.enum(HERO_TRADES);
export const heroOperationalZoneSchema = z.enum(HERO_OPERATIONAL_ZONES);
export const heroRegistrationSchema = z.strictObject({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^\+9779[0-9]{9}$/),
  trade_category: heroTradeSchema,
  operational_zone: heroOperationalZoneSchema,
});
export const heroQuoteInputSchema = z.strictObject({
  labor_paisa: z.number().int().min(0).max(2_147_483_647),
  materials_paisa: z.number().int().min(0).max(2_147_483_647),
  materials_breakdown: z.string().trim().min(1).max(2000),
  scope: z.string().trim().min(10).max(2000),
}).refine(value => value.labor_paisa + value.materials_paisa <= 2_147_483_647, {
  message: "Quote total exceeds the supported NPR amount",
  path: ["materials_paisa"],
});
export type HeroTrade = z.infer<typeof heroTradeSchema>;
export type HeroOperationalZone = z.infer<typeof heroOperationalZoneSchema>;
export type HeroRegistrationInput = z.infer<typeof heroRegistrationSchema>;
export type HeroQuoteInput = z.infer<typeof heroQuoteInputSchema>;
export type ProfessionalJobQuote = {
  id: string;
  booking_id: string;
  professional_id: string;
  labor_paisa: number;
  materials_paisa: number;
  total_paisa: number;
  materials_breakdown: string;
  scope: string;
  created_at: string;
};
export type CompletedTransaction = {
  transaction_id: string;
  booking_id: string;
  timestamp: string;
  hero_id: string;
  hero_name: string;
  hero_trade: 'PLUMBING' | 'ELECTRICAL' | 'APPLIANCE_TECHNICIAN' | 'BEAUTICIAN' | 'PAINTER' | 'CLEANER' | 'HANDYMAN';
  gross_amount: number;
  commission_rate: number;
  company_income: number;
  hero_payout: number;
  payment_type: 'CASH' | 'ESEWA' | 'KHALTI' | 'FONEPAY';
};

export type FinanceSummary = {
  gmv_npr: number;
  company_income_npr: number;
  hero_cash_receivables_npr: number;
  transaction_count: number;
  pending_archive_count: number;
  pending_archive_gmv_npr: number;
};
