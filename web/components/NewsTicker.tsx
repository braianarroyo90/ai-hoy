"use client";

import Link from "next/link";

interface TickerArticle {
  slug: string | null;
  source_url: string;
  es_title: string;
}

export default function NewsTicker({ articles }: { articles: TickerArticle[] }) {
  if (!articles.length) return null;

  // Duplicate list so the scroll loops seamlessly
  const items = [...articles, ...articles];

  return (
    <div className="border-y border-zinc-700/50 bg-zinc-800/70 overflow-hidden">
      <div className="flex items-center">
        <span className="shrink-0 px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase text-blue-400 border-r border-zinc-800">
          Últimas
        </span>
        <div className="overflow-hidden flex-1 mask-fade-x">
          <div className="flex gap-0 animate-ticker whitespace-nowrap">
            {items.map((a, i) => {
              const href = a.slug ? `/articulo/${a.slug}` : a.source_url;
              const isInternal = !!a.slug;
              return (
                <span key={i} className="inline-flex items-center gap-3">
                  {isInternal ? (
                    <Link
                      href={href}
                      className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer px-4 py-1.5"
                    >
                      {a.es_title}
                    </Link>
                  ) : (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer px-4 py-1.5"
                    >
                      {a.es_title}
                    </a>
                  )}
                  <span className="text-zinc-700 select-none">·</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
