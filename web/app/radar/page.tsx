import Link from "next/link";
import { supabase, RadarReport } from "@/lib/supabase";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "El Radar — Inteligencia semanal de IA",
  description: "El análisis editorial semanal de AI Hoy: ganadores, perdedores, tendencias emergentes y lo que viene en inteligencia artificial.",
};

async function getLatestRadar(): Promise<RadarReport | null> {
  const { data } = await supabase
    .from("radar_reports")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(1)
    .single();
  return data as RadarReport | null;
}

async function getPastRadars(): Promise<RadarReport[]> {
  const { data } = await supabase
    .from("radar_reports")
    .select("id, title, week_start, week_end, published_at")
    .order("published_at", { ascending: false })
    .range(1, 10);
  return (data ?? []) as RadarReport[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-AR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export default async function RadarPage() {
  const [radar, past] = await Promise.all([getLatestRadar(), getPastRadars()]);

  if (!radar) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <header className="border-b border-zinc-800/60 px-4 sm:px-6 py-3 backdrop-blur-md bg-zinc-950/85">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              <span className="text-blue-400">AI</span> Hoy
            </Link>
            <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">← Volver</Link>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-6 py-20 text-center text-zinc-500">
          El primer Radar se publica el próximo domingo.
        </div>
      </main>
    );
  }

  const c = radar.content;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 px-4 sm:px-6 py-3 backdrop-blur-md bg-zinc-950/85">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight shrink-0" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            <span className="text-blue-400">AI</span> Hoy
          </Link>
          <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">← Volver</Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10">

        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 rounded-full px-3 py-1">
            <span className="text-blue-400 text-xs font-bold tracking-widest uppercase">El Radar</span>
          </div>
          <span className="text-zinc-500 text-sm">{formatDate(radar.published_at)}</span>
        </div>

        {/* Título */}
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-white mb-10" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          {c.titulo}
        </h1>

        {/* Historia de la semana */}
        <section className="mb-10">
          <div className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-3">La historia de la semana</div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            {c.historia_semana.titulo}
          </h2>
          <div className="space-y-4">
            {c.historia_semana.texto.split("\n").filter(Boolean).map((p, i) => (
              <p key={i} className="text-zinc-300 leading-7 text-base sm:text-lg">{p}</p>
            ))}
          </div>
        </section>

        <hr className="border-zinc-800 my-10" />

        {/* Ganadores y Perdedores */}
        <section className="grid sm:grid-cols-2 gap-6 mb-10">
          <div>
            <div className="text-xs font-bold tracking-widest uppercase text-green-400 mb-4">Ganadores</div>
            <div className="space-y-4">
              {c.ganadores.map((g, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-green-400 mt-0.5 shrink-0">↑</span>
                  <div>
                    <p className="font-semibold text-white text-sm">{g.nombre}</p>
                    <p className="text-zinc-400 text-sm leading-snug">{g.razon}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold tracking-widest uppercase text-red-400 mb-4">Perdedores</div>
            <div className="space-y-4">
              {c.perdedores.map((p, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-red-400 mt-0.5 shrink-0">↓</span>
                  <div>
                    <p className="font-semibold text-white text-sm">{p.nombre}</p>
                    <p className="text-zinc-400 text-sm leading-snug">{p.razon}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <hr className="border-zinc-800 my-10" />

        {/* Tendencia */}
        <section className="mb-10">
          <div className="text-xs font-bold tracking-widest uppercase text-purple-400 mb-3">Tendencia emergente</div>
          <h2 className="text-xl font-bold text-white mb-4" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            {c.tendencia.titulo}
          </h2>
          <div className="space-y-4">
            {c.tendencia.texto.split("\n").filter(Boolean).map((p, i) => (
              <p key={i} className="text-zinc-300 leading-7">{p}</p>
            ))}
          </div>
        </section>

        <hr className="border-zinc-800 my-10" />

        {/* Lo que viene + Pregunta */}
        <div className="grid sm:grid-cols-2 gap-6 mb-10">
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="text-xs font-bold tracking-widest uppercase text-orange-400 mb-3">Lo que viene</div>
            <p className="text-zinc-300 leading-7 text-sm">{c.lo_que_viene}</p>
          </section>
          <section className="bg-blue-950/40 border border-blue-800/40 rounded-2xl p-6">
            <div className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-3">La pregunta de la semana</div>
            <p className="text-zinc-200 leading-7 text-sm italic">"{c.pregunta_semana}"</p>
          </section>
        </div>

        {/* Archivo */}
        {past.length > 0 && (
          <>
            <hr className="border-zinc-800 my-10" />
            <section>
              <div className="text-xs font-bold tracking-widest uppercase text-zinc-500 mb-4">Radares anteriores</div>
              <div className="space-y-2">
                {past.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-3 border-b border-zinc-800/60">
                    <span className="text-zinc-300 text-sm">{r.title}</span>
                    <span className="text-zinc-600 text-xs">{formatDate(r.published_at)}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </article>
    </main>
  );
}
