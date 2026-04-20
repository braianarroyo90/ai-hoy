import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder"
);

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
