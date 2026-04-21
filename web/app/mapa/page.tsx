import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { siteConfig } from "@/lib/site-config";
import PowerMap from "@/components/PowerMap";
import type { Entity, Relation } from "@/components/PowerMap";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Mapa de Poder — Quién es quién en la IA",
  description: "Visualización interactiva de empresas, personas y modelos que dominan la inteligencia artificial.",
};

async function getData(): Promise<{ entities: Entity[]; relations: Relation[] }> {
  const [entitiesRes, relationsRes] = await Promise.all([
    supabase
      .from("entities")
      .select("id, name, type, description, article_count")
      .order("article_count", { ascending: false })
      .limit(120),
    supabase
      .from("entity_relations")
      .select("from_id, to_id, relation_type"),
  ]);

  return {
    entities:  (entitiesRes.data  ?? []) as Entity[],
    relations: (relationsRes.data ?? []) as Relation[],
  };
}

export default async function MapaPage() {
  const { entities, relations } = await getData();

  const [first, ...rest] = siteConfig.name.split(" ");

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 px-4 sm:px-6 py-3 backdrop-blur-md bg-zinc-950/85">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight shrink-0" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            <span className="text-blue-400">{first}</span>{" "}{rest.join(" ")}
          </Link>
          <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">← Volver</Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <div className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-1">Mapa de Poder</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Quién es quién en la IA
          </h1>
          <p className="text-zinc-400 text-sm">
            {entities.length} actores · {relations.length} conexiones · actualizado con cada pipeline
          </p>
        </div>

        {entities.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🗺️</div>
            <p className="text-zinc-400 text-lg mb-2">El mapa se está construyendo</p>
            <p className="text-zinc-600 text-sm">
              Corré el agente <code className="bg-zinc-800 px-1 rounded">entity_extractor.py</code> para poblar el grafo.
            </p>
          </div>
        ) : (
          <PowerMap entities={entities} relations={relations} />
        )}
      </div>
    </main>
  );
}
