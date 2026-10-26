import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { supabaseSettings, khaltiSettings, expoProjectId, requiredSetting } from "../packages/shared/src/environment.ts";
async function settings(app) {
  const env = {};
  for (const file of [".env", ".env.local"]) {
    try { Object.assign(env, parseEnv(await readFile(new URL(`../apps/${app}/${file}`, import.meta.url), "utf8"))); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return { ...env, ...process.env };
}
const web = await settings("web"), mobile = await settings("mobile");
let failures = 0;
function check(name, fn) {
  try { fn(); console.log("PASS " + name); }
  catch (error) { failures++; console.error("FAIL " + name + ": " + error.message); }
}
check("Web Supabase", () => supabaseSettings(web.NEXT_PUBLIC_SUPABASE_URL,web.NEXT_PUBLIC_SUPABASE_ANON_KEY,"NEXT_PUBLIC"));
check("Mobile Supabase", () => supabaseSettings(mobile.EXPO_PUBLIC_SUPABASE_URL,mobile.EXPO_PUBLIC_SUPABASE_ANON_KEY,"EXPO_PUBLIC"));
const local = web.TIRKHA_LOCAL_MOCK === "1" && !process.argv.includes("--full");
if (local) {
  check("Local mock consistency", () => {
    if (web.NEXT_PUBLIC_TIRKHA_LOCAL_MOCK !== "1" || mobile.EXPO_PUBLIC_TIRKHA_LOCAL_MOCK !== "1") throw new Error("Enable the local mock flags in both applications.");
    for (const url of [web.NEXT_PUBLIC_SUPABASE_URL,mobile.EXPO_PUBLIC_SUPABASE_URL]) if (new URL(url).hostname !== "127.0.0.1") throw new Error("The local mock must use 127.0.0.1; it is not a hosted service.");
    if (web.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "tirkha-local-anon-key" || mobile.EXPO_PUBLIC_SUPABASE_ANON_KEY !== "tirkha-local-anon-key") throw new Error("Use the documented local mock anon key.");
  });
  console.log("SKIP Khalti, EAS and push credentials: local mock mode disables these integrations. Use check:env:pilot for full deployment checks.");
} else {
check("Khalti server", () => khaltiSettings(web));
const app = JSON.parse(await readFile(new URL("../apps/mobile/app.json", import.meta.url), "utf8"));
check("Expo project", () => expoProjectId(app.expo?.extra?.eas?.projectId || mobile.EXPO_PUBLIC_EAS_PROJECT_ID));
check("Push dispatcher", () => { if (requiredSetting(web.PUSH_DISPATCH_SECRET,"PUSH_DISPATCH_SECRET").length < 32) throw new Error("PUSH_DISPATCH_SECRET must contain at least 32 characters."); });
}
console.log(failures ? `${failures} configuration groups need attention. No secret values were printed.` : "Environment checks passed. Network credentials have not been authenticated.");
process.exitCode = failures ? 1 : 0;
