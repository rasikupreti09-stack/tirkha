import { z } from "zod";

export const phoneSchema = z.string().trim().regex(/^\+9779[0-9]{9}$/, "Enter a Nepal mobile number: +977 followed by 10 digits starting with 9.");
export const phoneOtpSchema = z.string().regex(/^[0-9]{6}$/, "Enter the six-digit SMS code.");
export const phoneSignupSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name.").max(100),
  role: z.enum(["customer", "professional"]),
});
type AuthResult = { error: { message: string; code?: string } | null };
type PhoneAuthClient = { auth: {
  signInWithOtp(input: { phone: string; options: { shouldCreateUser: boolean; data?: { full_name: string; requested_role: string } } }): Promise<AuthResult>;
  verifyOtp(input: { phone: string; token: string; type: "sms" }): Promise<AuthResult>;
} };
export async function signInWithPhone(client: PhoneAuthClient, phone: string, signup?: z.infer<typeof phoneSignupSchema>) {
  const profile = signup ? phoneSignupSchema.parse(signup) : undefined;
  return client.auth.signInWithOtp({ phone: phoneSchema.parse(phone), options: {
    shouldCreateUser: !!profile,
    ...(profile ? { data: { full_name: profile.full_name, requested_role: profile.role } } : {}),
  } });
}
export async function verifyPhoneOtp(client: PhoneAuthClient, phone: string, token: string) {
  return client.auth.verifyOtp({ phone: phoneSchema.parse(phone), token: phoneOtpSchema.parse(token), type: "sms" });
}
export function createPhoneAuth(client: PhoneAuthClient) {
  return {
    signInWithPhone: (phone: string, signup?: z.infer<typeof phoneSignupSchema>) => signInWithPhone(client, phone, signup),
    verifyPhoneOtp: (phone: string, token: string) => verifyPhoneOtp(client, phone, token),
  };
}
export function phoneAuthError(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message || "Check your phone number and code.";
  const code = (error as { code?: string } | null)?.code;
  if (code === "otp_expired") return "The code is invalid or expired. Request a new SMS code.";
  if (code === "over_sms_send_rate_limit" || code === "over_request_rate_limit") return "Too many attempts. Wait before requesting another code.";
  if (code === "sms_send_failed" || code === "phone_provider_disabled") return "SMS delivery is unavailable. Contact Tirkha support.";
  return "Could not verify or send the code. Check your details and connection, then try again.";
}
export const bookingContactSchema = z.object({ full_name: z.string().nullable(), phone: phoneSchema });
export type BookingContact = z.infer<typeof bookingContactSchema>;


