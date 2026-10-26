"use client";
import type { WorkflowBooking } from "@tirkha/shared";
import { CustomerTrackingMap } from "./customer-tracking-map";
export function CustomerRouteTracker({ booking }: { booking: WorkflowBooking }) {
  return <CustomerTrackingMap booking={booking} />;
}
