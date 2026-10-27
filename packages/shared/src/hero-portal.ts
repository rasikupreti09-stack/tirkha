import { z } from "zod";

export const HERO_TRADES = ["PLUMBING", "ELECTRICAL"] as const;
export const HERO_OPERATIONAL_ZONES = ["Kathmandu", "Lalitpur", "Bhaktapur", "Baneshwor", "Thamel", "Kirtipur"] as const;
export const heroTradeSchema = z.enum(HERO_TRADES);
export const heroOperationalZoneSchema = z.enum(HERO_OPERATIONAL_ZONES);
export const heroRegistrationSchema = z.strictObject({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^\+9779[0-9]{9}$/),
  trade_code: heroTradeSchema,
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
  hero_trade: 'PLUMBING' | 'ELECTRICAL';
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
