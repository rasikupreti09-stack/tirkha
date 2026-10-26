"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ServiceCategory } from "@tirkha/shared";
import { loadCategories } from "@/lib/discovery";
import { CategoryIcon } from "./category-icon";
import { Button } from "./ui/button";

export function CategoryGrid() {
  const [categories, setCategories] = useState<ServiceCategory[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setCategories(null); setError("");
    void loadCategories().then((data) => { if (active) setCategories(data); }).catch(() => {
      if (active) setError("Services could not be loaded. Please try again shortly.");
    });
    return () => { active = false; };
  }, [attempt]);
  if (error) return <div role="alert" className="rounded-lg border p-6"><p>{error}</p><Button variant="outline" className="mt-4" onClick={() => setAttempt((count) => count + 1)}>Try again</Button></div>;
  if (!categories) return <p role="status" className="py-8 text-muted-foreground">Loading services…</p>;
  if (!categories.length) return <p className="rounded-lg border p-6">Service categories are being prepared. Please check back soon.</p>;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {categories.map((category) => <Link key={category.id} href={`/services?category=${encodeURIComponent(category.slug)}`}
      className="group rounded-lg border bg-card p-6 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="mb-5 text-primary"><CategoryIcon name={category.icon_name} /></div>
      <h3 className="text-lg font-semibold">{category.name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{category.description || "Explore professionals for this service."}</p>
      <p className="mt-5 text-sm font-medium underline underline-offset-4">View professionals</p>
    </Link>)}
  </div>;
}
