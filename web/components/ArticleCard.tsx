"use client";

import Image from "next/image";
import Link from "next/link";
import { Article } from "@/lib/supabase";

const CATEGORY_GRADIENTS: Record<string, string> = {
  "Modelos y LLMs":        "from-blue-950 via-blue-900/60 to-zinc-900",
  "Herramientas y Productos": "from-violet-950 via-violet-900/60 to-zinc-900",
  "Investigación":         "from-teal-950 via-teal-900/60 to-zinc-900",
  "Empresas y Negocios":   "from-amber-950 via-amber-900/60 to-zinc-900",
  "Política y Ética":      "from-red-950 via-red-900/60 to-zinc-900",
  "Robótica":              "from-cyan-950 via-cyan-900/60 to-zinc-900",
  "Agentes de IA":         "from-green-950 via-green-900/60 to-zinc-900",
  "Diseño e IA":           "from-pink-950 via-pink-900/60 to-zinc-900",
};

const CATEGORY_ICONS: Record<string, string> = {
  "Modelos y LLMs":        "🧠",
  "Herramientas y Productos": "🛠️",
  "Investigación":         "🔬",
  "Empresas y Negocios":   "📈",
  "Política y Ética":      "⚖️",
  "Robótica":              "🤖",
  "Agentes de IA":         "🤖",
  "Diseño e IA":           "🎨",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "hace menos de 1h";
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function readingTime(text: string): string {
  const words = text.trim().split(/\s+/).length;
  const mins  = Math.max(1, Math.round(words / 200));
  return `${mins} min`;
}

export default function ArticleCard({ article, size = "md" }: { article: Article; size?: "lg" | "md" | "sm" }) {
  const href       = article.slug ? `/articulo/${article.slug}` : article.source_url;
  const isInternal = !!article.slug;
  const showSummary = size !== "sm";

  const imageHeight = size === "lg" ? "h-36 sm:h-56" : size === "sm" ? "h-24 sm:h-32" : "h-32 sm:h-44";
  const titleSize   = size === "lg" ? "text-sm sm:text-lg" : "text-xs sm:text-base";
  const summaryClamp = size === "lg" ? "line-clamp-3" : "line-clamp-2";

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
        <div className={`${imageHeight} w-full bg-gradient-to-br ${CATEGORY_GRADIENTS[article.category] ?? "from-zinc-900 via-zinc-800/60 to-zinc-900"} flex flex-col items-center justify-center gap-2 relative overflow-hidden`}>
          <span className="text-3xl opacity-40 select-none">
            {CATEGORY_ICONS[article.category] ?? "📰"}
          </span>
          <p className="text-zinc-500 text-[10px] font-medium tracking-widest uppercase px-4 text-center line-clamp-2">
            {article.category ?? article.source_name}
          </p>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.4)_100%)]" />
        </div>
      )}

      <div className="flex flex-col gap-1.5 sm:gap-2 p-3 sm:p-4 flex-1">
        {/* Meta row */}
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{article.source_name}</span>
          <div className="flex items-center gap-2">
            {article.es_summary && (
              <span className="text-zinc-600">{readingTime(article.es_summary)}</span>
            )}
            <span>{timeAgo(article.published_at)}</span>
          </div>
        </div>

        {/* Title */}
        <h2
          className={`${titleSize} font-semibold leading-snug text-zinc-100 group-hover:text-white line-clamp-3`}
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          {article.es_title}
        </h2>

        {/* Summary — always visible for md/lg */}
        {showSummary && article.es_summary && (
          <p className={`text-xs text-zinc-400 leading-relaxed ${summaryClamp}`}>
            {article.es_summary}
          </p>
        )}

        {/* Tags */}
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
