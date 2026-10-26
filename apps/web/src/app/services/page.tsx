import { Suspense } from "react";
import { CategoryDetail } from "@/components/category-detail";
export default function ServicesPage() {
  return <Suspense fallback={<main className="p-8" role="status">Loading service…</main>}><CategoryDetail /></Suspense>;
}
