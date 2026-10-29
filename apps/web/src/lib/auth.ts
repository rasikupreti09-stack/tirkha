import { DEMO_PHONE_AUTH_NUMBERS, normalizeNepalPhoneNumber, phoneSchema } from "@tirkha/shared/phone-auth";

/** Demo OTP is limited to configured test numbers unless explicit demo mode is enabled. */
export function isDemoAuthPhone(phone: string, demoModeEnabled: boolean, configuredTestPhones: readonly string[] = DEMO_PHONE_AUTH_NUMBERS): boolean {
  const normalized = normalizeNepalPhoneNumber(phone);
  if (!phoneSchema.safeParse(normalized).success) return false;
  if (demoModeEnabled) return true;
  return configuredTestPhones.some(testPhone => normalizeNepalPhoneNumber(testPhone) === normalized);
}

export function isValidDemoOtp(phone: string, otp: string, demoModeEnabled: boolean, configuredTestPhones?: readonly string[]): boolean {
  return isDemoAuthPhone(phone, demoModeEnabled, configuredTestPhones) && otp === "123456";
}

/** Accept only same-origin, root-relative return destinations. */
export function safeAuthReturnTarget(candidate: string | null, origin: string): string | null {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return null;
  try {
    const target = new URL(candidate, origin);
    return target.origin === origin ? `${target.pathname}${target.search}${target.hash}` : null;
  } catch {
    return null;
  }
}

export function authDashboardPath(role: "customer" | "professional"): string {
  return role === "professional" ? "/hero/dashboard" : "/";
}
