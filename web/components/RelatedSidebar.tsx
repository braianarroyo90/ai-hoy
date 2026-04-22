import Link from "next/link";
import Image from "next/image";
import { supabase, Article } from "@/lib/supabase";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "hace menos de 1h";
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

async function getRelated(category: string, excludeSlug: string): Promise<Article[]> {
  const { data } = await supabase
    .from("articles")
    .select("id, source_url, source_name, og_image, published_at, es_title, es_summary, tags, category, slug")
    .eq("status", "published")
    .eq("category", category)
    .neq("slug", excludeSlug)
    .order("published_at", { ascending: false })
    .limit(5);
  return (data ?? []) as Article[];
}

export default async function RelatedSidebar({ category, excludeSlug }: { category: string; excludeSlug: string }) {
  const articles = await getRelated(category, excludeSlug);
  if (!articles.length) return null;

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 space-y-1">
        <p className="text-xs font-bold tracking-widest uppercase text-zinc-500 mb-4">
          Seguí leyendo
        </p>
        <div className="space-y-1">
          {articles.map((a) => {
            const href = a.slug ? `/articulo/${a.slug}` : a.source_url;
            return (
              <Link
                key={a.id}
                href={href}
                className="flex gap-3 p-3 rounded-xl hover:bg-zinc-800/60 transition-colors group"
              >
                {a.og_image ? (
                  <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-zinc-800">
                    <Image
                      src={a.og_image}
                      alt={a.es_title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-200"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 shrink-0 rounded-lg bg-zinc-800/60 flex items-center justify-center">
                    <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0 flex flex-col justify-between py-0.5">
                  <p className="text-sm font-medium text-zinc-200 group-hover:text-white leading-snug line-clamp-2">
                    {a.es_title}
                  </p>
                  <span className="text-xs text-zinc-600 mt-1">{timeAgo(a.published_at)}</span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="pt-4 border-t border-zinc-800/60 mt-4">
          <Link
            href={`/?category=${encodeURIComponent(category)}`}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Ver todo en {category} →
          </Link>
        </div>
      </div>
    </aside>
  );
}
