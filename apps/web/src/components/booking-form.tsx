"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DURATION_OPTIONS, NEPAL_AREA_SUGGESTIONS, formatNpr, hourlyRateLabel, formatBookingDate } from "@tirkha/shared";
import { useBookingDraft } from "@/hooks/use-booking-draft";
import { AccountGate } from "./account-gate";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { PaymentCheckout } from "./payment-checkout";
import { LocationPicker } from "./location-picker";

export function BookingForm() {
  const params = useSearchParams();
  const slug = params.get("category") || "";
  const inspectionOnly = params.get("inspection") === "1";
  return <AccountGate roles={["customer"]}>{() => <BookingFields key={`${slug}:${inspectionOnly}`} slug={slug} inspectionOnly={inspectionOnly} />}</AccountGate>;
}
function BookingFields({ slug, inspectionOnly }: { slug: string; inspectionOnly: boolean }) {
  const form = useBookingDraft(slug, inspectionOnly);
  const selectStyle = "h-11 w-full rounded-md border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
  if (form.created) return <main className="mx-auto max-w-2xl px-4 py-10">
    <h1 className="text-3xl font-semibold">Booking requested</h1>
    <p role="status" className="mt-4">Your request has been saved. It is awaiting professional acceptance.</p>
    <p className="mt-4">{formatBookingDate(form.created.scheduled_at)}</p>
    <p className="mt-2">{inspectionOnly ? "Quote status:" : "Estimated labour total:"} <strong>{form.created.total_price_paisa === null ? "Quote pending" : formatNpr(form.created.total_price_paisa)}</strong></p>
    <p className="mt-4 break-all text-sm text-muted-foreground">Booking reference: {form.created.id}</p>
    <PaymentCheckout bookingId={form.created.id} amount={form.created.total_price_paisa} /><Button asChild className="mt-6"><Link href="/bookings">View my bookings</Link></Button>
  </main>;
  return <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
    <Link href="/explore" className="underline">← All services</Link>
    <h1 className="mt-8 text-3xl font-semibold">{inspectionOnly ? "Request an inspection" : "Request a service"}</h1>
    <p className="mt-3 text-muted-foreground">{inspectionOnly ? "A professional will inspect the reported issue and provide a written quote for your approval. No repair price is set in this request." : "Choose your service, preferred time, and landmark. All times are Nepal time (UTC+05:45)."}</p>
    {form.loading && <p className="mt-4" role="status">Loading services…</p>}
    {form.dataError && <div role="alert" className="mt-4 rounded-lg border p-4"><p>{form.dataError}</p><Button className="mt-3" variant="outline" onClick={form.retryData}>Retry loading</Button></div>}
    <form noValidate onSubmit={(event) => { event.preventDefault(); void form.submit(); }} className="mt-6">
      <fieldset disabled={form.busy || form.loading} className="space-y-6">
        <div className="space-y-2"><Label htmlFor="booking-category">Service category</Label>
          <select id="booking-category" value={form.categoryId} onChange={(event) => form.changeCategory(event.target.value)} className={selectStyle} required>
            <option value="">Select a service</option>{form.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div className="space-y-2"><Label htmlFor="booking-professional">Professional</Label>
          <select id="booking-professional" value={form.professionalId} onChange={(event) => form.setProfessionalId(event.target.value)} className={selectStyle} disabled={!form.categoryId || form.proLoading}>
            <option value="">Unassigned — let an eligible professional accept</option>
            {!inspectionOnly && form.choices.map((professional) => <option key={professional.profile_id} value={professional.profile_id}>{professional.full_name || "Tirkha professional"} — {hourlyRateLabel(professional.hourly_rate_paisa)}</option>)}
          </select>
          {form.proLoading && <p role="status" className="text-sm">Loading verified professionals…</p>}
          {form.hasMore && <Button variant="outline" type="button" disabled={form.proLoading} onClick={form.loadMore}>More professionals</Button>}
          <p className="text-sm text-muted-foreground">{inspectionOnly ? "This request is unassigned so a professional can inspect first. The booking remains quote pending." : "Only verified professionals in this category are offered. Your choice is a request, not a confirmed appointment."}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="booking-date">Date (Nepal)</Label><Input id="booking-date" type="date" value={form.schedule.date} onChange={(event) => form.setSchedule({ ...form.schedule, date: event.target.value })} required /></div>
          <div className="space-y-2"><Label htmlFor="booking-time">Time (Nepal)</Label><Input id="booking-time" type="time" value={form.schedule.time} onChange={(event) => form.setSchedule({ ...form.schedule, time: event.target.value })} required /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="booking-duration">{inspectionOnly ? "Appointment duration window" : "Estimated duration"}</Label><select id="booking-duration" value={form.duration} onChange={(event) => form.setDuration(Number(event.target.value))} className={selectStyle}>{DURATION_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></div>
        <section className="space-y-4 rounded-lg border bg-card p-5" aria-labelledby="address-heading">
          <h2 id="address-heading" className="text-lg font-semibold">Service location</h2>
          <LocationPicker value={form.location.map_pin ?? null} onChange={form.setPin} disabled={form.busy || form.loading} />
          {form.savedLocation && <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal text-left" onClick={form.useSavedLocation}>Use saved location: {form.savedLocation.municipality}, {form.savedLocation.landmark}</Button>}
          <div className="space-y-2"><Label htmlFor="booking-city">Municipality or area</Label><Input id="booking-city" list="booking-municipalities" value={form.location.municipality} onChange={(event) => form.setLocation({ ...form.location, municipality: event.target.value })} maxLength={100} />
            <datalist id="booking-municipalities">{NEPAL_AREA_SUGGESTIONS.map((area) => <option key={area.municipality} value={area.municipality} />)}</datalist></div>
          <div className="space-y-2"><Label htmlFor="booking-ward">Ward (optional)</Label><Input id="booking-ward" inputMode="numeric" value={form.location.ward} onChange={(event) => form.setLocation({ ...form.location, ward: event.target.value })} maxLength={2} /></div>
          <div className="space-y-2"><Label htmlFor="booking-landmark">Nearby landmark</Label><Input id="booking-landmark" value={form.location.landmark} onChange={(event) => form.setLocation({ ...form.location, landmark: event.target.value })} maxLength={160} /></div>
          <p className="text-xs text-muted-foreground">Place a pin to route your request to eligible nearby Heroes. This location will be saved on this browser after submission.</p>
        </section>
        <div className="space-y-2"><Label htmlFor="booking-details">Job details</Label>
          <textarea id="booking-details" value={form.details} onChange={(event) => form.setDetails(event.target.value)} rows={5} minLength={10} maxLength={2000} placeholder="Describe the problem, access instructions, and anything the professional should bring." className="w-full rounded-md border bg-background p-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <p className="text-xs text-muted-foreground">10–2,000 characters. Avoid sharing sensitive personal or medical information.</p>
        </div>
        <div className="rounded-lg border bg-muted p-5">
          <p className="font-semibold">{inspectionOnly ? "Price: Quote pending inspection" : `Estimated labour total: ${form.estimate === null ? "Quote pending" : formatNpr(form.estimate)}`}</p>
          <p className="mt-2 text-sm text-muted-foreground">{inspectionOnly ? "The professional must inspect the fault and provide a written scope and quote. Work starts only after you approve it." : "The estimate uses the selected professional hourly rate and duration. Materials and payment are not included. An unassigned request remains quote pending."}</p>
          {form.estimateError && <p role="alert" className="mt-2">{form.estimateError}</p>}
        </div>
        {form.error && <p role="alert" className="rounded-md border p-4 text-sm">{form.error} <Link href="/bookings" className="underline">My bookings</Link></p>}
        <Button type="submit" className="min-h-11 w-full" disabled={form.busy || !!form.estimateError}>{form.busy ? "Submitting request…" : inspectionOnly ? "Request on-site inspection" : "Submit booking request"}</Button>
      </fieldset>
    </form>
  </main>;
}






