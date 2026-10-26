import { z } from "zod";

export const signUpRoleSchema = z.enum(["customer", "professional"]);
const emailSchema = z.string().trim().max(254).pipe(z.email("Enter a valid email address.")).transform((value) => value.toLowerCase());
export const signInSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128, "Password is too long."),
});
export const signUpSchema = z.strictObject({
  full_name: z.string().trim().min(2, "Enter at least two characters.").max(100, "Use at most 100 characters."),
  email: emailSchema,
  password: z.string().min(8, "Use at least 8 characters.").max(128, "Use at most 128 characters."),
  confirm_password: z.string().min(1, "Confirm your password."),
  role: signUpRoleSchema,
}).refine((value) => value.password === value.confirm_password, {
  path: ["confirm_password"], message: "Passwords do not match.",
});
export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignUpRole = z.infer<typeof signUpRoleSchema>;
export type AuthFieldErrors = Partial<Record<keyof SignUpInput, string>>;

export function authFieldErrors(error: z.ZodError): AuthFieldErrors {
  const result: AuthFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof SignUpInput;
    if (field && !result[field]) result[field] = issue.message;
  }
  return result;
}

export function authErrorMessage(error: { code?: string }): string {
  switch (error.code) {
    case "invalid_credentials": return "The email or password is incorrect.";
    case "email_not_confirmed": return "Confirm your email before signing in.";
    case "user_already_exists": return "An account may already use this email. Try signing in.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit": return "Too many attempts. Please wait before trying again.";
    case "weak_password": return "Choose a stronger password and try again.";
    case "signup_disabled": return "Account registration is currently unavailable.";
    default: return "We could not complete that request. Check your connection and try again.";
  }
}

// Only creation-time allowlisted metadata; never send an admin or verification field.
export function signUpMetadata(input: SignUpInput) {
  return { full_name: input.full_name, requested_role: input.role };
}

export type AuthSnapshot<T> = { session: T | null; loading: boolean; error: string | null };
type AuthSource<T> = {
  getSession(): Promise<{ data: { session: T | null }; error: { message: string } | null }>;
  onAuthStateChange(callback: (event: string, session: T | null) => void): {
    data: { subscription: { unsubscribe(): void } };
  };
};

// Keep the Supabase callback synchronous. A late storage read cannot undo a newer sign-out.
export function observeAuthSession<T>(auth: AuthSource<T>, publish: (state: AuthSnapshot<T>) => void) {
  let active = true;
  let revision = 0;
  const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
    revision++;
    if (active) publish({ session, loading: false, error: null });
  });
  const initialRevision = revision;
  void auth.getSession().then(({ data, error }) => {
    if (!active || revision !== initialRevision) return;
    publish({ session: error ? null : data.session, loading: false, error: error ? "Could not restore your session. Please try again." : null });
  }).catch(() => {
    if (active && revision === initialRevision) publish({ session: null, loading: false, error: "Could not restore your session. Check your connection and try again." });
  });
  return () => { active = false; subscription.unsubscribe(); };
}

export type AuthCallbackResult =
  | { kind: "ignore" }
  | { kind: "error"; message: string }
  | { kind: "session"; access_token: string; refresh_token: string };

export function parseAuthCallback(url: string, expectedUrl: string): AuthCallbackResult {
  try {
    const incoming = new URL(url);
    const expected = new URL(expectedUrl);
    if (incoming.protocol !== expected.protocol || incoming.host !== expected.host || incoming.pathname !== expected.pathname) return { kind: "ignore" };
    const params = new URLSearchParams(incoming.hash.slice(1));
    if (params.has("error") || incoming.searchParams.has("error")) return { kind: "error", message: "This confirmation link has expired or is invalid. Return to sign in or request a new signup email." };
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) return { kind: "session", access_token, refresh_token };
    return { kind: "error", message: "This confirmation link is incomplete. Confirm your email, then return to sign in." };
  } catch { return { kind: "ignore" }; }
}
