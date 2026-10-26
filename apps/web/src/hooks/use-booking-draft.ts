"use client";
import { useEffect, useRef, useState } from "react";
import {
  bookingRequestSchema, diagnosticBookingPrefillSchema, DIAGNOSTIC_PREFILL_STORAGE_KEY, DURATION_OPTIONS, formatNpr, locationPreferenceSchema, locationToAddress, nepalDateTimeToIso,
  defaultNepalSchedule, estimateLabourPaisa, bookingErrorMessage, LOCATION_STORAGE_KEY,
  PROFESSIONAL_PAGE_SIZE, type ServiceCategory, type PublicProfessional, type WorkflowBooking, type LocationPreference, type MapPin,
} from "@tirkha/shared";
import { loadCategories, loadProfessionals } from "../lib/discovery";
import { createBooking } from "../lib/bookings";

function diagnosticJobDetails(prefill: ReturnType<typeof diagnosticBookingPrefillSchema.parse>) {
  const { diagnostic, duration_minutes: duration } = prefill;
  return [
    "AI-assisted triage only; not a confirmed diagnosis or price.",
    `Reported symptom: ${diagnostic.symptom}`,
    `Limited finding: ${diagnostic.issue_title}`,
    diagnostic.diagnostic_code ? `Supported triage route: ${diagnostic.diagnostic_code} (not a confirmed component failure)` : "",
    diagnostic.visual_defect ? `Visible observation: ${diagnostic.visual_defect}` : "",
    diagnostic.visual_material ? `Visible material: ${diagnostic.visual_material}` : "",
    diagnostic.visual_mounting ? `Mounting observation: ${diagnostic.visual_mounting}` : "",
    ...(diagnostic.visual_evidence ?? []).map(entry => `Image evidence: ${entry}`),
    diagnostic.root_cause_hypothesis ? `Unconfirmed cause to verify: ${diagnostic.root_cause_hypothesis}` : "",
    `Triage note: ${diagnostic.explanation}`,
    diagnostic.area ? `Area / landmark: ${diagnostic.area}` : "",
    diagnostic.preferred_time ? `Preferred time: ${diagnostic.preferred_time} (confirm the exact Nepal date and time below)` : "",
    diagnostic.urgency !== "routine" ? `Triage urgency: ${diagnostic.urgency}` : "",
    diagnostic.safety_note ? `Safety note: ${diagnostic.safety_note}` : "",
    diagnostic.photo_assessed ? "A photo informed visual observations only; the image itself is not attached." : "",
    `Requested appointment duration: ${duration} minutes. Price is quote pending; an on-site inspection and written quote with customer approval are required before repair.`,
  ].filter(Boolean).join("\n").slice(0, 2000);
}
export function useBookingDraft(initialSlug = "", inspectionOnly = false) {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [professionals, setProfessionals] = useState<{ category: string; items: PublicProfessional[] }>({ category: "", items: [] });
  const [proPage, setProPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [proLoading, setProLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataAttempt, setDataAttempt] = useState(0);
  const [dataError, setDataError] = useState("");
  const [error, setError] = useState("");
  const [location, setLocation] = useState<LocationPreference & { ward: string }>({ municipality: "", ward: "", landmark: "" });
  const [savedLocation, setSavedLocation] = useState<LocationPreference | null>(null);
  const [schedule, setSchedule] = useState(defaultNepalSchedule);
  const [duration, setDuration] = useState(60);
  const [details, setDetails] = useState("");
  const [diagnostic, setDiagnostic] = useState<ReturnType<typeof diagnosticBookingPrefillSchema.parse>["diagnostic"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<WorkflowBooking | null>(null);
  const busyRef = useRef(false);
  const requestRef = useRef<{ signature: string; id: string } | null>(null);
  const selectedCategory = categories.find((item) => item.id === categoryId);
  const choices = professionals.category === categoryId ? professionals.items : [];
  const selectedProfessional = choices.find((item) => item.profile_id === professionalId);
  let estimate: number | null = null;
  let estimateError = "";
  try { estimate = inspectionOnly ? null : estimateLabourPaisa(selectedProfessional?.hourly_rate_paisa ?? null, duration); }
  catch { estimateError = "Choose a shorter duration; this estimate exceeds the supported amount."; }

  useEffect(() => {
    let active = true; setLoading(true); setDataError("");
    void loadCategories().then((data) => {
      if (!active) return;
      setCategories(data);
      setCategoryId((current) => current || data.find((item) => item.slug === initialSlug)?.id || "");
    }).catch(() => { if (active) setDataError("Could not load services. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialSlug, dataAttempt]);
  useEffect(() => {
    let active = true;
    let prefill: ReturnType<typeof diagnosticBookingPrefillSchema.parse> | null = null;
    try {
      const raw = sessionStorage.getItem(DIAGNOSTIC_PREFILL_STORAGE_KEY);
      if (raw) {
        const result = diagnosticBookingPrefillSchema.safeParse(JSON.parse(raw));
        if (result.success) {
          prefill = result.data;
          setDiagnostic(result.data.diagnostic);
          setDetails(diagnosticJobDetails(result.data));
          if ((DURATION_OPTIONS as readonly number[]).includes(result.data.duration_minutes)) setDuration(result.data.duration_minutes);
        }
      }
    } catch { /* Invalid or unavailable session storage does not block manual booking. */ }
    void (async () => {
      try {
        const raw = await Promise.resolve(localStorage.getItem(LOCATION_STORAGE_KEY));
        if (!active) return;
        if (raw) {
          const result = locationPreferenceSchema.safeParse(JSON.parse(raw));
          if (result.success) {
            setSavedLocation(result.data);
            setLocation({ ...result.data, ward: result.data.ward || "", landmark: prefill?.diagnostic.area || result.data.landmark });
          } else if (prefill?.diagnostic.area) setLocation(current => ({ ...current, landmark: prefill!.diagnostic.area! }));
        } else if (prefill?.diagnostic.area) setLocation(current => ({ ...current, landmark: prefill!.diagnostic.area! }));
      } catch { if (active && prefill?.diagnostic.area) setLocation(current => ({ ...current, landmark: prefill!.diagnostic.area! })); }
      finally { try { sessionStorage.removeItem(DIAGNOSTIC_PREFILL_STORAGE_KEY); } catch { /* The booking form remains editable without storage. */ } }
    })();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!selectedCategory) return;
    let active = true; setProLoading(true); setDataError("");
    const id = selectedCategory.id;
    void loadProfessionals(selectedCategory.slug, proPage * PROFESSIONAL_PAGE_SIZE).then((data) => {
      if (!active) return;
      setProfessionals((previous) => ({
        category: id, items: proPage === 0 || previous.category !== id ? data :
          [...new Map([...previous.items, ...data].map((item) => [item.profile_id, item])).values()],
      }));
      setHasMore(data.length === PROFESSIONAL_PAGE_SIZE);
    }).catch(() => { if (active) setDataError("Could not load professionals. Retry, or submit an unassigned request."); })
      .finally(() => { if (active) setProLoading(false); });
    return () => { active = false; };
  }, [selectedCategory?.id, selectedCategory?.slug, proPage, dataAttempt]);

  async function submit() {
    if (busyRef.current || created) return;
    setError("");
    try {
      if (!selectedCategory) throw new Error("Choose a service category.");
      if (professionalId && !selectedProfessional) throw new Error("Choose a listed professional, or an unassigned request.");
      if (estimateError) throw new Error(estimateError);
      const address = locationPreferenceSchema.safeParse(location);
      if (!address.success) throw new Error(address.error.issues[0].message);
      if (!address.data.map_pin) throw new Error("Drop a pin on the map so nearby Heroes can receive the exact service location.");
      const payload = {
        category_id: categoryId, professional_id: inspectionOnly ? null : professionalId || null,
        service_address: locationToAddress(address.data), job_details: inspectionOnly ? `${details.slice(0, 1750)}\n\nInspection request: no AI price or repair approval. Require an on-site inspection and written quote before work.` : details,
        latitude: address.data.map_pin?.latitude ?? null, longitude: address.data.map_pin?.longitude ?? null,
        resolved_address: address.data.map_pin?.resolved_address ?? null,
        diagnostic_summary: diagnostic ? ((diagnostic.diagnostic_code ? `[${diagnostic.diagnostic_code}] ` : "") + diagnostic.issue_title + ": " + diagnostic.explanation + (diagnostic.symptom ? " Customer reports: " + diagnostic.symptom : "")).slice(0, 1200) : undefined,
        diagnostic_severity: diagnostic?.severity || undefined,
        diagnostic_urgency: diagnostic?.urgency,
        suggested_parts: diagnostic?.suggested_parts ?? [],
        scheduled_at: nepalDateTimeToIso(schedule.date, schedule.time), duration_minutes: duration,
      };
      const signature = JSON.stringify(payload);
      if (requestRef.current?.signature !== signature) requestRef.current = { signature, id: crypto.randomUUID() };
      const parsed = bookingRequestSchema.safeParse({ ...payload, request_id: requestRef.current.id });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      busyRef.current = true; setBusy(true);
      try {
        const result = await createBooking(parsed.data);
        try { await Promise.resolve(localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(address.data))); } catch { /* A saved booking must not look failed because local storage failed. */ }
        setCreated(result);
      } catch (error) { setError(bookingErrorMessage(error)); }
      finally { busyRef.current = false; setBusy(false); }
    } catch (error) { setError(error instanceof Error ? error.message : "Check your booking details."); }
  }
  return {
    categories, categoryId, professionalId, choices, loading, proLoading, hasMore,
    dataError, error, location, savedLocation, schedule, duration, details, busy, created,
    estimate, estimateError, selectedProfessional,
    setPin(pin: MapPin | null) {
      setLocation((current) => ({
        ...current, map_pin: pin ?? undefined,
        municipality: pin?.resolved_address ? pin.resolved_address.slice(0, 100)
          : pin && current.map_pin?.resolved_address?.slice(0, 100) === current.municipality ? "" : current.municipality,
      }));
    },
    setLocation, setSchedule, setDuration, setDetails, setProfessionalId,
    changeCategory(id: string) { setCategoryId(id); setProfessionalId(""); setProPage(0); setProfessionals({ category: "", items: [] }); setHasMore(false); },
    useSavedLocation() { if (savedLocation) setLocation({ ...savedLocation, ward: savedLocation.ward || "" }); },
    loadMore() { setProPage((page) => page + 1); },
    retryData() { setDataAttempt((count) => count + 1); },
    submit,
  };
}





