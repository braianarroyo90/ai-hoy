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
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // sort by article count descending so the heaviest categories appear first
  const sorted = [...categories].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));

  return (
    <div className="sticky top-[68px] sm:top-[95px] z-40 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide">
          <Link
            href="/"
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              !active
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            }`}
          >
            Todas
            <span className={`text-[10px] font-normal ${!active ? "text-blue-200" : "text-zinc-600"}`}>
              {total}
            </span>
          </Link>

          {sorted.map((cat) => {
            const isActive = active === cat;
            const count    = counts[cat] ?? 0;
            const isHeavy  = count > 0 && count === Math.max(...Object.values(counts));
            return (
              <Link
                key={cat}
                href={`/?category=${encodeURIComponent(cat)}`}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : isHeavy
                    ? "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
              >
                {cat}
                {count > 0 && (
                  <span className={`text-[10px] font-normal ${isActive ? "text-blue-200" : "text-zinc-500"}`}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
