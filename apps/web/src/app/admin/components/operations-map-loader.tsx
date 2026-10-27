"use client";
import dynamic from "next/dynamic";
import type { BookingStatus } from "@tirkha/shared";
import type { OperationsJob } from "./operations-map";
export type { OperationsJob } from "./operations-map";
export type OperationsHeroLocation = {
  professional_id: string; latitude: number; longitude: number; heading: number | null;
  speed_mps: number | null; battery_level: number | null; active_booking_id: string | null;
  status: "online_idle" | "en_route" | "on_service"; updated_at: string;
};
export const OperationsMap = dynamic(() => import("./operations-map").then(module => module.OperationsMap), {
  ssr: false,
  loading: () => <div className="grid min-h-[480px] place-items-center rounded-xl border bg-muted text-sm text-muted-foreground" role="status">Loading Valley fleet map…</div>,
}) as (props: { heroes: { id: string; name: string; phone: string | null }[]; locations: OperationsHeroLocation[]; jobs: OperationsJob[] }) => React.ReactElement;
