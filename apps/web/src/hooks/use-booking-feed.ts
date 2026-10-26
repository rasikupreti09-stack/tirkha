"use client";
import { useEffect, useRef, useState } from "react";
import { subscribeToBookings, type BookingListMode, type ServiceCategory, type UserRole, type WorkflowBooking } from "@tirkha/shared";

import { getSupabase, isLocalMock } from "../lib/supabase";
import { loadBookings } from "../lib/bookings";

type Feed = { key: string; items: WorkflowBooking[]; categories: ServiceCategory[]; loading: boolean; error: string };
export function useBookingFeed(userId: string, role: UserRole, mode: BookingListMode, page: number) {
  const key = [userId, role, mode, page].join(":");
  const [state, setState] = useState<Feed>({ key, items: [], categories: [], loading: true, error: "" });
  const [live, setLive] = useState(false);
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true; let generation = 0;
    const client = getSupabase();
    setState({ key, items: [], categories: [], loading: true, error: "" }); setLive(false);
    const refresh = () => {
      const current = ++generation;
      void loadBookings(userId, role, mode, page).then((data) => {
        if (active && current === generation) setState({ key, ...data, loading: false, error: "" });
      }).catch(() => {
        if (active && current === generation) setState((previous) => ({ ...previous, loading: false, error: "Could not refresh bookings. Showing the last loaded results; use Refresh to try again." }));
      });
    };
    refreshRef.current = refresh;
    refresh();
    const stop = subscribeToBookings(client,
      role === "professional" && mode === "available" ? { available: true }
        : { user_id: userId, role: role === "professional" ? "professional" : "customer" },
      { enabled: !isLocalMock, onChange: refresh, onStatus: setLive });
    // Always poll as well: an available job claimed by someone else may cease
    // to satisfy this viewer's RLS and therefore emit no event to this viewer.
    const timer = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false; generation++; clearInterval(timer);
      window.removeEventListener("focus", refresh);
      stop();
      refreshRef.current = () => {};
    };
  }, [key, userId, role, mode, page]);
  const current = state.key === key ? state : { key, items: [], categories: [], loading: true, error: "" };
  return { ...current, localMock: isLocalMock, live, refresh: () => refreshRef.current() };
}


