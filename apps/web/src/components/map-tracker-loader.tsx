"use client";
import dynamic from "next/dynamic";
import type { Coordinates } from "@tirkha/shared";
import type { TrackedPoint } from "./map-tracker";

export type { TrackedPoint } from "./map-tracker";
export const MapTracker = dynamic(() => import("./map-tracker").then(module => module.MapTracker), {
  ssr: false,
  loading: () => <div className="h-[360px] animate-pulse rounded-xl bg-muted" role="status">Loading live map…</div>,
}) as (props: { points: TrackedPoint[]; origin?: Coordinates; destination?: Coordinates; navigation?: boolean; navigationTarget?: Coordinates; live?: boolean }) => React.ReactElement;
