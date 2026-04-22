import { supabase } from "@/lib/supabase";
import { siteConfig } from "@/lib/site-config";
import { NextResponse } from "next/server";

export const revalidate = 3600;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const { data } = await supabase
    .from("articles")
    .select("slug, es_title, es_summary, published_at, og_image, source_name, category, tags")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);

  const articles = data ?? [];

  const items = articles
    .filter((a) => a.slug)
    .map((a) => {
      const url = `${siteConfig.url}/articulo/${a.slug}`;
      const tags = (a.tags ?? []).map((t: string) => `<category>${escapeXml(t)}</category>`).join("");
      const image = a.og_image
        ? `<enclosure url="${escapeXml(a.og_image)}" type="image/jpeg" length="0" />`
        : "";
      return `
    <item>
      <title>${escapeXml(a.es_title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(a.es_summary ?? "")}</description>
      <pubDate>${new Date(a.published_at).toUTCString()}</pubDate>
      <source url="${siteConfig.url}">${escapeXml(siteConfig.name)}</source>
      ${a.category ? `<category>${escapeXml(a.category)}</category>` : ""}
      ${tags}
      ${image}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteConfig.name)}</title>
    <link>${siteConfig.url}</link>
    <description>${escapeXml(siteConfig.tagline)}</description>
    <language>${siteConfig.lang}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteConfig.url}/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
    },
  });
}
