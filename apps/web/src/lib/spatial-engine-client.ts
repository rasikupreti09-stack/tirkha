"use client";

import type { SpatialViewportQuery, SpatialViewportResult, SpatialWorkerResponse } from "./spatial-engine-protocol";

type Pending = { resolve: (result: SpatialViewportResult) => void; reject: (error: Error) => void };
export type SpatialEngineLease = {
  query: (query: SpatialViewportQuery) => Promise<SpatialViewportResult>;
  release: () => void;
};

let worker: Worker | null = null;
let nextRequestId = 0;
let leaseCount = 0;
const pending = new Map<number, Pending>();

function rejectPending(reason: Error) {
  for (const request of pending.values()) request.reject(reason);
  pending.clear();
}

function stopWorker(reason = new Error("Spatial worker was reset")) {
  worker?.terminate();
  worker = null;
  rejectPending(reason);
}

function getWorker() {
  if (worker) return worker;
  const next = new Worker(new URL("../workers/spatial-engine.worker.ts", import.meta.url), { type: "module", name: "tirkha-spatial-engine" });
  next.addEventListener("message", (event: MessageEvent<SpatialWorkerResponse>) => {
    const request = pending.get(event.data.id);
    if (!request) return;
    pending.delete(event.data.id);
    if (event.data.ok) request.resolve(event.data.result);
    else request.reject(new Error(event.data.error));
  });
  next.addEventListener("error", (event) => {
    event.preventDefault();
    if (worker === next) stopWorker(new Error("Spatial worker stopped unexpectedly"));
  });
  next.addEventListener("messageerror", () => { if (worker === next) stopWorker(new Error("Spatial worker returned unreadable data")); });
  worker = next;
  return next;
}

export function acquireSpatialEngine(): SpatialEngineLease {
  leaseCount++;
  let released = false;
  return {
    query(query) {
      if (released) return Promise.reject(new Error("Spatial worker lease has been released"));
      const requestId = ++nextRequestId;
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        try {
          getWorker().postMessage({ id: requestId, type: "query", query });
        } catch (error) {
          pending.delete(requestId);
          reject(error instanceof Error ? error : new Error("Could not send spatial query"));
        }
      });
    },
    release() {
      if (released) return;
      released = true;
      leaseCount = Math.max(0, leaseCount - 1);
      if (leaseCount === 0) stopWorker(new Error("No map view is using the spatial worker"));
    },
  };
}

/** Clears worker-held datasets and indices before a viewport recovery/remount. */
export function resetSpatialEngine() {
  stopWorker(new Error("Spatial worker cache cleared"));
}
