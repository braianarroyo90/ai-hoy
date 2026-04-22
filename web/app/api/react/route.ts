import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const VALID_REACTIONS = ["fire", "shocked", "mindblown", "boring"];

export async function POST(req: NextRequest) {
  const { slug, reaction } = await req.json();
  if (!slug || !VALID_REACTIONS.includes(reaction)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("increment_reaction", {
    p_slug: slug,
    p_reaction: reaction,
  });

  if (error) {
    console.error("increment_reaction error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const counts = Object.fromEntries(
    (data ?? []).map((r: { reaction: string; count: number }) => [r.reaction, r.count])
  );

  return NextResponse.json({ ok: true, counts });
}

export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({});

  const { data } = await supabase
    .from("reactions")
    .select("reaction, count")
    .eq("article_slug", slug);

  const counts = Object.fromEntries(
    (data ?? []).map((r: { reaction: string; count: number }) => [r.reaction, r.count])
  );

  return NextResponse.json(counts);
}
