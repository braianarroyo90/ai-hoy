"use client";

import { useState, useEffect } from "react";

const PASSWORD = process.env.NEXT_PUBLIC_DECK_PASSWORD ?? "aihoy2026";
const STORAGE_KEY = "deck_unlocked";

export default function SistemaPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem(STORAGE_KEY) === "1") setUnlocked(true);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === PASSWORD) {
      localStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
    } else {
      setError(true);
      setInput("");
    }
  }

  if (!mounted) return null;

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">
              <span className="text-blue-400">AI</span> Hoy
            </h1>
            <p className="text-zinc-500 text-sm">Documento interno — acceso restringido</p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(false); }}
              placeholder="Clave de acceso"
              autoFocus
              className={`w-full px-4 py-3 rounded-lg bg-zinc-900 border text-white placeholder-zinc-600 text-sm outline-none focus:border-blue-500 transition-colors ${
                error ? "border-red-500" : "border-zinc-700"
              }`}
            />
            {error && (
              <p className="text-red-400 text-xs text-center">Clave incorrecta</p>
            )}
            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              Acceder
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <iframe
        src="/sistema-doc.html"
        className="w-full border-none"
        style={{ height: "100vh" }}
        title="AI Hoy — Documentación del Sistema"
      />
    </div>
  );
}
