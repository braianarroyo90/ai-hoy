import { supabase, Article } from "@/lib/supabase";
import ArticleCard from "./ArticleCard";

async function getRelated(category: string, excludeSlug: string): Promise<Article[]> {
  const { data } = await supabase
    .from("articles")
    .select("id, source_url, source_name, og_image, published_at, es_title, es_summary, tags, category, slug")
    .eq("status", "published")
    .eq("category", category)
    .neq("slug", excludeSlug)
    .order("published_at", { ascending: false })
    .limit(3);
  return (data ?? []) as Article[];
}

export default async function RelatedArticles({ category, excludeSlug }: { category: string; excludeSlug: string }) {
  const articles = await getRelated(category, excludeSlug);
  if (!articles.length) return null;

  return (
    <div className="mt-12 pt-8 border-t border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-widest mb-6">
        Seguí leyendo
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} size="sm" />
        ))}
      </div>
    </div>
  );
}
