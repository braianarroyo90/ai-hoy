import { supabase, Article } from "@/lib/supabase";
import ArticleCard from "@/components/ArticleCard";
import CategoryFilter from "@/components/CategoryFilter";

export const revalidate = 3600;

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

async function getArticles(category?: string): Promise<Article[]> {
  let query = supabase
    .from("articles")
    .select("id, source_url, source_name, og_image, published_at, es_title, es_summary, tags, category")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(30);

  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) { console.error(error); return []; }
  return (data ?? []) as Article[];
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const articles = await getArticles(category);

  return (
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
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
