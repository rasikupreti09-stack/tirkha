"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let active = true;
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        if (active) void registration.update().catch(() => undefined);
        return navigator.serviceWorker.ready;
      })
      .then((registration) => {
        if (!active) return;
        const urls = performance.getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => name.includes("/_next/static/"))
          .slice(0, 120);
        registration.active?.postMessage({ type: "WARM_STATIC", urls });
      })
      .catch(() => {
        // Offline caching is progressive enhancement; app startup must continue.
      });
    return () => { active = false; };
  }, []);

  return null;
}
