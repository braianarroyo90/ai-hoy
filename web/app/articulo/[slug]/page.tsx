import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
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
    inLanguage: "es",
    publisher: {
      "@type": "Organization",
      name: "AI Hoy",
      url: "https://ai-hoy.vercel.app",
    },
  };

  const paragraphs = (article.es_body ?? article.es_summary ?? "")
    .split(/\n+/)
    .map((p: string) => p.trim())
    .filter(Boolean);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-zinc-950 text-white">
        <header className="border-b border-zinc-800 px-6 py-5">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-tight hover:text-zinc-300 transition-colors">
              AI Hoy
            </Link>
            <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">
              ← Volver al inicio
            </Link>
          </div>
        </header>

        <article className="max-w-3xl mx-auto px-6 py-10">
          {article.category && (
            <Link
              href={`/?category=${encodeURIComponent(article.category)}`}
              className="inline-block px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-xs mb-4 hover:bg-zinc-700 transition-colors"
            >
              {article.category}
            </Link>
          )}

          <h1 className="text-2xl sm:text-3xl font-bold leading-snug text-white mb-4">
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
              <p key={i} className="text-zinc-300 leading-relaxed mb-4 text-base sm:text-lg">
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

          <div className="mt-10 pt-6 border-t border-zinc-800">
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
      </main>
    </>
  );
}
