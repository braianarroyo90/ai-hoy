import Link from "next/link";
import { supabase, Article } from "@/lib/supabase";
import ArticleCard from "@/components/ArticleCard";
import CategoryNav from "@/components/CategoryNav";
import HeroEditorial from "@/components/HeroEditorial";
import NewsTicker from "@/components/NewsTicker";
import ShortsSection from "@/components/ShortsSection";

export const revalidate = 3600;

const PAGE_SIZE = 30;

const CATEGORIES = [
  "Modelos y LLMs",
  "Herramientas y Productos",
  "Investigación",
  "Empresas y Negocios",
  "Política y Ética",
  "Robótica",
  "Agentes de IA",
  "Diseño e IA",
];

async function getArticles(category?: string, page = 1): Promise<{ articles: Article[]; total: number }> {
  const from = (page - 1) * PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1;

  let query = supabase
    .from("articles")
    .select("id, source_url, source_name, og_image, published_at, es_title, es_summary, tags, category, slug", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(from, to);

  if (category) query = query.eq("category", category);

  const { data, error, count } = await query;
  if (error) { console.error(error); return { articles: [], total: 0 }; }
  return { articles: (data ?? []) as Article[], total: count ?? 0 };
}

async function getCategoryCounts(): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("articles")
    .select("category")
    .eq("status", "published");

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const c = row.category || "Sin categoría";
    counts[c] = (counts[c] ?? 0) + 1;
  }
  return counts;
}

// Repeating editorial pattern every 7 cards (after hero block):
// [lg][sm] / [md][md][md] / [sm][lg]
function getCardSize(i: number): "lg" | "md" | "sm" {
  const pos = i % 7;
  if (pos === 0 || pos === 6) return "lg";
  if (pos === 1 || pos === 5) return "sm";
  return "md";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const params   = await searchParams;
  const category = params.category;
  const page     = Math.max(1, parseInt(params.page ?? "1", 10));

  const [{ articles, total }, counts, shortsData] = await Promise.all([
    getArticles(category, page),
    getCategoryCounts(),
    supabase
      .from("youtube_shorts")
      .select("id, title, channel, thumbnail, published_at")
      .order("published_at", { ascending: false })
      .limit(20),
  ]);
  const MOCK_SHORTS = [
    { id: "dQw4w9WgXcQ", title: "Video de prueba — los reales cargan desde Supabase", channel: "AI Hoy", thumbnail: "", published_at: new Date().toISOString() },
  ];
  const shorts = ((shortsData.data ?? []) as { id: string; title: string; channel: string; thumbnail: string; published_at: string }[]);
  const shortsToShow = shorts.length > 0 ? shorts : MOCK_SHORTS;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Hero must have an image — pick the first article that does
  const heroIndex     = articles.findIndex((a) => !!a.og_image);
  const heroArticle   = heroIndex !== -1 ? articles[heroIndex] : null;
  const rest          = heroArticle ? articles.filter((_, i) => i !== heroIndex) : articles;
  const headlineList  = rest.slice(0, 4);
  const gridArticles  = rest.slice(4);
  const showHero      = !category && page === 1 && !!heroArticle;

  function pageUrl(p: number) {
    const q = new URLSearchParams();
    if (category) q.set("category", category);
    if (p > 1) q.set("page", String(p));
    return `/?${q.toString()}`;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AI Hoy",
    url: "https://ai-hoy.vercel.app",
    description: "Las mejores noticias de inteligencia artificial en español",
    inLanguage: "es",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://ai-hoy.vercel.app/?category={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-zinc-950 text-white">
        <header className="sticky top-0 z-50 backdrop-blur-md bg-zinc-950/85">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-800/60">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                <span className="text-blue-400">AI</span> Hoy
              </h1>
              <p className="text-zinc-400 text-xs sm:text-sm mt-0.5 hidden sm:block">
                Noticias de inteligencia artificial en español
              </p>
            </div>
          </div>
          <NewsTicker articles={articles.slice(0, 12).map(a => ({ slug: a.slug ?? null, source_url: a.source_url, es_title: a.es_title }))} />
        </header>

        <CategoryNav active={category} categories={CATEGORIES} counts={counts} />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {articles.length === 0 ? (
            <p className="text-zinc-500 text-center mt-20">
              No hay artículos todavía. El pipeline corre cada 6 horas.
            </p>
          ) : (
            <>
              {showHero && (
                <HeroEditorial hero={heroArticle} headlines={headlineList} />
              )}

              <div className="mt-2 grid gap-3 sm:gap-5 grid-cols-2 lg:grid-cols-3">
                {(showHero ? gridArticles : articles).map((a, i) => (
                  <>
                    {!category && page === 1 && i === 6 && (
                      <div key="shorts" className="col-span-full">
                        <ShortsSection shorts={shortsToShow} />
                      </div>
                    )}
                    <ArticleCard key={a.id} article={a} size={getCardSize(i)} />
                  </>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-3">
                  {page > 1 && (
                    <Link
                      href={pageUrl(page - 1)}
                      className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm transition-colors"
                    >
                      ← Anterior
                    </Link>
                  )}
                  <span className="text-zinc-500 text-sm">
                    Página {page} de {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link
                      href={pageUrl(page + 1)}
                      className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm transition-colors"
                    >
                      Siguiente →
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
