"use client";
import { useEffect, useRef, useState } from "react";
import type { Coordinates, MapPin } from "@tirkha/shared";
import { resolveLocation } from "../lib/geocoding";

export function usePinResolution(value: MapPin | null, onChange: (pin: MapPin | null) => void, disabled = false) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(value); current.current = value;
  const pending = useRef<AbortController | null>(null);
  function cancel() { pending.current?.abort(); pending.current = null; setBusy(false); setError(""); }
  useEffect(() => {
    cancel();
    return () => { pending.current?.abort(); pending.current = null; };
  }, [value?.latitude, value?.longitude, disabled]);
  function pick(point: Coordinates | null) {
    if (disabled) return;
    cancel(); onChange(point ? { ...point, resolved_address: null } : null);
  }
  async function resolve() {
    if (!value || disabled || pending.current) return;
    const point = { latitude: value.latitude, longitude: value.longitude };
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError("");
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const result = await resolveLocation(point, controller.signal);
      if (!controller.signal.aborted && current.current?.latitude === point.latitude && current.current?.longitude === point.longitude) onChange(result);
    } catch (error) {
      if (pending.current === controller) setError(controller.signal.aborted ? "Lookup timed out. Try again or enter your landmark manually." : error instanceof Error ? error.message : "Address lookup failed.");
    } finally {
      clearTimeout(timeout);
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }
  return { busy, error, pick, resolve };
}
