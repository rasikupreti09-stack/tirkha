export const PROFESSIONAL_PAGE_SIZE = 12;
export const LOCATION_STORAGE_KEY = "tirkha.location.v1";

// These are address suggestions, not a claim that a professional serves an area.
export const NEPAL_AREA_SUGGESTIONS = [
  { municipality: "Kathmandu", landmarks: ["New Baneshwor", "Boudha", "Kalanki", "Maharajgunj"] },
  { municipality: "Lalitpur", landmarks: ["Patan Dhoka", "Jawalakhel", "Satdobato", "Bhaisepati"] },
  { municipality: "Bhaktapur", landmarks: ["Suryabinayak", "Kamalbinayak", "Dudhpati"] },
  { municipality: "Pokhara", landmarks: ["Lakeside", "Prithvi Chowk", "Mahendrapul"] },
  { municipality: "Bharatpur", landmarks: ["Narayanghat", "Hakim Chowk"] },
  { municipality: "Biratnagar", landmarks: ["Traffic Chowk", "Rani"] },
  { municipality: "Butwal", landmarks: ["Traffic Chowk", "Kalikanagar"] },
] as const;

export function formatNpr(paisa: number | null): string {
  if (paisa === null) return "Price on request";
  if (!Number.isInteger(paisa) || paisa < 0 || paisa > 2_147_483_647) {
    throw new RangeError("Expected nonnegative integer paisa.");
  }
  // Explicit NPR prefix avoids device-specific currency symbols.
  return "NPR " + new Intl.NumberFormat("en-NP", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(paisa / 100);
}
export function hourlyRateLabel(paisa: number | null): string {
  return paisa === null ? formatNpr(null) : `${formatNpr(paisa)} / hour`;
}
