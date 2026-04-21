import { supabase } from "@/lib/supabase";
import { siteConfig } from "@/lib/site-config";
import { MetadataRoute } from "next";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await supabase
    .from("articles")
    .select("id, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1000);

  const articleUrls = (data ?? []).map((a) => ({
    url: `${siteConfig.url}/?id=${a.id}`,
    lastModified: new Date(a.published_at),
    changeFrequency: "never" as const,
    priority: 0.7,
  }));

  const categoryUrls = siteConfig.categories.map((cat) => ({
    url: `${siteConfig.url}/?category=${encodeURIComponent(cat)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [
    {
      url: siteConfig.url,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    ...categoryUrls,
    ...articleUrls,
  ];
}
