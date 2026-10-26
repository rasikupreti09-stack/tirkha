"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Star } from "lucide-react";
import { categorySlugSchema, hourlyRateLabel, PROFESSIONAL_PAGE_SIZE, type ServiceCategory, type PublicProfessional } from "@tirkha/shared";
import { loadCategory, loadProfessionals } from "@/lib/discovery";
import { Button } from "./ui/button";
import { CategoryIcon } from "./category-icon";
import { LandmarkPicker } from "./landmark-picker";

export function CategoryDetail() {
  const params = useSearchParams();
  const slug = params.get("category") || "";
  // Remount pagination when the query changes, so old-category data never flashes.
  return <CategoryResults key={slug} slug={slug} />;
}
function CategoryResults({ slug }: { slug: string }) {
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [professionals, setProfessionals] = useState<PublicProfessional[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    if (!categorySlugSchema.safeParse(slug).success) { setCategory(null); setProfessionals([]); setLoading(false); return; }
    void Promise.all([loadCategory(slug), loadProfessionals(slug, page * PROFESSIONAL_PAGE_SIZE)])
      .then(([category, people]) => { if (active) { setCategory(category); setProfessionals(people); } })
      .catch(() => { if (active) setError("We could not load this service. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, page, attempt]);
  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-8">
    <Link href="/explore" className="font-medium underline underline-offset-4">← All services</Link>
    {loading ? <p role="status" className="mt-8">Loading professionals…</p> : error ? <div role="alert" className="mt-8"><p>{error}</p><Button className="mt-4" onClick={() => setAttempt((value) => value + 1)}>Try again</Button></div>
      : !category ? <section className="mt-8"><h1 className="text-2xl font-semibold">Service not found</h1><p className="mt-2 text-muted-foreground">Choose a category from all services.</p></section> : <>
        <header className="mt-10"><CategoryIcon name={category.icon_name} /><h1 className="mt-4 text-3xl font-semibold sm:text-4xl">{category.name}</h1><p className="mt-3 max-w-2xl text-muted-foreground">{category.description}</p></header>
        <LandmarkPicker /><Button asChild className="mb-6"><Link href={`/book?category=${encodeURIComponent(slug)}`}>Request this service</Link></Button>
        <h2 className="mb-2 text-2xl font-semibold">Verified professionals</h2>
        <p className="mb-6 text-sm text-muted-foreground">Hourly rates are estimates for labour. Confirm service area, materials, and the final quote before booking.</p>
        {!professionals.length ? <div className="rounded-lg border bg-card p-6">
          <p>{page === 0 ? "No verified professionals are listed in this category yet." : "You have reached the end of the listings."}</p>
          <p className="mt-2 text-sm text-muted-foreground">Check back soon or explore another service.</p>
        </div> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {professionals.map((professional) => <article key={professional.profile_id} className="rounded-lg border bg-card p-6">
            <p className="mb-4 flex items-center gap-2 text-sm font-medium"><BadgeCheck aria-hidden="true" className="size-5" />Verified professional</p>
            <h3 className="text-xl font-semibold">{professional.full_name || "Tirkha professional"}</h3>
            <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">{professional.bio || "No introduction provided."}</p>
            <p className="mt-5 flex items-center gap-2 text-sm"><Star aria-hidden="true" className="size-4" />{professional.rating > 0 ? `${professional.rating.toFixed(1)} / 5` : "New professional"}</p>
            <p className="mt-4 text-lg font-semibold">{hourlyRateLabel(professional.hourly_rate_paisa)}</p>
          </article>)}
        </div>}
        <nav aria-label="Professional pages" className="mt-6 flex items-center gap-4">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button>
          <span className="text-sm">Page {page + 1}</span>
          <Button variant="outline" disabled={professionals.length < PROFESSIONAL_PAGE_SIZE || (page + 1) * PROFESSIONAL_PAGE_SIZE > 10000} onClick={() => setPage((value) => value + 1)}>Next</Button>
        </nav>
      </>}
  </main>;
}

