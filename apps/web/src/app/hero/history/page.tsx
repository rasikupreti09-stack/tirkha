"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, CircleDollarSign, ReceiptText } from "lucide-react";
import { catalogMoney, type CompletedTransaction } from "@tirkha/shared";
import { useAuth } from "@/components/auth-provider";
import { HeroRouteGuard } from "@/components/hero-route-guard";

type WalletSummary = { gross_paisa: number; commission_paisa: number; net_paisa: number; cod_commission_receivable_paisa: number };
const blankWallet: WalletSummary = { gross_paisa: 0, commission_paisa: 0, net_paisa: 0, cod_commission_receivable_paisa: 0 };
const PAGE_SIZE = 25;

export default function HeroHistoryPage() {
  return <HeroRouteGuard><HeroHistoryContent /></HeroRouteGuard>;
}

function HeroHistoryContent() {
  const { client, session, loading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState(blankWallet);
  const [receipts, setReceipts] = useState<CompletedTransaction[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const userId = session?.user.id;
  const demoProfile = session?.user.user_metadata.demo_auth === true;
  const refresh = useCallback(async () => {
    if (demoProfile) {
      setBusy(true); setError("");
      let demoReceipts: CompletedTransaction[] = [];
      try {
        const value: unknown = JSON.parse(localStorage.getItem("tirkha.demo-hero-earnings.v1") ?? "[]");
        if (Array.isArray(value)) demoReceipts = value as CompletedTransaction[];
      } catch { setError("Saved demo earnings could not be read in this browser."); }
      setReceipts(demoReceipts); setHasMore(false);
      setSummary({
        gross_paisa: Math.round(demoReceipts.reduce((sum, receipt) => sum + receipt.gross_amount, 0) * 100),
        commission_paisa: Math.round(demoReceipts.reduce((sum, receipt) => sum + receipt.company_income, 0) * 100),
        net_paisa: Math.round(demoReceipts.reduce((sum, receipt) => sum + receipt.hero_payout, 0) * 100),
        cod_commission_receivable_paisa: Math.round(demoReceipts.filter(receipt => receipt.payment_type === "CASH").reduce((sum, receipt) => sum + receipt.company_income, 0) * 100),
      });
      setBusy(false); return;
    }
    if (!client || !userId) { setBusy(false); return; }
    setBusy(true); setError("");
    const [summaryResult, receiptResult] = await Promise.all([
      client.rpc("hero_wallet_summary"),
      client.from("completed_transactions").select("*").eq("hero_id", userId).order("timestamp", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    ]);
    if (summaryResult.error) setError("Wallet totals are unavailable. Apply migration 22 and confirm your Hero account is verified.");
    else setSummary(summaryResult.data?.[0] ?? blankWallet);
    if (receiptResult.error) setError("Completed receipts could not be loaded. Apply migration 22 and verify your Hero role.");
    else { setHasMore(receiptResult.data.length > PAGE_SIZE); setReceipts(receiptResult.data.slice(0, PAGE_SIZE)); }
    setBusy(false);
  }, [client, userId, page, demoProfile]);
  useEffect(() => { if (!loading && !session) router.replace("/login?next=%2Fhero%2Fhistory"); }, [loading, session, router]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (loading || busy && !userId) return <main className="mx-auto max-w-6xl p-6" role="status">Loading completed receipts…</main>;
  if (!session) return null;
  return <main className="mx-auto max-w-6xl space-y-6 p-4 py-8 sm:p-8"><Link href="/hero/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16}/> Hero dashboard</Link><header><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">Tirkha | तिर्खा · Finance</p><h1 className="mt-2 text-3xl font-semibold">Completed job receipts</h1><p className="mt-1 text-sm text-slate-600">{demoProfile ? "Simulated demo receipts are saved in this browser only; they are not payment records." : "Only finished jobs with confirmed payments appear here; archived transaction details are held in the cold ledger."}</p></header>
    {error && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><WalletCard icon={<Banknote/>} label="Gross customer payments" paisa={summary.gross_paisa}/><WalletCard icon={<CircleDollarSign/>} label="Platform commission · 12.5%" paisa={summary.commission_paisa}/><WalletCard icon={<ReceiptText/>} label="Net Hero earnings" paisa={summary.net_paisa} strong/><WalletCard icon={<CircleDollarSign/>} label="Cash commission receivable" paisa={summary.cod_commission_receivable_paisa} note="COD commission collected in cash is due to Tirkha"/></section>
    <section className="overflow-hidden rounded-xl border bg-white"><div className="flex items-center justify-between border-b p-4"><div><h2 className="font-semibold">Receipt history</h2><p className="text-xs text-slate-500">Amount breakdowns are stored in NPR paisa.</p></div><button className="rounded-md border px-3 py-2 text-sm" onClick={() => void refresh()} disabled={busy}>Refresh</button></div><div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm"><thead className="bg-slate-50"><tr>{["Completed at", "Trade / service", "Payment", "Gross", "Commission", "Net Hero earning"].map(column => <th key={column} className="px-4 py-3 font-semibold">{column}</th>)}</tr></thead><tbody>{receipts.map(receipt => <tr key={receipt.booking_id} className="border-t"><td className="px-4 py-3">{new Date(receipt.timestamp).toLocaleString()}</td><td className="px-4 py-3">{receipt.hero_trade}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{receipt.payment_type === "CASH" ? "COD" : receipt.payment_type}</span></td><td className="px-4 py-3">{catalogMoney(Math.round(receipt.gross_amount * 100))}</td><td className="px-4 py-3">{catalogMoney(Math.round(receipt.company_income * 100))}</td><td className="px-4 py-3 font-semibold text-emerald-900">{catalogMoney(Math.round(receipt.hero_payout * 100))}</td></tr>)}{!busy && receipts.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No completed, paid jobs have a receipt yet.</td></tr>}</tbody></table></div><div className="flex items-center justify-between border-t p-4 text-sm"><button className="rounded-md border px-3 py-2 disabled:opacity-40" disabled={page === 0 || busy} onClick={() => setPage(value => Math.max(0, value - 1))}>Previous</button><span className="text-slate-500">Page {page + 1}</span><button className="rounded-md border px-3 py-2 disabled:opacity-40" disabled={!hasMore || busy} onClick={() => setPage(value => value + 1)}>Next</button></div></section>
    <p className="text-xs leading-5 text-slate-500">History contains completed-job payment fields only. Customer chats, diagnostic notes, location trails and identity documents are not included.</p>
  </main>;
}
function WalletCard({ icon, label, paisa, strong, note }: { icon: React.ReactNode; label: string; paisa: number; strong?: boolean; note?: string }) { return <article className={`rounded-xl border p-5 ${strong ? "border-emerald-300 bg-emerald-50" : "bg-white"}`}><div className="flex items-start justify-between gap-3"><span className="text-sm text-slate-600">{label}</span><span className="text-emerald-800">{icon}</span></div><strong className="mt-3 block text-2xl">{catalogMoney(paisa)}</strong>{note && <small className="mt-1 block text-slate-500">{note}</small>}</article>; }

