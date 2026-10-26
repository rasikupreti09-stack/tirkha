"use client";
import { MarketplaceDialog } from "./marketplace-dialog";
import type { LegalTopic } from "./marketplace-provider";

const titles: Record<LegalTopic, string> = {
  about: "About Tirkha", terms: "Terms & conditions", privacy: "Privacy policy",
  cancellation: "Cancellation & refunds", grievance: "Grievance redressal",
};

export function LegalModals({ topic, onClose }: { topic: LegalTopic | null; onClose: () => void }) {
  if (!topic) return null;
  return <MarketplaceDialog title={titles[topic]} onClose={onClose}>
    <article className="mk-legal-content" aria-label={titles[topic]}>
      {topic === "about" && <>
        <p>Tirkha helps households find everyday home, care, and professional services with clear scopes and NPR estimates. Our goal is to make dependable local help easier to discover and book.</p>
        <h3>Where we serve</h3><p>The current catalog covers Kathmandu, Lalitpur, and Bhaktapur, with selected Pokhara listings. A listing is not a promise of availability; each appointment must be confirmed.</p>
        <h3>Safety and verification</h3><p>Professional accounts must pass Tirkha identity and background checks before receiving eligible job requests. Customers should keep OTPs private, confirm the job scope before work begins, and report concerns through their booking.</p>
      </>}
      {topic === "terms" && <>
        <p>These plain-language terms describe the intended marketplace rules. They are a product policy summary and do not replace the applicable law or legal advice. Tirkha’s live terms and registration details must be reviewed before commercial launch.</p>
        <h3>Using the platform</h3><p>Give accurate contact, address, and job details. A request is not confirmed until a professional accepts it and the appointment is confirmed in the product. Do not use Tirkha for unlawful work or emergencies.</p>
        <h3>Scheduling and service scope</h3><p>Choose a future appointment and provide a usable address. The listed price is an estimate for the stated scope. Parts or additional work require a separate quote and your approval. A professional must not start unapproved extra work.</p>
        <h3>Service concerns</h3><p>Report incomplete or unsafe work promptly through the booking. Tirkha will review the record and contact the parties. Any remedy depends on the confirmed scope, evidence, provider terms, and applicable consumer protections.</p>
        <p>Reference: <a href="https://doc.gov.np/content/324/electronic-business--e-commerce--act--2081/" target="_blank" rel="noreferrer">Electronic Business (E-Commerce) Act, 2081 — Department of Commerce</a>.</p>
      </>}
      {topic === "privacy" && <>
        <p>Tirkha uses the phone number and booking details needed to authenticate an account, coordinate a service, protect the marketplace, and resolve support requests. Keep your OTP confidential.</p>
        <h3>Location and sharing</h3><p>A map pin and address are used to arrange the requested service. Booking details are shared with the assigned professional when needed to deliver the service. Do not include sensitive information in the address or job notes unless it is necessary.</p>
        <h3>Access and retention</h3><p>Use account and booking controls to review your details. Records may be retained for service, security, accounting, or legal requirements. Requests to correct or remove personal information can be raised through booking support.</p>
        <p>This summary is not a compliance certification. See the <a href="https://repository.lawcommission.gov.np/np/documents/%E0%A4%B5%E0%A5%88%E0%A4%AF%E0%A4%95%E0%A5%8D%E0%A4%A4%E0%A4%BF%E0%A4%95-%E0%A4%97%E0%A5%8B%E0%A4%AA%E0%A4%A8%E0%A4%BF%E0%A4%AF%E0%A4%A4%E0%A4%BE-%E0%A4%B8%E0%A4%AE%E0%A5%8D%E0%A4%AC%E0%A4%A8%E0%A5%8D/" target="_blank" rel="noreferrer">Personal Privacy Act, 2075 — Nepal Law Commission</a>.</p>
      </>}
      {topic === "cancellation" && <>
        <h3>Before a Hero is dispatched</h3><p>Customers may cancel a request free of charge before the assigned Hero is dispatched. If the product does not show dispatch status, contact support through the booking before the appointment.</p>
        <h3>After payment</h3><p>For a verified gateway payment, refunds are initiated after cancellation or a reviewed service issue is confirmed. Gateway and bank processing times vary; Tirkha will show the request status and reference where available. COD bookings have no advance payment to refund.</p>
        <h3>After work begins</h3><p>Contact support through the booking as soon as possible. Charges for completed work or approved materials may remain payable. We review each case against the confirmed job scope and applicable consumer protections.</p>
        <p>See the <a href="https://lawcommission.gov.np/content/12167/12167-the-consumer-protection-act-2/" target="_blank" rel="noreferrer">Consumer Protection Act, 2075 — Nepal Law Commission</a>.</p>
      </>}
      {topic === "grievance" && <>
        <p>For a service complaint, safety concern, privacy request, or payment dispute, open the related booking and use its support or chat controls. Include the booking reference, the issue, and any relevant receipt or photos. Do not send OTPs or full payment credentials.</p>
        <h3>Review process</h3><p>Tirkha should acknowledge a submitted grievance, review the booking and payment record, and contact the customer and professional for relevant details. Urgent safety risks should be reported to the appropriate local emergency authority first.</p>
        <p><a href="/bookings">Open booking support</a> · <a href="/chat">Open booking messages</a></p>
        <p>Direct support email and phone are not published in this build because verified contact details were not supplied. This panel will be updated when Tirkha’s official support channels are confirmed.</p>
      </>}
      <p className="mk-legal-note">Draft platform information · Confirm Tirkha’s registered business details and final legal terms before accepting paid public orders.</p>
    </article>
  </MarketplaceDialog>;
}
