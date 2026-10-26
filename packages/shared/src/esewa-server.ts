// Import only from a trusted server. Never provide merchant secrets to a client.
import { z } from "zod";

const callbackSchema = z.strictObject({
  transaction_code: z.string().min(1).max(200), status: z.string().min(1).max(40),
  total_amount: z.union([z.string(), z.number()]), transaction_uuid: z.string().regex(/^[A-Za-z0-9-]{1,100}$/),
  product_code: z.string().min(1).max(100), signed_field_names: z.string(),
  signature: z.string().min(1).max(100),
});
async function key(secret: string) {
  if (!secret.trim()) throw new Error("ESEWA_SECRET_KEY is required.");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign","verify"]);
}
function decodeBase64(value: string) {
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error("Invalid eSewa base64.");
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}
export async function generateEsewaSignature(input: { total_amount: string; transaction_uuid: string; product_code: string }, secret: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(input.total_amount) || !/^[A-Za-z0-9-]+$/.test(input.transaction_uuid) || !/^[A-Za-z0-9_-]+$/.test(input.product_code)) throw new Error("Invalid eSewa signing fields.");
  const message = `total_amount=${input.total_amount},transaction_uuid=${input.transaction_uuid},product_code=${input.product_code}`;
  const signature = await crypto.subtle.sign("HMAC", await key(secret), new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
export async function verifyEsewaCallback(encoded: string, secret: string) {
  if (!encoded || encoded.length > 8192) throw new Error("Invalid eSewa callback.");
  const data = callbackSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64(encoded))));
  const fields = data.signed_field_names.split(",");
  const required = ["transaction_code","status","total_amount","transaction_uuid","product_code","signed_field_names"];
  if (fields.length !== required.length || new Set(fields).size !== fields.length || !required.every(field => fields.includes(field))) throw new Error("Unsigned eSewa callback fields.");
  const message = fields.map(field => field + "=" + String(data[field as keyof typeof data])).join(",");
  const signature = decodeBase64(data.signature);
  if (signature.length !== 32 || !await crypto.subtle.verify("HMAC", await key(secret), signature, new TextEncoder().encode(message))) throw new Error("Invalid eSewa signature.");
  return data;
}
