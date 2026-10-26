import { mapPinSchema, type Coordinates } from "@tirkha/shared";
import { getSupabase } from "./supabase";

export async function resolveLocation(point: Coordinates, signal: AbortSignal) {
  const { data, error } = await getSupabase().auth.getSession();
  if (error || !data.session) throw new Error("Sign in to resolve your location.");
  const response = await fetch("/api/geocoding/reverse", {
    method: "POST", signal, headers: { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token },
    body: JSON.stringify(point),
  });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Address lookup failed. Enter your landmark manually.");
  return mapPinSchema.parse(body);
}
