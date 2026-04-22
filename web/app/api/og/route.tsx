import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site-config";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? siteConfig.name;
  const category = searchParams.get("category") ?? "";
  const source = searchParams.get("source") ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "60px",
          background: "linear-gradient(135deg, #09090b 0%, #18181b 60%, #1e2a3a 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "auto", gap: "12px" }}>
          <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: "22px", letterSpacing: "-0.5px" }}>
            {siteConfig.name.split(" ")[0]}
          </span>
          <span style={{ color: "#71717a", fontSize: "22px", fontWeight: 400 }}>
            {siteConfig.name.split(" ").slice(1).join(" ")}
          </span>
        </div>

        {/* Category chip */}
        {category && (
          <div
            style={{
              display: "inline-flex",
              background: "rgba(59,130,246,0.15)",
              border: "1px solid rgba(59,130,246,0.3)",
              borderRadius: "6px",
              padding: "6px 14px",
              color: "#93c5fd",
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "20px",
              width: "fit-content",
            }}
          >
            {category}
          </div>
        )}

        {/* Title */}
        <div
          style={{
            color: "#f4f4f5",
            fontSize: title.length > 80 ? "36px" : title.length > 60 ? "42px" : "50px",
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "-0.5px",
            marginBottom: "28px",
            maxWidth: "1080px",
          }}
        >
          {title}
        </div>

        {/* Bottom bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "3px", height: "24px", background: "#3b82f6", borderRadius: "2px" }} />
          <span style={{ color: "#52525b", fontSize: "16px" }}>
            {siteConfig.tagline}
          </span>
          {source && (
            <>
              <span style={{ color: "#3f3f46", fontSize: "16px" }}>·</span>
              <span style={{ color: "#52525b", fontSize: "16px" }}>Fuente: {source}</span>
            </>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
