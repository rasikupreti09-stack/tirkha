"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export function ProfessionalPresence({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    if (!navigator.geolocation) { setStatus("This browser does not support location sharing."); return; }
    const share = () => navigator.geolocation.getCurrentPosition(async position => {
      if (!active) return;
      const heading = Number.isFinite(position.coords.heading) ? position.coords.heading : null;
      const { error } = await getSupabase().rpc("update_professional_presence", { p_latitude: position.coords.latitude, p_longitude: position.coords.longitude, p_heading: heading });
      if (active) setStatus(error ? "Location sharing could not be updated." : "Location is shared with Tirkha operations while this page is open.");
    }, () => { if (active) setStatus("Location access is off. Enable it in your browser to appear online on the operations map."); }, { enableHighAccuracy: true, maximumAge: 20_000, timeout: 10_000 });
    share();
    const timer = window.setInterval(share, 45_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [enabled]);
  return enabled ? <p className="mt-3 text-xs text-muted-foreground" role="status">{status || "Your browser may ask for location access to show you as online."}</p> : null;
}
