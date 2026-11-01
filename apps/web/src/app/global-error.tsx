"use client";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="en">
    <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc", color: "#1f2937", fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <main style={{ width: "100%", maxWidth: 520, border: "1px solid #cbd5e1", borderRadius: 20, background: "#fff", padding: 28, boxShadow: "0 12px 36px #0f172a12" }} role="alert">
        <p style={{ margin: 0, color: "#047857", fontSize: 12, fontWeight: 700, letterSpacing: ".16em" }}>TIRKHA | तिर्खा</p>
        <h1 style={{ margin: "12px 0 8px", fontSize: 26 }}>Tirkha could not open this view</h1>
        <p style={{ margin: 0, lineHeight: 1.6, color: "#475569" }}>A temporary application error interrupted this page. Your saved booking information has not been intentionally changed.</p>
        {error.digest && <p style={{ color: "#64748b", fontSize: 12 }}>Reference: {error.digest}</p>}
        <button type="button" onClick={retry} style={{ marginTop: 20, border: 0, borderRadius: 9, background: "#1f2937", color: "white", padding: "11px 16px", fontWeight: 700, cursor: "pointer" }}>Try again</button>
      </main>
    </body>
  </html>;
}
