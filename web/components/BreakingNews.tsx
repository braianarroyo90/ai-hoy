import Link from "next/link";
import { Article } from "@/lib/supabase";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (m < 60) return `hace ${m}m`;
  return `hace ${h}h`;
}

export default function BreakingNews({ articles }: { articles: Article[] }) {
  if (!articles.length) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold tracking-widest uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Última hora
        </span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        {articles.map((a) => (
          <Link
            key={a.id}
            href={a.slug ? `/articulo/${a.slug}` : a.source_url}
            className="flex-1 flex items-start gap-3 p-3 rounded-xl border border-red-900/40 bg-red-950/20 hover:bg-red-950/30 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-200 leading-snug line-clamp-2">
                {a.es_title}
              </p>
              <span className="text-[10px] text-red-400 mt-1 block">{timeAgo(a.published_at)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
