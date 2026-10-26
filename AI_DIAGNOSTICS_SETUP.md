# Tirkha AI symptom triage setup

The assistant combines a deterministic symptom-to-service catalog with optional server-side photo triage. It is a service-routing aid, not a repair diagnosis, water-safety test, emergency service, or guarantee of a price or provider result.

## Enable photo triage

Set these **server-only** variables in `apps/web/.env.local` for local development and in the web hosting project's server environment for deployment:

```dotenv
OPENAI_API_KEY=your_server_secret
OPENAI_VISION_MODEL=gpt-4.1-mini
```

Restart the Next.js server after changing local environment values. Do not prefix the key with `NEXT_PUBLIC_`, commit a real key, or send it from the browser. Without the key, text matching and listed catalog prices continue to work; photo analysis returns a clear unavailable message.

The browser accepts JPG, PNG and WebP up to 3 MB. The API sends the image and short description to the configured model for one request, sets no-store behavior, and does not save the original image. The result is constrained to catalog service IDs, low/moderate confidence, urgency, short visible-symptom explanation, and safety text. Do not put faces, identity documents, medical details or other sensitive content in an uploaded photo.

The route currently applies a best-effort per-runtime rate limit (five requests per ten minutes per forwarded IP) plus same-origin and payload validation. Serverless memory limits mean that this is not a global abuse-prevention control. Before accepting public paid image volume, enforce a durable per-account/IP limit at the edge or with a shared rate-limit service and set provider-side spend caps.

## Scope and pricing

The symptom guide recognizes 24 common plumbing and electrical patterns, including tap/pipe leaks, pressure and trapped-air symptoms, muddy/iron-colored water, pumps/wells, solar or other water heaters, tank/toilet concerns, power loss, flicker, breakers, outlets, possible voltage problems, inverters, appliance concerns, overload and earthing clues. The list is an editable starting taxonomy, not an exhaustive set of all household failures. Unknown descriptions remain open-ended; the assistant should ask a follow-up or say that the exact service is not yet listed.

Only a direct match to an existing priced service can be added through the current demo checkout. Issues without a suitable catalog service (for example water-quality testing, well-pump repair, solar water-heater repair, drain clearing or appliance repair) are identified without attaching an unrelated price. Add a professionally reviewed service, scope and rate before routing those issues to booking.

The assistant shows the catalog's listed service/labour amount and visit fee as a reference. Spare parts are excluded because no verified part inventory and rates exist; the provider must inspect, provide a separate quote, and receive customer approval before extra work or part purchase. The primary confirmation carries the issue, assistant summary, severity, chat area, preferred-time note, suggested duration and reference price through short-lived `sessionStorage` to the authenticated `/book` flow. The booking form pre-fills the job details and nearby landmark, lets the customer choose an exact Nepal date/time and drop the destination pin, then submits one booking through the existing Supabase `create_booking_request` RPC. Its live labour estimate is recalculated from the selected professional's hourly rate and selected duration, and is shown before submission. The original image is not stored in session storage or attached to the booking. The separate demo-cart action remains local-only and does not dispatch a Hero.

## Research notes

The local issue taxonomy includes muddy or iron-colored water, but appearance cannot determine potability. Nepal's Department of Water Supply and Sewerage Management publishes the National Drinking Water Quality Standards, and the WHO's iron fact sheet places water-quality assessment within chemical contaminant guidance. A home-service chat should route suspected quality problems to testing rather than pronounce water safe from an image. Nepal's standards catalogue lists residential electrical layout and wiring practice standards; electrical diagnosis and repairs should therefore remain with a qualified professional. The in-app safety language deliberately avoids user repair instructions.

References:

- Nepal Department of Water Supply and Sewerage Management, [National Drinking Water Quality Standards](https://dwssm.gov.np/content/53/national-drinking-water-quality-standards--2005--/)
- WHO, [Chemical fact sheet: Iron](https://www.who.int/publications/m/item/chemical-fact-sheets--iron)
- Nepal Bureau of Standards and Metrology, [Electrical, Electronics, Telecom and IT Standards](https://nbsm.gov.np/uploads/files/Electrical-PDF.pdf)
- OpenAI, [Responses API reference](https://platform.openai.com/docs/api-reference/responses)

