"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function CategoryFilter({
  active,
  categories,
}: {
  active?: string;
  categories: string[];
}) {
  const searchParams = useSearchParams();

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/"
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          !active
            ? "bg-blue-600 text-white"
            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
        }`}
      >
        Todas
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat}
          href={`/?category=${encodeURIComponent(cat)}`}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            active === cat
              ? "bg-blue-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          }`}
        >
          {cat}
        </Link>
      ))}
    </div>
  );
}
