import { supabase } from "@/lib/supabase";
import { siteConfig } from "@/lib/site-config";
import { categoryToSlug } from "@/lib/categories";
import { MetadataRoute } from "next";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await supabase
    .from("articles")
    .select("slug, published_at, tags")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1000);

  const articles = data ?? [];

  const articleUrls: MetadataRoute.Sitemap = articles
    .filter((a) => a.slug)
    .map((a) => ({
      url: `${siteConfig.url}/articulo/${a.slug}`,
      lastModified: new Date(a.published_at),
      changeFrequency: "never" as const,
      priority: 0.7,
    }));

  const categoryUrls: MetadataRoute.Sitemap = siteConfig.categories.map((cat) => ({
    url: `${siteConfig.url}/categoria/${categoryToSlug(cat)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // collect unique tags across all articles
  const tagSet = new Set<string>();
  articles.forEach((a) => (a.tags ?? []).forEach((t: string) => tagSet.add(t)));
  const tagUrls: MetadataRoute.Sitemap = Array.from(tagSet).map((tag) => ({
    url: `${siteConfig.url}/tema/${encodeURIComponent(tag)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  return [
    {
      url: siteConfig.url,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${siteConfig.url}/radar`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...categoryUrls,
    ...tagUrls,
    ...articleUrls,
  ];
}
