import Link from "next/link";
import { Article } from "@/lib/supabase";

export default function MostRead({ articles }: { articles: Article[] }) {
  if (!articles.length) return null;

  return (
    <div className="mb-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-bold tracking-widest uppercase text-orange-400">🔥 Lo más leído esta semana</span>
      </div>
      <ol className="space-y-3">
        {articles.map((a, i) => (
          <li key={a.id} className="flex items-start gap-3">
            <span className="text-2xl font-bold text-zinc-700 w-6 shrink-0 leading-tight">{i + 1}</span>
            <div className="min-w-0">
              <Link
                href={a.slug ? `/articulo/${a.slug}` : a.source_url}
                className="text-sm font-medium text-zinc-200 hover:text-white leading-snug line-clamp-2 block"
              >
                {a.es_title}
              </Link>
              <span className="text-xs text-zinc-600 mt-0.5 block">{a.category}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
