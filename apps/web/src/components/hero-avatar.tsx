import type { HeroTrade } from "@tirkha/shared";

const tradeMarks: Record<HeroTrade, string> = {
  PLUMBING: "P", ELECTRICAL: "E", APPLIANCE_TECHNICIAN: "A", BEAUTICIAN: "B",
  PAINTER: "P", CLEANER: "C", HANDYMAN: "H",
};

/** Local, brand-safe SVG fallback portrait for a Tirkha Hero without an uploaded avatar. */
export function HeroAvatar({ trade, label, size = 56 }: { trade?: HeroTrade | null; label: string; size?: number }) {
  const mark = trade ? tradeMarks[trade] : "T";
  return <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`${label}, Tirkha service professional`} className="shrink-0 rounded-full ring-2 ring-white">
    <circle cx="32" cy="32" r="32" fill="#e2e8f0"/>
    <path d="M9 59c2-12 10-18 23-18s21 6 23 18" fill="#1f2937"/>
    <path d="M18 27c0-12 6-19 14-19s14 7 14 19v5c0 10-6 17-14 17s-14-7-14-17z" fill="#c98e6d"/>
    <path d="M18 27c1-12 7-20 15-20 7 0 12 5 14 13-5 1-9-1-12-4-3 5-9 8-17 8z" fill="#27313a"/>
    <path d="M25 31h2m10 0h2" stroke="#1f2937" strokeWidth="2" strokeLinecap="round"/>
    <path d="M28 38c2 2 6 2 8 0" fill="none" stroke="#874d42" strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M25 45l7 7 7-7" fill="#f8fafc"/>
    <rect x="38" y="48" width="17" height="12" rx="4" fill="#059669" stroke="#fff" strokeWidth="2"/>
    <text x="46.5" y="56.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">{mark}</text>
  </svg>;
}
