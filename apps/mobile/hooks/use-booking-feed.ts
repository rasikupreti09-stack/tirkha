import { useEffect, useRef, useState } from "react";
import { subscribeToBookings, type BookingListMode, type ServiceCategory, type UserRole, type WorkflowBooking } from "@tirkha/shared";
import { AppState } from "react-native";
import { getSupabase, isLocalMock } from "../lib/supabase";
import { loadBookings } from "../lib/bookings";

type Feed = { key: string; items: WorkflowBooking[]; categories: ServiceCategory[]; loading: boolean; error: string };
export function useBookingFeed(userId: string, role: UserRole, mode: BookingListMode, page: number) {
  const key = [userId, role, mode, page].join(":");
  const [state, setState] = useState<Feed>({ key, items: [], categories: [], loading: true, error: "" });
  const [live, setLive] = useState(false);
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    // Incoming Hero jobs are delivered by hero_dispatch_notifications, whose
    // RLS policy binds each notice to the verified Hero's trade and service
    // area. Do not also query the broader bookings table for unassigned jobs.
    const dispatchOnly = role === "professional" && mode === "available";
    if (dispatchOnly) {
      setState({ key, items: [], categories: [], loading: false, error: "" });
      setLive(false);
      refreshRef.current = () => {};
      return () => { refreshRef.current = () => {}; };
    }

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
      { user_id: userId, role: role === "professional" ? "professional" : "customer" },
      { enabled: !isLocalMock, onChange: refresh, onStatus: setLive });
    const timer = setInterval(refresh, 30_000);
    const appState = AppState.addEventListener("change", (state) => { if (state === "active") refresh(); });
    return () => {
      active = false; generation++; clearInterval(timer);
      appState.remove();
      stop();
      refreshRef.current = () => {};
    };
  }, [key, userId, role, mode, page]);
  const current = state.key === key ? state : { key, items: [], categories: [], loading: true, error: "" };
  return { ...current, localMock: isLocalMock, live, refresh: () => refreshRef.current() };
}


