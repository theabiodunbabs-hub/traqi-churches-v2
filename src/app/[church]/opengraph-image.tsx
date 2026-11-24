import { ImageResponse } from "next/og";
import { publicChurch } from "@/lib/server-public";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Church";

export default async function Image({ params }: { params: Promise<{ church: string }> }) {
  const { church } = await params;
  const c = await publicChurch(church);
  const color = c?.profile?.color ?? "#4f46e5";
  const logo = c?.profile?.logo && !c.profile.logo.startsWith("data:") ? c.profile.logo : undefined;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, color: "white", fontFamily: "sans-serif",
        background: `radial-gradient(900px 600px at 100% 0%, ${color}, transparent 70%), linear-gradient(135deg, #0f0d1a, #1d1a2e)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" style={{ width: 96, height: 96, borderRadius: 24, background: "white", objectFit: "contain" }} />
          ) : <div style={{ display: "flex", width: 96, height: 96, borderRadius: 24, background: color, alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 800 }}>{(c?.name ?? "T").slice(0, 1)}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 86, fontWeight: 800, lineHeight: 1.02 }}>{c?.name ?? "Traqi"}</div>
          <div style={{ display: "flex", fontSize: 34, opacity: 0.85, marginTop: 18 }}>You belong here.</div>
        </div>
        <div style={{ display: "flex", fontSize: 24, opacity: 0.7 }}>Powered by Traqi</div>
      </div>
    ),
    size,
  );
}
