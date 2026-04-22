import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const VALID_REACTIONS = ["fire", "shocked", "mindblown", "boring"];

export async function POST(req: NextRequest) {
  try {
    const { slug, reaction } = await req.json();
    if (!slug || !VALID_REACTIONS.includes(reaction)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Read current count
    const { data: existing } = await supabase
      .from("reactions")
      .select("count")
      .eq("article_slug", slug)
      .eq("reaction", reaction)
      .maybeSingle();

    const newCount = (existing?.count ?? 0) + 1;

    const { error } = await supabase
      .from("reactions")
      .upsert(
        { article_slug: slug, reaction, count: newCount },
        { onConflict: "article_slug,reaction" }
      );

    if (error) {
      console.error("upsert error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Return all counts for this article
    const { data: allCounts } = await supabase
      .from("reactions")
      .select("reaction, count")
      .eq("article_slug", slug);

    const counts = Object.fromEntries(
      (allCounts ?? []).map((r: { reaction: string; count: number }) => [r.reaction, r.count])
    );

    return NextResponse.json({ ok: true, counts });
  } catch (e) {
    console.error("react route error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
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
