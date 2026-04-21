import Link from "next/link";
import { RadarReport } from "@/lib/supabase";

export default function RadarCard({ radar }: { radar: RadarReport }) {
  return (
    <Link href="/radar" className="block group mb-8">
      <div className="relative rounded-2xl overflow-hidden border border-blue-800/40 bg-gradient-to-br from-blue-950/60 via-zinc-900 to-zinc-950 hover:border-blue-600/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-blue-950/50">
        {/* top accent line */}
        <div className="h-0.5 w-full bg-gradient-to-r from-blue-600 via-blue-400 to-transparent" />

        <div className="p-5 sm:p-7">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs font-bold tracking-widest uppercase text-blue-400">El Radar</span>
              <span className="text-xs text-zinc-600">·</span>
              <span className="text-xs text-zinc-500">Inteligencia semanal</span>
            </div>
            <span className="text-xs text-zinc-500 hidden sm:block">
              {new Date(radar.published_at).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug mb-3 group-hover:text-blue-100 transition-colors" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            {radar.content.historia_semana.titulo}
          </h2>

          <p className="text-zinc-400 text-sm leading-relaxed line-clamp-2 mb-5">
            {radar.content.historia_semana.texto.split("\n")[0]}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-green-400 text-xs">↑</span>
                <span className="text-zinc-400 text-xs">{radar.content.ganadores[0]?.nombre}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-red-400 text-xs">↓</span>
                <span className="text-zinc-400 text-xs">{radar.content.perdedores[0]?.nombre}</span>
              </div>
            </div>
            <span className="text-blue-400 text-sm group-hover:text-blue-300 transition-colors font-medium">
              Leer el Radar →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
