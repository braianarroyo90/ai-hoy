"use client";

import { useEffect, useState } from "react";

const REACTIONS = [
  { id: "fire",       emoji: "🔥", label: "Impresionante" },
  { id: "shocked",    emoji: "😱", label: "Preocupante"   },
  { id: "mindblown",  emoji: "🤯", label: "No lo puedo creer" },
  { id: "boring",     emoji: "🥱", label: "Hype"          },
] as const;

type ReactionId = typeof REACTIONS[number]["id"];
type Counts = Partial<Record<ReactionId, number>>;

export default function ReactionBar({ slug }: { slug: string }) {
  const [counts, setCounts]   = useState<Counts>({});
  const [picked, setPicked]   = useState<ReactionId | null>(null);
  const [loading, setLoading] = useState(false);

  const storageKey = `reaction:${slug}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey) as ReactionId | null;
    if (saved) setPicked(saved);

    fetch(`/api/react?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then(setCounts)
      .catch(() => {});
  }, [slug, storageKey]);

  async function handleReact(id: ReactionId) {
    if (picked || loading) return;
    setLoading(true);

    // optimistic
    setCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
    setPicked(id);
    localStorage.setItem(storageKey, id);

    try {
      const res = await fetch("/api/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, reaction: id }),
      });
      const data = await res.json();
      if (data.counts) setCounts(data.counts);
    } catch {
      // keep optimistic state
    } finally {
      setLoading(false);
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="mt-8 pt-6 border-t border-zinc-800">
      <p className="text-xs font-bold tracking-widest uppercase text-zinc-500 mb-4">
        ¿Cómo te cayó esta noticia?
      </p>
      <div className="flex flex-wrap gap-2">
        {REACTIONS.map(({ id, emoji, label }) => {
          const count   = counts[id] ?? 0;
          const isMe    = picked === id;
          const inactive = picked && !isMe;
          return (
            <button
              key={id}
              onClick={() => handleReact(id)}
              disabled={!!picked || loading}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium
                transition-all duration-200 select-none
                ${isMe
                  ? "border-blue-500/60 bg-blue-500/10 text-white scale-105"
                  : inactive
                  ? "border-zinc-800 bg-zinc-900/50 text-zinc-600 cursor-default"
                  : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 hover:scale-105 cursor-pointer"
                }
              `}
            >
              <span className={`text-lg leading-none transition-transform ${isMe ? "scale-125" : ""}`}>
                {emoji}
              </span>
              <span className="text-xs leading-none">{label}</span>
              {count > 0 && (
                <span className={`text-xs font-bold ${isMe ? "text-blue-400" : "text-zinc-500"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {total > 0 && (
        <p className="text-xs text-zinc-600 mt-3">
          {total} {total === 1 ? "reacción" : "reacciones"} de la comunidad
        </p>
      )}
    </div>
  );
}
