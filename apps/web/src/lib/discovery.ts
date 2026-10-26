import { categorySlugSchema, serviceCategorySchema, publicProfessionalSchema, PROFESSIONAL_PAGE_SIZE } from "@tirkha/shared";
import { getSupabase } from "./supabase";

export async function loadCategories() {
  const { data, error } = await getSupabase().from("service_categories").select("*").order("name");
  if (error) throw error;
  return serviceCategorySchema.array().parse(data);
}
export async function loadCategory(slug: string) {
  const validSlug = categorySlugSchema.parse(slug);
  const { data, error } = await getSupabase().from("service_categories").select("*").eq("slug", validSlug).maybeSingle();
  if (error) throw error;
  return data === null ? null : serviceCategorySchema.parse(data);
}
export async function loadProfessionals(slug: string, offset: number) {
  const { data, error } = await getSupabase().rpc("list_verified_professionals", {
    p_category_slug: categorySlugSchema.parse(slug), p_limit: PROFESSIONAL_PAGE_SIZE, p_offset: offset,
  });
  if (error) throw error;
  return publicProfessionalSchema.array().parse(data);
}
