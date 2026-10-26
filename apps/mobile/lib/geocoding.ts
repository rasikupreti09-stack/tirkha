import { mapPinSchema, type Coordinates } from "@tirkha/shared";
import { getSupabase } from "./supabase";

export async function resolveLocation(point: Coordinates, signal: AbortSignal) {
  const { data, error } = await getSupabase().auth.getSession();
  if (error || !data.session) throw new Error("Sign in to resolve your location.");
  const raw = process.env.EXPO_PUBLIC_API_URL;
  if (!raw) throw new Error("Configure EXPO_PUBLIC_API_URL to resolve addresses, or enter your landmark manually.");
  const url = new URL(raw);
  if (url.protocol !== "https:" && !(__DEV__ && url.protocol === "http:")) throw new Error("The address server must use HTTPS.");
  const response = await fetch(url.origin + "/api/geocoding/reverse", {
    method: "POST", signal, headers: { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token },
    body: JSON.stringify(point),
  });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Address lookup failed. Enter your landmark manually.");
  return mapPinSchema.parse(body);
}
