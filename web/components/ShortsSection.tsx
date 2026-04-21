"use client";

import { useState } from "react";

type Short = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  published_at: string;
};

export default function ShortsSection({ shorts }: { shorts: Short[] }) {
  const [active, setActive] = useState<string | null>(null);

  if (!shorts.length) return null;

  return (
    <section className="mt-12 mb-2">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-red-500 text-xl">▶</span>
        <h2 className="text-lg font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          Shorts de IA
        </h2>
        <span className="text-xs text-zinc-500 ml-1">en YouTube</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory">
        {shorts.map((s) => (
          <div
            key={s.id}
            className="flex-none w-40 snap-start cursor-pointer group"
            onClick={() => setActive(active === s.id ? null : s.id)}
          >
            <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 group-hover:border-zinc-500 transition-colors">
              {active === s.id ? (
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
                    <div className="w-full h-full bg-zinc-800" />
                  )}
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-red-600/90 flex items-center justify-center">
                      <span className="text-white text-sm ml-0.5">▶</span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <p className="mt-2 text-xs text-zinc-300 leading-snug line-clamp-2">{s.title}</p>
            <p className="mt-0.5 text-xs text-zinc-500 truncate">{s.channel}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
