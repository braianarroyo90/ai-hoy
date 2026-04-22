import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase, Article } from "@/lib/supabase";
import { siteConfig } from "@/lib/site-config";
import { slugToCategory, categoryToSlug, CATEGORY_DESCRIPTIONS } from "@/lib/categories";
import ArticleCard from "@/components/ArticleCard";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateStaticParams() {
  return siteConfig.categories.map((cat) => ({ slug: categoryToSlug(cat) }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = slugToCategory(slug, siteConfig.categories);
  if (!category) return {};
  const desc = CATEGORY_DESCRIPTIONS[category] ?? `Noticias de ${category} en español.`;
  return {
    title: `${category} — ${siteConfig.name}`,
    description: desc,
    openGraph: { title: `${category} — ${siteConfig.name}`, description: desc },
  };
}

async function getCategoryArticles(category: string): Promise<{ articles: Article[]; total: number }> {
  const { data, count } = await supabase
    .from("articles")
    .select("id, source_url, source_name, og_image, published_at, es_title, es_summary, tags, category, slug", { count: "exact" })
    .eq("status", "published")
    .eq("category", category)
    .order("published_at", { ascending: false })
    .limit(30);
  return { articles: (data ?? []) as Article[], total: count ?? 0 };
}

function getCardSize(i: number): "lg" | "md" | "sm" {
  const pos = i % 7;
  if (pos === 0 || pos === 6) return "lg";
  if (pos === 1 || pos === 5) return "sm";
  return "md";
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = slugToCategory(slug, siteConfig.categories);
  if (!category) notFound();

  const { articles, total } = await getCategoryArticles(category);
  const description = CATEGORY_DESCRIPTIONS[category] ?? `Noticias de ${category} en español.`;
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

      {/* Hero de categoría */}
      <div className="border-b border-zinc-800/60 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-2">Categoría</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            {category}
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base max-w-2xl leading-relaxed mb-4">
            {description}
          </p>
          <span className="text-zinc-600 text-xs">{total} artículo{total !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Otras categorías */}
      <div className="border-b border-zinc-800/40 bg-zinc-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {siteConfig.categories.filter((c) => c !== category).map((c) => (
            <Link
              key={c}
              href={`/categoria/${categoryToSlug(c)}`}
              className="shrink-0 px-3 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
            >
              {c}
            </Link>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {articles.length === 0 ? (
          <p className="text-zinc-500 text-center mt-20">No hay artículos en esta categoría todavía.</p>
        ) : (
          <div className="grid gap-3 sm:gap-5 grid-cols-2 lg:grid-cols-3">
            {articles.map((a, i) => (
              <ArticleCard key={a.id} article={a} size={getCardSize(i)} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
