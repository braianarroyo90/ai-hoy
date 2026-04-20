"use client";

import Image from "next/image";
import Link from "next/link";
import { Article } from "@/lib/supabase";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "hace menos de 1h";
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

export default function ArticleCard({ article }: { article: Article }) {
  const href = article.slug ? `/articulo/${article.slug}` : article.source_url;
  const isInternal = !!article.slug;

  const content = (
    <>
      {article.og_image && (
        <div className="relative h-44 w-full bg-zinc-800">
          <Image
            src={article.og_image}
            alt={article.es_title}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      <div className="flex flex-col gap-2 p-4 flex-1">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{article.source_name}</span>
          <span>{timeAgo(article.published_at)}</span>
        </div>

        <h2 className="text-sm font-semibold leading-snug text-zinc-100 group-hover:text-white line-clamp-3">
          {article.es_title}
        </h2>

        <p className="text-xs text-zinc-400 leading-relaxed line-clamp-4">
          {article.es_summary}
        </p>

        <div className="mt-auto pt-2 flex flex-wrap gap-1">
          {article.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px]"
            >
              #{tag}
            </span>
          ))}
        </div>

        <span className="text-xs text-blue-400 mt-1">
          {isInternal ? "Leer análisis completo →" : "Leer artículo original →"}
        </span>
      </div>
    </>
  );

  const className = "group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-600 transition-colors overflow-hidden";

  return isInternal ? (
    <Link href={href} className={className}>{content}</Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{content}</a>
  );
}
