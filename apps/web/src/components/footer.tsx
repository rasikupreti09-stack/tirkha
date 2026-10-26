"use client";
import { MapPin, Phone, ShieldCheck, WalletCards } from "lucide-react";
import { useMarketplace, type LegalTopic } from "./marketplace-provider";

const topics: { id: LegalTopic; label: string }[] = [
  { id: "about", label: "About Tirkha" }, { id: "terms", label: "Terms & conditions" },
  { id: "privacy", label: "Privacy policy" }, { id: "cancellation", label: "Cancellation & refunds" },
  { id: "grievance", label: "Grievance redressal" },
];

export function SiteFooter() {
  const { setLegalModal, setModal } = useMarketplace();
  return <footer className="mk-footer mk-footer-full">
    <div className="mk-footer-main">
      <div className="mk-footer-brand"><a href="/" className="mk-brand" aria-label="Tirkha | तिर्खा home"><span className="mk-brand-mark">T<span>•</span></span><span className="mk-brand-name">Tirkha <span className="mk-brand-nepali">| तिर्खा</span></span></a><p>Good help, closer to home.<br/>Everyday services for life in Nepal.</p><span className="mk-footer-place"><MapPin size={15}/> Kathmandu Valley, Nepal</span><small>Registered office address and PAN/VAT registration details will be published after business registration is confirmed.</small></div>
      <div><h2>Explore</h2><a href="/#catalog">Home services</a><a href="/map">Tirkha city map</a><a href="/jobs">Professional jobs</a><a href="/bookings">My bookings</a><button onClick={() => setModal("orders")}>Demo receipts</button></div>
      <div><h2>Customer care</h2><a href="/bookings"><Phone size={14}/> Booking support & contact</a><a href="/chat">Message your booking contact</a><p>For a general complaint, open Grievance redressal below and include your booking reference.</p></div>
      <div><h2>Payments</h2><div className="mk-payment-badges" aria-label="Payment methods"><span>eSewa</span><span>Khalti</span><span>FonePay</span><span>Cash on delivery</span></div><p><WalletCards size={14}/> Demo checkouts do not collect payments.</p></div>
      <div className="mk-footer-legal"><h2>About & policies</h2>{topics.map(topic => <button key={topic.id} onClick={() => setLegalModal(topic.id)}>{topic.label}</button>)}</div>
    </div>
    <div className="mk-footer-bottom"><span>© {new Date().getFullYear()} Tirkha · Nepal</span><span><ShieldCheck size={14}/> Clear scopes · Transparent estimates · Demo-only checkout</span></div>
  </footer>;
}
