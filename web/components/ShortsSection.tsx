"use client";

import { useState } from "react";

type Short = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  published_at: string;
};

function ShortCard({ s }: { s: Short }) {
  const [active, setActive] = useState(false);

  return (
    <div className="flex-none w-44 snap-start group cursor-pointer" onClick={() => setActive(!active)}>
      <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700/50 group-hover:border-zinc-500 transition-all duration-200 group-hover:scale-[1.02]">
        {active ? (
          <iframe
            src={`https://www.youtube.com/embed/${s.id}?autoplay=1`}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : (
          <>
            {s.thumbnail ? (
              <img
                src={s.thumbnail}
                alt={s.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-900" />
            )}

            {/* gradient bottom */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

            {/* play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:bg-red-600/90 group-hover:border-red-600 transition-all duration-200">
                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>

            {/* shorts badge */}
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5">
              <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.77 10.32l-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.23-2.53-5.06-1.56L6 6.94c-1.29.68-2.06 2.03-2 3.47.03.62.21 1.21.51 1.73l-1.2-.5c-1.84-.96-4.1-.25-5.06 1.56s-.25 4.1 1.56 5.06l1.2.5L0 18.94c-1.84.96-2.53 3.23-1.56 5.06S1.67 26.53 3.5 25.56L12 21.06l8.5 4.5c1.84.96 4.1.25 5.06-1.56s.25-4.1-1.56-5.06l-1.2-.5L24 17.06c1.84-.96 2.53-3.23 1.56-5.06s-3.23-2.53-5.06-1.56l-2.73 1.88z"/>
              </svg>
              <span className="text-white text-[10px] font-semibold">Shorts</span>
            </div>
          </>
        )}
      </div>

      <div className="mt-2.5 px-0.5">
        <p className="text-sm text-zinc-200 leading-snug line-clamp-2 font-medium">{s.title}</p>
        <p className="mt-1 text-xs text-zinc-500">{s.channel}</p>
      </div>
    </div>
  );
}

export default function ShortsSection({ shorts }: { shorts: Short[] }) {
  if (!shorts.length) return null;

  return (
    <section className="mt-12 mb-2">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 9l5 3-5 3V9zm11.56-7.83l-15 2.82C5.47 4.08 5 4.63 5 5.28V13H3v3h2v5h2v-5h12v5h2v-5h2v-3h-2V7.48l1.56-1.41-1-1.9zM19 13H7V7.93l12-2.25V13z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              Shorts de IA
            </h2>
            <p className="text-xs text-zinc-500">Videos cortos de la comunidad</p>
          </div>
        </div>
        <a
          href="https://www.youtube.com/shorts"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
        >
          Ver más
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory -mx-6 px-6">
        {shorts.map((s) => (
          <ShortCard key={s.id} s={s} />
        ))}

        {/* CTA al final */}
        <a
          href="https://www.youtube.com/@AIHoy"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-none w-44 snap-start"
        >
          <div className="aspect-[9/16] rounded-2xl bg-zinc-800/60 border border-zinc-700/50 border-dashed flex flex-col items-center justify-center gap-3 hover:bg-zinc-800 hover:border-zinc-500 transition-all duration-200">
            <div className="w-12 h-12 rounded-full bg-red-600/20 border border-red-600/40 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 00.5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 002.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 002.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.52V8.48L15.5 12l-5.75 3.52z"/>
              </svg>
            </div>
            <p className="text-xs text-zinc-400 text-center px-3 leading-snug">Ver canal en YouTube</p>
          </div>
        </a>
      </div>
    </section>
  );
}
