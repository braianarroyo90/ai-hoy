import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { siteConfig } from "@/lib/site-config";
import type { Metadata } from "next";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: `Pulso de la comunidad — ${siteConfig.name}`,
  description: "Cómo está reaccionando la comunidad a las noticias de IA. Qué emociona, qué preocupa, qué parece hype.",
};

type ReactionRow = { reaction: string; count: number };
type ArticleReaction = {
  article_slug: string;
  reaction: string;
  count: number;
  articles: { es_title: string; slug: string; category: string } | null;
};

const REACTIONS = [
  { id: "fire",      emoji: "🔥", label: "Impresionante", color: "orange", bg: "bg-orange-950/40", border: "border-orange-800/40", text: "text-orange-400", bar: "bg-orange-500" },
  { id: "shocked",   emoji: "😱", label: "Preocupante",   color: "red",    bg: "bg-red-950/40",    border: "border-red-800/40",    text: "text-red-400",    bar: "bg-red-500"    },
  { id: "mindblown", emoji: "🤯", label: "No lo puedo creer", color: "violet", bg: "bg-violet-950/40", border: "border-violet-800/40", text: "text-violet-400", bar: "bg-violet-500" },
  { id: "boring",    emoji: "🥱", label: "Puro hype",     color: "zinc",   bg: "bg-zinc-800/40",   border: "border-zinc-700/40",   text: "text-zinc-400",   bar: "bg-zinc-500"   },
] as const;

async function getPulseData() {
  // global totals per reaction
  const { data: totals } = await supabase
    .from("reactions")
    .select("reaction, count");

  // top 3 articles per reaction (last 30 days), joined with article title
  const { data: top } = await supabase
    .from("reactions")
    .select("article_slug, reaction, count, articles!inner(es_title, slug, category)")
    .order("count", { ascending: false })
    .limit(40);

  const globalCounts: Record<string, number> = {};
  for (const row of (totals ?? []) as ReactionRow[]) {
    globalCounts[row.reaction] = (globalCounts[row.reaction] ?? 0) + row.count;
  }

  // group top articles per reaction (take top 3)
  const topByReaction: Record<string, ArticleReaction[]> = {};
  for (const row of (top ?? []) as ArticleReaction[]) {
    if (!row.articles) continue;
    if (!topByReaction[row.reaction]) topByReaction[row.reaction] = [];
    if (topByReaction[row.reaction].length < 3) {
      topByReaction[row.reaction].push(row);
    }
  }

  const totalReactions = Object.values(globalCounts).reduce((a, b) => a + b, 0);

  return { globalCounts, topByReaction, totalReactions };
}

function MoodBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  if (total === 0) return null;
  return (
    <div className="flex h-3 rounded-full overflow-hidden gap-px w-full">
      {REACTIONS.map(({ id, bar }) => {
        const pct = ((counts[id] ?? 0) / total) * 100;
        if (pct < 1) return null;
        return (
          <div
            key={id}
            className={`${bar} transition-all duration-700`}
            style={{ width: `${pct}%` }}
            title={`${Math.round(pct)}%`}
          />
        );
      })}
    </div>
  );
}

export default async function PulsePage() {
  const { globalCounts, topByReaction, totalReactions } = await getPulseData();
  const [first, ...rest] = siteConfig.name.split(" ");

  // dominant mood
  const dominant = REACTIONS.reduce((best, r) =>
    (globalCounts[r.id] ?? 0) > (globalCounts[best.id] ?? 0) ? r : best
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 px-4 sm:px-6 py-3 backdrop-blur-md bg-zinc-950/85">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight shrink-0" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            <span className="text-blue-400">{first}</span>{" "}{rest.join(" ")}
          </Link>
          <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">← Inicio</Link>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-zinc-800/60 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-3">Pulso de la comunidad</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            ¿Cómo le cae la IA a la gente?
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base max-w-2xl leading-relaxed mb-8">
            El estado de ánimo colectivo sobre las noticias de inteligencia artificial, construido con las reacciones de los lectores.
          </p>

          {totalReactions === 0 ? (
            <p className="text-zinc-600 text-sm">Todavía no hay reacciones. ¡Sé el primero en reaccionar a una noticia!</p>
          ) : (
            <div className="space-y-5 max-w-2xl">
              {/* Dominant mood */}
              <div className="flex items-center gap-3">
                <span className="text-4xl">{dominant.emoji}</span>
                <div>
                  <p className="text-white font-semibold text-lg">El ánimo dominante es <span className={dominant.text}>"{dominant.label}"</span></p>
                  <p className="text-zinc-500 text-sm">{totalReactions} reacciones totales de la comunidad</p>
                </div>
              </div>

              {/* Bar */}
              <MoodBar counts={globalCounts} total={totalReactions} />

              {/* Legend */}
              <div className="flex flex-wrap gap-4">
                {REACTIONS.map(({ id, emoji, label, text }) => {
                  const count = globalCounts[id] ?? 0;
                  const pct   = totalReactions > 0 ? Math.round((count / totalReactions) * 100) : 0;
                  return (
                    <div key={id} className="flex items-center gap-1.5">
                      <span className="text-base">{emoji}</span>
                      <span className="text-zinc-400 text-xs">{label}</span>
                      <span className={`text-xs font-bold ${text}`}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top articles per reaction */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {totalReactions === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🫙</p>
            <p className="text-zinc-500">Cuando los lectores empiecen a reaccionar, acá vas a ver qué noticias generan más impacto.</p>
            <Link href="/" className="inline-block mt-6 text-blue-400 hover:text-blue-300 text-sm transition-colors">
              Ir a leer noticias →
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {REACTIONS.map(({ id, emoji, label, bg, border, text }) => {
              const articles = topByReaction[id] ?? [];
              const total    = globalCounts[id] ?? 0;
              if (total === 0) return null;
              return (
                <div key={id} className={`rounded-2xl border ${border} ${bg} p-5`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{emoji}</span>
                      <span className={`font-semibold text-sm ${text}`}>{label}</span>
                    </div>
                    <span className="text-xs text-zinc-600">{total} reacciones</span>
                  </div>

                  {articles.length === 0 ? (
                    <p className="text-zinc-600 text-xs">Sin artículos destacados aún</p>
                  ) : (
                    <div className="space-y-3">
                      {articles.map((a, i) => (
                        <Link
                          key={a.article_slug}
                          href={`/articulo/${a.articles?.slug ?? a.article_slug}`}
                          className="flex items-start gap-3 group"
                        >
                          <span className="text-zinc-700 font-mono text-xs mt-0.5 w-4 shrink-0">{i + 1}.</span>
                          <div className="min-w-0">
                            <p className="text-zinc-300 text-sm leading-snug group-hover:text-white transition-colors line-clamp-2">
                              {a.articles?.es_title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {a.articles?.category && (
                                <span className="text-zinc-600 text-[10px]">{a.articles.category}</span>
                              )}
                              <span className={`text-[10px] font-bold ${text}`}>{a.count} {emoji}</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
