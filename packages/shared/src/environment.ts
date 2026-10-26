export class ConfigurationError extends Error {
  readonly variables: string[];
  constructor(variables: string[]) { super("Configuration error: " + variables.join("; ") + ". Update your environment settings and restart the app."); this.name = "ConfigurationError"; this.variables = variables; }
}
export function requiredSetting(value: string | undefined, name: string): string {
  if (!value?.trim() || /YOUR_|REPLACE_|^<.*>$/i.test(value.trim())) throw new ConfigurationError([name + " is missing or still contains a placeholder"]);
  return value.trim();
}
export function httpSetting(value: string | undefined, name: string): string {
  const raw = requiredSetting(value, name);
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash || !["https:", "http:"].includes(url.protocol)) throw new Error();
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error();
    return url.toString().replace(/\/$/, "");
  } catch { throw new ConfigurationError([name + " must be an HTTPS URL (HTTP is allowed only for localhost)"]); }
}
export function supabaseSettings(url: string | undefined, key: string | undefined, prefix: "NEXT_PUBLIC" | "EXPO_PUBLIC") {
  return { url: httpSetting(url, prefix + "_SUPABASE_URL"), anonKey: requiredSetting(key, prefix + "_SUPABASE_ANON_KEY") };
}
export function expoProjectId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new ConfigurationError(["EXPO_PUBLIC_EAS_PROJECT_ID (or extra.eas.projectId) must be a valid EAS project UUID"]);
  return value;
}
export function khaltiSettings(env: Record<string, string | undefined>) {
  const environment = env.KHALTI_ENVIRONMENT || "sandbox";
  if (!["sandbox", "production"].includes(environment)) throw new ConfigurationError(["KHALTI_ENVIRONMENT must be sandbox or production"]);
  const secret = requiredSetting(env.KHALTI_SECRET_KEY, "KHALTI_SECRET_KEY");
  const serviceKey = requiredSetting(env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = httpSetting(env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  const appUrl = new URL(httpSetting(env.APP_URL, "APP_URL"));
  if (environment === "production" && appUrl.protocol !== "https:") throw new ConfigurationError(["APP_URL must use HTTPS for Khalti production"]);
  return { environment, secret, serviceKey, supabaseUrl, origin: appUrl.origin, api: environment === "production" ? "https://khalti.com/api/v2/epayment/" : "https://dev.khalti.com/api/v2/epayment/" };
}
export function configurationMessage(error: unknown, fallback: string) { return error instanceof ConfigurationError ? error.message : fallback; }
