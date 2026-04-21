"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export type Entity = {
  id: string;
  name: string;
  type: "company" | "person" | "model" | "product";
  description: string;
  article_count: number;
};

export type Relation = {
  from_id: string;
  to_id: string;
  relation_type: string;
};

export type ArticleRef = {
  id: string;
  es_title: string;
  slug: string;
  published_at: string;
};

type Props = {
  entities: Entity[];
  relations: Relation[];
};

const TYPE_COLOR: Record<string, string> = {
  company: "#3b82f6",
  person:  "#a855f7",
  model:   "#22c55e",
  product: "#f59e0b",
};

const TYPE_LABEL: Record<string, string> = {
  company: "Empresa",
  person:  "Persona",
  model:   "Modelo",
  product: "Producto",
};

const RELATION_LABEL: Record<string, string> = {
  created:        "creó",
  invested_in:    "invirtió en",
  acquired:       "adquirió",
  competes_with:  "compite con",
  partnered_with: "se asoció con",
  founded_by:     "fundado por",
  works_at:       "trabaja en",
  released:       "lanzó",
  developed_by:   "desarrollado por",
};

export default function PowerMap({ entities, relations }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims]         = useState({ w: 800, h: 600 });
  const [selected, setSelected] = useState<Entity | null>(null);
  const [articles, setArticles] = useState<ArticleRef[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [filter, setFilter]     = useState<string>("all");

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDims({
          w: containerRef.current.offsetWidth,
          h: Math.max(500, window.innerHeight - 260),
        });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const filteredEntities = filter === "all"
    ? entities
    : entities.filter(e => e.type === filter);

  const filteredIds = new Set(filteredEntities.map(e => e.id));
  const filteredRelations = relations.filter(
    r => filteredIds.has(r.from_id) && filteredIds.has(r.to_id)
  );

  const graphData = {
    nodes: filteredEntities.map(e => ({
      id:    e.id,
      name:  e.name,
      type:  e.type,
      count: e.article_count,
      desc:  e.description,
      val:   Math.max(1, Math.sqrt(e.article_count + 1)) * 3,
    })),
    links: filteredRelations.map(r => ({
      source:        r.from_id,
      target:        r.to_id,
      relation_type: r.relation_type,
    })),
  };

  const handleNodeClick = useCallback(async (node: any) => {
    const entity = entities.find(e => e.id === node.id);
    if (!entity) return;
    setSelected(entity);
    setArticles([]);
    setLoadingArticles(true);
    try {
      const res = await fetch(`/api/entity-articles?entity_id=${node.id}`);
      const data = await res.json();
      setArticles(data.articles || []);
    } catch {
      setArticles([]);
    } finally {
      setLoadingArticles(false);
    }
  }, [entities]);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const color  = TYPE_COLOR[node.type] ?? "#64748b";
    const radius = node.val + 2;

    // glow
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI);
    ctx.fillStyle = color + "22";
    ctx.fill();

    // circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = selected?.id === node.id ? "#ffffff" : color;
    ctx.fill();

    // label
    const fontSize = Math.max(10, 13 / globalScale);
    ctx.font = `600 ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = selected?.id === node.id ? "#0f172a" : "#ffffff";
    const label = node.name.length > 14 ? node.name.slice(0, 13) + "…" : node.name;
    ctx.fillText(label, node.x, node.y);
  }, [selected]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full">
      {/* Grafo */}
      <div className="flex-1 min-w-0">
        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4">
          {["all", "company", "person", "model", "product"].map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                filter === t
                  ? "bg-white text-zinc-900 border-white"
                  : "bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500"
              }`}
            >
              {t === "all" ? "Todos" : TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap gap-3 mb-3">
          {Object.entries(TYPE_COLOR).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-zinc-400 text-xs">{TYPE_LABEL[type]}</span>
            </div>
          ))}
        </div>

        <div ref={containerRef} className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
          <ForceGraph2D
            width={dims.w}
            height={dims.h}
            graphData={graphData}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={(node: any, color, ctx) => {
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val + 5, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            linkColor={() => "#334155"}
            linkWidth={1}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            linkCurvature={0.1}
            backgroundColor="#09090b"
            onNodeClick={handleNodeClick}
            nodeLabel={(node: any) => `${node.name} · ${TYPE_LABEL[node.type]} · ${node.count} artículos`}
          />
        </div>
        <p className="text-zinc-600 text-xs mt-2 text-center">
          Hacé click en un nodo para ver los artículos relacionados
        </p>
      </div>

      {/* Panel lateral */}
      <div className="lg:w-80 shrink-0">
        {selected ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div
                  className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-2"
                  style={{ background: TYPE_COLOR[selected.type] + "22", color: TYPE_COLOR[selected.type] }}
                >
                  {TYPE_LABEL[selected.type]}
                </div>
                <h3 className="text-white font-bold text-lg leading-tight">{selected.name}</h3>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-zinc-500 hover:text-white text-lg shrink-0"
              >
                ×
              </button>
            </div>

            {selected.description && (
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">{selected.description}</p>
            )}

            <div className="flex items-center gap-1.5 text-zinc-500 text-xs mb-4">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: TYPE_COLOR[selected.type] }}
              />
              {selected.article_count} artículos relacionados
            </div>

            {/* Conexiones */}
            {(() => {
              const conns = relations.filter(
                r => r.from_id === selected.id || r.to_id === selected.id
              );
              if (!conns.length) return null;
              return (
                <div className="mb-4">
                  <div className="text-xs font-bold tracking-widest uppercase text-zinc-500 mb-2">Conexiones</div>
                  <div className="space-y-1.5">
                    {conns.slice(0, 6).map((r, i) => {
                      const otherId = r.from_id === selected.id ? r.to_id : r.from_id;
                      const other   = entities.find(e => e.id === otherId);
                      const isSrc   = r.from_id === selected.id;
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                          {isSrc ? (
                            <>
                              <span className="text-zinc-500">{RELATION_LABEL[r.relation_type] ?? r.relation_type}</span>
                              <button
                                onClick={() => setSelected(other ?? selected)}
                                className="text-white hover:underline font-medium"
                              >
                                {other?.name ?? otherId}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setSelected(other ?? selected)}
                                className="text-white hover:underline font-medium"
                              >
                                {other?.name ?? otherId}
                              </button>
                              <span className="text-zinc-500">{RELATION_LABEL[r.relation_type] ?? r.relation_type}</span>
                              <span className="text-zinc-600">a este</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Artículos */}
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-zinc-500 mb-2">Artículos</div>
              {loadingArticles ? (
                <p className="text-zinc-600 text-xs">Cargando...</p>
              ) : articles.length > 0 ? (
                <div className="space-y-2">
                  {articles.map(a => (
                    <Link
                      key={a.id}
                      href={`/articulo/${a.slug}`}
                      className="block text-xs text-zinc-300 hover:text-white leading-snug hover:underline"
                    >
                      {a.es_title}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-600 text-xs">No hay artículos recientes.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-5 text-center">
            <div className="text-3xl mb-2">🗺️</div>
            <p className="text-zinc-500 text-sm">
              Seleccioná un nodo del grafo para ver sus conexiones y artículos relacionados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
