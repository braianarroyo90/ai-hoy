import Link from "next/link";
import { supabase, Article } from "@/lib/supabase";
import { siteConfig } from "@/lib/site-config";
import ArticleCard from "@/components/ArticleCard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buscar",
  robots: "noindex",
};

async function search(q: string): Promise<Article[]> {
  if (!q || q.length < 2) return [];
  const { data } = await supabase
    .from("articles")
    .select("id, source_url, source_name, og_image, published_at, es_title, es_summary, tags, category, slug")
    .eq("status", "published")
    .or(`es_title.ilike.%${q}%,es_summary.ilike.%${q}%`)
    .order("published_at", { ascending: false })
    .limit(30);
  return (data ?? []) as Article[];
}

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = await search(q);
  const [first, ...rest] = siteConfig.name.split(" ");

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 px-4 sm:px-6 py-3 backdrop-blur-md bg-zinc-950/85">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight shrink-0" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            <span className="text-blue-400">{first}</span>{" "}{rest.join(" ")}
          </Link>
          <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">← Volver</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Barra de búsqueda */}
        <form method="GET" action="/buscar" className="mb-8">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar en todos los artículos..."
              autoFocus
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
            />
          </div>
        </form>

        {/* Resultados */}
        {q.length >= 2 ? (
          <>
            <p className="text-zinc-500 text-sm mb-6">
              {results.length > 0
                ? `${results.length} resultado${results.length !== 1 ? "s" : ""} para "${q}"`
                : `Sin resultados para "${q}"`}
            </p>
            {results.length > 0 && (
              <div className="grid gap-3 sm:gap-5 grid-cols-2 lg:grid-cols-3">
                {results.map((a) => (
                  <ArticleCard key={a.id} article={a} size="md" />
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-zinc-600 text-sm text-center mt-16">
            Escribí al menos 2 caracteres para buscar.
          </p>
        )}
      </div>
    </main>
  );
}
