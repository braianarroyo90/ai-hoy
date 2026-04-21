import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const entity_id = req.nextUrl.searchParams.get("entity_id");
  if (!entity_id) return NextResponse.json({ articles: [] });

  const { data } = await supabase
    .from("article_entities")
    .select("article_id, articles(id, es_title, slug, published_at)")
    .eq("entity_id", entity_id)
    .limit(8);

  const articles = (data ?? [])
    .map((r: any) => r.articles)
    .filter(Boolean)
    .sort((a: any, b: any) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );

  return NextResponse.json({ articles });
}
