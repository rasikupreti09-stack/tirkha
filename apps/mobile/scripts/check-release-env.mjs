const platform = process.argv.find((arg) => arg.startsWith("--platform="))?.split("=")[1] ?? "all";
if (!new Set(["all", "ios", "android"]).has(platform)) {
  console.error("Usage: node scripts/check-release-env.mjs [--platform=ios|android|all]");
  process.exit(2);
}

const required = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_EAS_PROJECT_ID",
];
if (platform !== "ios") required.push("GOOGLE_MAPS_ANDROID_API_KEY");
const missing = required.filter((name) => {
  const value = process.env[name]?.trim();
  return !value || value.includes("YOUR_");
});
for (const name of ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_API_URL"]) {
  const value = process.env[name]?.trim();
  try {
    if (!value || new URL(value).protocol !== "https:") missing.push(`${name} must be an HTTPS URL`);
  } catch { missing.push(`${name} must be an HTTPS URL`); }
}
const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
  missing.push("EXPO_PUBLIC_EAS_PROJECT_ID must be a UUID");
}

if (process.env.EXPO_PUBLIC_TIRKHA_LOCAL_MOCK === "1") {
  missing.push("EXPO_PUBLIC_TIRKHA_LOCAL_MOCK must be 0 for store builds");
}
if (missing.length) {
  console.error(`Tirkha ${platform} release configuration is incomplete:\n${missing.map((name) => `  - ${name}`).join("\n")}\nConfigure these in the matching EAS environment, then retry.`);
  process.exit(1);
}
console.log(`Tirkha ${platform} release configuration is present. Values were not printed.`);
