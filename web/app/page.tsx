import Link from "next/link";
import { supabase, Article } from "@/lib/supabase";
import ArticleCard from "@/components/ArticleCard";
import CategoryFilter from "@/components/CategoryFilter";

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
    .select("id, source_url, source_name, og_image, published_at, es_title, es_summary, tags, category", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(from, to);

  if (category) query = query.eq("category", category);

  const { data, error, count } = await query;
  if (error) { console.error(error); return { articles: [], total: 0 }; }
  return { articles: (data ?? []) as Article[], total: count ?? 0 };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const params   = await searchParams;
  const category = params.category;
  const page     = Math.max(1, parseInt(params.page ?? "1", 10));

  const { articles, total } = await getArticles(category, page);
  const totalPages = Math.ceil(total / PAGE_SIZE);

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
      <header className="border-b border-zinc-800 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Hoy</h1>
            <p className="text-zinc-400 text-sm mt-0.5">
              Las mejores noticias de inteligencia artificial, en español
            </p>
          </div>
          <span className="text-xs text-zinc-500">Actualizado cada 6h</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <CategoryFilter active={category} categories={CATEGORIES} />

        {articles.length === 0 ? (
          <p className="text-zinc-500 text-center mt-20">
            No hay artículos todavía. El pipeline corre cada 6 horas.
          </p>
        ) : (
          <>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => (
                <ArticleCard key={a.id} article={a} />
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
