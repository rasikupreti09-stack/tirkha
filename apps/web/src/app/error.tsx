"use client";

import { useEffect } from "react";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("Tirkha route failed", { digest: error.digest });
  }, [error]);

  return <main className="grid min-h-[60vh] place-items-center bg-slate-50 px-5 py-12 text-slate-900">
    <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm" role="alert">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Tirkha | तिर्खा</p>
      <h1 className="mt-3 text-2xl font-semibold">This page hit a temporary problem</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Your account and booking data are unchanged. You can retry this page or return to the home screen.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={retry} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Try again</button>
        <a href="/" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800">Go to home</a>
      </div>
      {error.digest && <p className="mt-4 text-xs text-slate-500">Reference: {error.digest}</p>}
    </section>
  </main>;
}
