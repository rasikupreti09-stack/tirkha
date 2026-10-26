import type { Coordinates } from "./schemas";

export const KATHMANDU_CENTER: Coordinates = { latitude: 27.7172, longitude: 85.324 };
export const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

export function nepalAreaFromNominatim(value: unknown): string {
  const address = value && typeof value === "object" && "address" in value ? value.address : null;
  if (!address || typeof address !== "object") throw new Error("No area found. Enter your municipality and landmark manually.");
  const fields = address as Record<string, unknown>;
  if (fields.country_code !== "np") throw new Error("Choose a service location within Nepal.");
  const first = (...names: string[]) => names.map((name) => fields[name]).find((part): part is string => typeof part === "string" && part.trim().length > 0)?.trim();
  const area = first("suburb", "neighbourhood", "quarter", "village", "hamlet");
  const city = first("city", "town", "municipality", "city_district", "county", "state_district");
  const parts = [...new Set([area, city].filter((part): part is string => !!part))];
  if (!parts.length) throw new Error("No area found. Enter your municipality and landmark manually.");
  return parts.join(", ").slice(0, 200);
}

/** Server-side only. The caller must cache and globally serialize provider requests.
 * Mobile/web use /api/geocoding/reverse, never call the public provider directly. */
export async function reverseGeocode(latitude: number, longitude: number, options: {
  userAgent: string; endpoint?: string; signal?: AbortSignal; fetcher?: typeof fetch;
}): Promise<string> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error("Enter valid latitude and longitude.");
  }
  if (!options.userAgent.trim()) throw new Error("A Nominatim application identifier is required.");
  const url = new URL(options.endpoint || NOMINATIM_REVERSE_URL);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Geocoding provider must use HTTPS.");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "14");
  url.searchParams.set("accept-language", "en");
  const response = await (options.fetcher || fetch)(url, {
    headers: { Accept: "application/json", "User-Agent": options.userAgent },
    signal: options.signal, redirect: "error",
  });
  if (!response.ok) throw new Error(response.status === 429
    ? "Address lookup is busy. Try again later or enter your landmark manually."
    : "Address lookup is unavailable. Enter your landmark manually.");
  return nepalAreaFromNominatim(await response.json());
}
