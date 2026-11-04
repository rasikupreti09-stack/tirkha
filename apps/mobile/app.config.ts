import type { ConfigContext, ExpoConfig } from "expo/config";

const appIcon = "./assets/icon.png";
const identifierPattern = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9_-]*)+$/;

export default ({ config }: ConfigContext): ExpoConfig => {
  const androidPackage = process.env.TIRKHA_ANDROID_PACKAGE?.trim() || "com.tirkha.app";
  const iosBundleIdentifier = process.env.TIRKHA_IOS_BUNDLE_ID?.trim() || "com.tirkha.app";
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

  for (const [label, value] of [["TIRKHA_ANDROID_PACKAGE", androidPackage], ["TIRKHA_IOS_BUNDLE_ID", iosBundleIdentifier]] as const) {
    if (!identifierPattern.test(value)) throw new Error(`${label} must be a valid reverse-domain application identifier.`);
  }

  // Fail before an EAS production build can ship with broken auth, missing server
  // endpoints, a mock backend, or Android maps that render as a blank grid.
  if (process.env.EAS_BUILD_PROFILE === "production" || process.env.EAS_BUILD_PROFILE === "preview") {
    const buildPlatform = process.env.EAS_BUILD_PLATFORM;
    const required = ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_EAS_PROJECT_ID"];
    if (buildPlatform !== "ios") required.push("GOOGLE_MAPS_ANDROID_API_KEY");
    const missing = required.filter((name) => !process.env[name]?.trim());
    if (missing.length) throw new Error(`Production mobile build is missing EAS environment variables: ${missing.join(", ")}.`);
    for (const name of ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_API_URL"]) {
      try {
        if (new URL(process.env[name]!).protocol !== "https:") throw new Error();
      } catch { throw new Error(`Production mobile build requires ${name} to be a valid HTTPS URL.`); }
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId ?? "")) {
      throw new Error("Production mobile build requires EXPO_PUBLIC_EAS_PROJECT_ID to be a UUID.");
    }
    if (required.some((name) => process.env[name]?.includes("YOUR_"))) {
      throw new Error("Production mobile build cannot use placeholder values; configure real production environment variables in EAS.");
    }
    if (process.env.EXPO_PUBLIC_TIRKHA_LOCAL_MOCK === "1") throw new Error("Production mobile builds cannot use EXPO_PUBLIC_TIRKHA_LOCAL_MOCK=1.");
  }

  return {
    ...config,
    name: "Tirkha",
    slug: "tirkha",
    scheme: "tirkha",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    icon: appIcon,
    ios: {
      ...config.ios,
      bundleIdentifier: iosBundleIdentifier,
      supportsTablet: true,
      buildNumber: config.ios?.buildNumber ?? "1",
    },
    android: {
      ...config.android,
      package: androidPackage,
      versionCode: config.android?.versionCode ?? 1,
      adaptiveIcon: { foregroundImage: appIcon, backgroundColor: "#1F2937", ...config.android?.adaptiveIcon },
    },
    plugins: [
      ...(config.plugins || []),
      ["react-native-maps", { ...(androidMapsKey ? { androidGoogleMapsApiKey: androidMapsKey } : {}) }],
      ["expo-location", { locationWhenInUsePermission: "Tirkha uses your location to place the service pin at your home and help a Hero reach you." }],
    ],
    ...(projectId ? { updates: { ...config.updates, url: `https://u.expo.dev/${projectId}` }, runtimeVersion: { policy: "appVersion" } } : {}),
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}),
    },
  };
};
