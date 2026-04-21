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

export default function ArticleCard({ article, size = "md" }: { article: Article; size?: "lg" | "md" | "sm" }) {
  const href = article.slug ? `/articulo/${article.slug}` : article.source_url;
  const isInternal = !!article.slug;

  const imageHeight = size === "lg" ? "h-36 sm:h-56" : size === "sm" ? "h-24 sm:h-32" : "h-32 sm:h-44";
  const titleSize = size === "lg" ? "text-sm sm:text-lg" : "text-xs sm:text-base";
  const summaryLines = size === "sm" ? "line-clamp-2" : "line-clamp-3 sm:line-clamp-4";

  const content = (
    <>
      {article.og_image ? (
        <div className={`relative ${imageHeight} w-full bg-zinc-800 overflow-hidden`}>
          <Image
            src={article.og_image}
            alt={article.es_title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-900/80 to-transparent" />
        </div>
      ) : (
        <div className={`${imageHeight} w-full bg-zinc-800/50 flex items-center justify-center`}>
          <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
        </div>
      )}

      <div className="flex flex-col gap-1.5 sm:gap-2 p-3 sm:p-4 flex-1">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{article.source_name}</span>
          <span>{timeAgo(article.published_at)}</span>
        </div>

        <h2 className={`${titleSize} font-semibold leading-snug text-zinc-100 group-hover:text-white line-clamp-3`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
          {article.es_title}
        </h2>

        <p className={`text-xs text-zinc-400 leading-relaxed ${summaryLines} hidden sm:block`}>
          {article.es_summary}
        </p>

        <div className="mt-auto pt-2 flex flex-wrap gap-1">
          {article.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 text-[10px]"
            >
              #{tag}
            </span>
          ))}
        </div>

        <span className="text-xs text-blue-400 mt-1 group-hover:text-blue-300 transition-colors">
          {isInternal ? "Leer análisis completo →" : "Leer artículo original →"}
        </span>
      </div>
    </>
  );

  const className = `group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:shadow-xl hover:shadow-black/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer ${size === "lg" ? "sm:col-span-2" : ""}`;

  return isInternal ? (
    <Link href={href} className={className}>{content}</Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{content}</a>
  );
}
