import { supabase } from "@/lib/supabase";
import { MetadataRoute } from "next";

const BASE_URL = "https://ai-hoy.vercel.app";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await supabase
    .from("articles")
    .select("id, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1000);

  const articleUrls = (data ?? []).map((a) => ({
    url: `${BASE_URL}/?id=${a.id}`,
    lastModified: new Date(a.published_at),
    changeFrequency: "never" as const,
    priority: 0.7,
  }));

  const categories = [
    "Modelos y LLMs",
    "Herramientas y Productos",
    "Investigación",
    "Empresas y Negocios",
    "Política y Ética",
    "Robótica",
    "Agentes de IA",
    "Diseño e IA",
  ];

  const categoryUrls = categories.map((cat) => ({
    url: `${BASE_URL}/?category=${encodeURIComponent(cat)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    ...categoryUrls,
    ...articleUrls,
  ];
}
