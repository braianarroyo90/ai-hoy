import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { siteConfig } from "@/lib/site-config";
import RelatedArticles from "@/components/RelatedArticles";
import RelatedSidebar from "@/components/RelatedSidebar";
import ViewTracker from "@/components/ViewTracker";
import type { Metadata } from "next";

export const revalidate = 3600;

async function getArticle(slug: string) {
  const { data } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return {};
  return {
    title: article.es_title,
    description: article.es_summary,
    openGraph: {
      title: article.es_title,
      description: article.es_summary,
      images: article.og_image ? [article.og_image] : [],
      type: "article",
      publishedTime: article.published_at,
    },
    twitter: {
      card: "summary_large_image",
      title: article.es_title,
      description: article.es_summary,
      images: article.og_image ? [article.og_image] : [],
    },
  };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "hace menos de 1h";
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.es_title,
    description: article.es_summary,
    datePublished: article.published_at,
    image: article.og_image ?? undefined,
    inLanguage: siteConfig.lang,
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
  };

  const paragraphs = (article.es_body ?? article.es_summary ?? "")
    .split(/\n+/)
    .map((p: string) => p.trim())
    .filter(Boolean);

  return (
    <>
      <ViewTracker slug={article.slug} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-zinc-950 text-white">
        <header className="sticky top-0 z-50 border-b border-zinc-800/60 px-4 sm:px-6 py-3 backdrop-blur-md bg-zinc-950/85">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <Link href="/" className="text-xl font-bold tracking-tight hover:text-zinc-300 transition-colors shrink-0" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              <span className="text-blue-400">{siteConfig.name.split(" ")[0]}</span>{" "}
              {siteConfig.name.split(" ").slice(1).join(" ")}
            </Link>
            <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors truncate">
              ← Volver
            </Link>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 grid lg:grid-cols-[1fr_300px] gap-10">

          {/* Contenido principal */}
          <article>
            {article.category && (
              <Link
                href={`/?category=${encodeURIComponent(article.category)}`}
                className="inline-block px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-xs mb-4 hover:bg-zinc-700 transition-colors"
              >
                {article.category}
              </Link>
            )}

            <h1 className="text-2xl sm:text-3xl font-bold leading-snug text-white mb-4" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              {article.es_title}
            </h1>

            <div className="flex items-center gap-3 text-sm text-zinc-500 mb-6">
              <span>{article.source_name}</span>
              <span>·</span>
              <span>{timeAgo(article.published_at)}</span>
            </div>

            {article.og_image && (
              <div className="relative w-full h-64 sm:h-80 rounded-xl overflow-hidden mb-8 bg-zinc-800">
                <Image
                  src={article.og_image}
                  alt={article.es_title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}

            <div className="prose prose-invert prose-zinc max-w-none">
              {paragraphs.map((p: string, i: number) => (
                <p key={i} className="text-zinc-300 leading-7 mb-5 text-base sm:text-lg">
                  {p}
                </p>
              ))}
            </div>

            {article.tags?.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {article.tags.map((tag: string) => (
                  <span key={tag} className="px-2 py-1 rounded-full bg-zinc-800 text-zinc-400 text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Related al fondo — solo en mobile */}
            {article.category && article.slug && (
              <div className="lg:hidden">
                <RelatedArticles category={article.category} excludeSlug={article.slug} />
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-zinc-800 flex items-center justify-between flex-wrap gap-4">
              <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">
                ← Volver al inicio
              </Link>
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-zinc-900 font-medium text-sm hover:bg-zinc-100 transition-colors"
              >
                Leer artículo original en {article.source_name} →
              </a>
            </div>
          </article>

          {/* Sidebar sticky — solo en desktop */}
          {article.category && article.slug && (
            <RelatedSidebar category={article.category} excludeSlug={article.slug} />
          )}
        </div>
      </main>
    </>
  );
}
