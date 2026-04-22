import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase, Article } from "@/lib/supabase";
import { siteConfig } from "@/lib/site-config";
import ArticleCard from "@/components/ArticleCard";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateStaticParams() {
  const { data } = await supabase
    .from("articles")
    .select("tags")
    .eq("status", "published")
    .limit(500);

  const tagSet = new Set<string>();
  (data ?? []).forEach((a) => (a.tags ?? []).forEach((t: string) => tagSet.add(t)));
  return Array.from(tagSet).map((tag) => ({ tag: encodeURIComponent(tag) }));
}

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params;
  const label = decodeURIComponent(tag);
  return {
    title: `#${label} — ${siteConfig.name}`,
    description: `Todas las noticias sobre ${label} en español. Análisis, novedades y cobertura actualizada.`,
    openGraph: {
      title: `#${label} — ${siteConfig.name}`,
      description: `Todas las noticias sobre ${label} en español.`,
    },
  };
}

async function getTagArticles(tag: string): Promise<{ articles: Article[]; total: number }> {
  const { data, count } = await supabase
    .from("articles")
    .select("id, source_url, source_name, og_image, published_at, es_title, es_summary, tags, category, slug", { count: "exact" })
    .eq("status", "published")
    .contains("tags", [tag])
    .order("published_at", { ascending: false })
    .limit(40);
  return { articles: (data ?? []) as Article[], total: count ?? 0 };
}

function getCardSize(i: number): "lg" | "md" | "sm" {
  const pos = i % 7;
  if (pos === 0 || pos === 6) return "lg";
  if (pos === 1 || pos === 5) return "sm";
  return "md";
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const label = decodeURIComponent(tag);

  const { articles, total } = await getTagArticles(label);
  if (!articles.length) notFound();

  const [first, ...rest] = siteConfig.name.split(" ");

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 px-4 sm:px-6 py-3 backdrop-blur-md bg-zinc-950/85">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight shrink-0" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            <span className="text-blue-400">{first}</span>{" "}{rest.join(" ")}
          </Link>
          <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">← Inicio</Link>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-zinc-800/60 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-2">Tema</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            #{label}
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base max-w-2xl leading-relaxed mb-4">
            Todas las noticias sobre <span className="text-white font-medium">{label}</span> en español, ordenadas por fecha.
          </p>
          <span className="text-zinc-600 text-xs">{total} artículo{total !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid gap-3 sm:gap-5 grid-cols-2 lg:grid-cols-3">
          {articles.map((a, i) => (
            <ArticleCard key={a.id} article={a} size={getCardSize(i)} />
          ))}
        </div>
      </div>
    </main>
  );
}
