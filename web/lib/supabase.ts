import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder"
);

export type RadarArticleRef = { titulo: string; slug: string };

export type RadarContent = {
  titulo: string;
  historia_semana: { titulo: string; texto: string };
  ganadores: { nombre: string; razon: string; articulos?: RadarArticleRef[] }[];
  perdedores: { nombre: string; razon: string; articulos?: RadarArticleRef[] }[];
  tendencia: { titulo: string; texto: string };
  lo_que_viene: string;
  pregunta_semana: string;
};

export type RadarReport = {
  id: string;
  week_start: string;
  week_end: string;
  title: string;
  content: RadarContent;
  published_at: string;
};

export type Article = {
  id: string;
  source_url: string;
  source_name: string;
  og_image: string | null;
  published_at: string;
  es_title: string;
  es_summary: string;
  es_body?: string;
  tags: string[];
  category: string;
  slug?: string;
};
