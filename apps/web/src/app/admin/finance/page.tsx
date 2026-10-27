"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Landmark, RefreshCw, Wallet, CircleDollarSign } from "lucide-react";
import type { CompletedTransaction, FinanceSummary } from "@tirkha/shared";
import { useAuth } from "@/components/auth-provider";

const empty: FinanceSummary = { gmv_npr: 0, company_income_npr: 0, hero_cash_receivables_npr: 0, transaction_count: 0, pending_archive_count: 0, pending_archive_gmv_npr: 0 };
const npr = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 2 });
const columns: (keyof CompletedTransaction)[] = ["transaction_id", "booking_id", "timestamp", "hero_id", "hero_name", "hero_trade", "gross_amount", "commission_rate", "company_income", "hero_payout", "payment_type"];

export default function AdminFinancePage() {
  const { client, session, loading } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [summary, setSummary] = useState(empty);
  const [rows, setRows] = useState<CompletedTransaction[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!client || !session) { setBusy(false); return; }
    setBusy(true); setError("");
    const profile = await client.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
    if (profile.error || profile.data?.role !== "admin") { setAuthorized(false); setBusy(false); return; }
    setAuthorized(true);
    const [totals, pending] = await Promise.all([
      client.rpc("admin_finance_summary"),
      client.from("completed_transactions").select("*").order("timestamp", { ascending: false }).limit(500),
    ]);
    if (totals.error) setError("Finance totals are unavailable. Apply migration 22 and confirm the account has the admin role.");
    else setSummary(totals.data?.[0] ?? empty);
    if (pending.error) setError("Pending ledger rows could not be loaded.");
    else setRows(pending.data ?? []);
    setBusy(false);
  }, [client, session]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!client || !authorized) return;
    const channel = client.channel("admin-finance-transactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "completed_transactions" }, () => void refresh())
      .subscribe();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { window.clearInterval(timer); void client.removeChannel(channel); };
  }, [client, authorized, refresh]);

  function exportReport(format: "csv" | "json") {
    const report = { generated_at: new Date().toISOString(), currency: "NPR", all_time_summary: summary, pending_archive_transactions: rows, note: "Detailed rows already archived to cold storage are represented in all_time_summary." };
    const body = format === "json" ? JSON.stringify(report, null, 2) : [
      columns.join(","),
      ...rows.map(row => columns.map(key => csvCell(row[key])).join(",")),
      "", `All-time GMV,${summary.gmv_npr}`, `Company revenue,${summary.company_income_npr}`, `Hero COD commission receivable,${summary.hero_cash_receivables_npr}`,
    ].join("\r\n");
    const blob = new Blob([body], { type: format === "json" ? "application/json" : "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = href; anchor.download = `tirkha-finance-${new Date().toISOString().slice(0, 10)}.${format}`; anchor.click(); URL.revokeObjectURL(href);
  }
  if (loading || busy) return <main className="p-8" role="status">Checking finance access…</main>;
  if (!session || !authorized) return <main className="mx-auto grid min-h-[60vh] max-w-xl place-items-center p-6"><section className="w-full rounded-2xl border bg-white p-7"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">Tirkha | तिर्खा</p><h1 className="mt-3 text-2xl font-semibold">Admin finance access required</h1><p className="mt-2 text-sm text-slate-600">Sign in with an account assigned the admin role to view settlement totals and transaction details.</p><Link className="mt-5 inline-flex rounded-md bg-slate-900 px-4 py-2 text-white" href="/login?next=%2Fadmin%2Ffinance">Admin sign in</Link></section></main>;
  return <main className="mx-auto max-w-7xl space-y-6 p-4 py-8 md:p-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><Link href="/admin" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16}/> Operations dashboard</Link><p className="mt-4 text-xs font-bold uppercase tracking-[.18em] text-emerald-800">Tirkha | तिर्खा · Accounting</p><h1 className="mt-2 text-3xl font-semibold">Financial command center</h1><p className="mt-1 text-sm text-slate-600">NPR totals include archived and not-yet-archived transactions.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => exportReport("csv")} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><Download size={16}/> Export CSV</button><button onClick={() => exportReport("json")} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><Download size={16}/> Export JSON</button><button onClick={() => void refresh()} disabled={busy} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><RefreshCw size={16}/> Refresh</button></div></header>
    {error && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}
    <section className="grid gap-4 md:grid-cols-3" aria-label="Financial totals"><Metric icon={<Landmark/>} label="Gross Merchandise Value" value={summary.gmv_npr} detail={`${summary.transaction_count.toLocaleString()} completed transactions`}/><Metric icon={<CircleDollarSign/>} label="Company net revenue" value={summary.company_income_npr} detail="12.5% commission recognized"/><Metric icon={<Wallet/>} label="Hero cash receivables" value={summary.hero_cash_receivables_npr} detail="Commission due from completed COD jobs"/></section>
    <section className="rounded-xl border bg-white"><header className="flex flex-wrap items-center justify-between gap-2 border-b p-4"><div><h2 className="font-semibold">Transactions awaiting cold archive</h2><p className="text-xs text-slate-600">{summary.pending_archive_count} rows · {npr.format(summary.pending_archive_gmv_npr)} GMV</p></div><span className="text-xs text-slate-500">Auto-archive runs daily when cold-storage settings are configured</span></header><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50"><tr>{["Completed", "Hero", "Trade", "Payment", "Gross", "Company", "Hero net"].map(item => <th key={item} className="px-4 py-3 font-semibold">{item}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.transaction_id} className="border-t"><td className="px-4 py-3">{new Date(row.timestamp).toLocaleString()}</td><td className="px-4 py-3">{row.hero_name}</td><td className="px-4 py-3">{row.hero_trade}</td><td className="px-4 py-3">{row.payment_type}</td><td className="px-4 py-3">{npr.format(row.gross_amount)}</td><td className="px-4 py-3">{npr.format(row.company_income)}</td><td className="px-4 py-3">{npr.format(row.hero_payout)}</td></tr>)}{!rows.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No pending rows. Older transaction detail is in the cold ledger.</td></tr>}</tbody></table></div></section>
    <p className="text-xs leading-5 text-slate-500">CSV/JSON exports include all-time totals and the retained transaction detail currently awaiting archival. The archive receiver must acknowledge each transaction ID before primary detail is removed.</p>
  </main>;
}
function csvCell(value: unknown) { const text = String(value ?? ""); return `"${text.replaceAll('"', '""')}"`; }
function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number; detail: string }) { return <article className="rounded-xl border bg-white p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-600">{label}</p><span className="text-emerald-800">{icon}</span></div><strong className="mt-3 block text-2xl">{npr.format(value)}</strong><p className="mt-1 text-xs text-slate-500">{detail}</p></article>; }

