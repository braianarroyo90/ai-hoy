"use client";

import Link from "next/link";

export default function CategoryNav({
  active,
  categories,
  counts,
}: {
  active?: string;
  categories: string[];
  counts: Record<string, number>;
}) {
  return (
    <div className="sticky top-[68px] sm:top-[95px] z-40 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide">
          <Link
            href="/"
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !active ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            }`}
          >
            Todas
            <span className={`text-[10px] ${!active ? "text-blue-200" : "text-zinc-600"}`}>
              {Object.values(counts).reduce((a, b) => a + b, 0)}
            </span>
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/?category=${encodeURIComponent(cat)}`}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                active === cat ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              }`}
            >
              {cat}
              {counts[cat] && (
                <span className={`text-[10px] ${active === cat ? "text-blue-200" : "text-zinc-600"}`}>
                  {counts[cat]}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
