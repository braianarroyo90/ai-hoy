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

function readingTime(text?: string): string {
  if (!text) return "";
  const words = text.trim().split(/\s+/).length;
  return `${Math.ceil(words / 200)} min de lectura`;
}

export default function HeroEditorial({ hero, headlines }: { hero: Article; headlines: Article[] }) {
  const href = hero.slug ? `/articulo/${hero.slug}` : hero.source_url;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
      {/* Hero principal */}
      <Link
        href={href}
        target={hero.slug ? undefined : "_blank"}
        rel={hero.slug ? undefined : "noopener noreferrer"}
        className="lg:col-span-2 group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:shadow-xl hover:shadow-black/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer"
      >
        {hero.og_image ? (
          <div className="relative h-64 sm:h-72 w-full bg-zinc-800 overflow-hidden">
            <Image
              src={hero.og_image}
              alt={hero.es_title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              unoptimized
            />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-900/90 to-transparent" />
          </div>
        ) : (
          <div className="h-64 sm:h-72 w-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
        )}
        <div className="p-5 flex flex-col gap-3">
          {hero.category && (
            <span className="text-xs font-medium text-blue-400">{hero.category}</span>
          )}
          <h2 className="text-2xl lg:text-3xl font-bold text-zinc-50 leading-snug group-hover:text-white" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            {hero.es_title}
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2">{hero.es_summary}</p>
          <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
            <span>{hero.source_name}</span>
            <span>·</span>
            <span>{timeAgo(hero.published_at)}</span>
            {hero.es_summary && <><span>·</span><span>{readingTime(hero.es_summary)}</span></>}
          </div>
        </div>
      </Link>

      {/* Titulares secundarios */}
      <div className="flex flex-col divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        {headlines.map((a) => {
          const h = a.slug ? `/articulo/${a.slug}` : a.source_url;
          return (
            <Link
              key={a.id}
              href={h}
              target={a.slug ? undefined : "_blank"}
              rel={a.slug ? undefined : "noopener noreferrer"}
              className="flex flex-col gap-1.5 p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer group"
            >
              {a.category && (
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">{a.category}</span>
              )}
              <h3 className="text-sm font-medium text-zinc-200 group-hover:text-white leading-snug line-clamp-3">
                {a.es_title}
              </h3>
              <span className="text-[10px] text-zinc-600">{timeAgo(a.published_at)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
