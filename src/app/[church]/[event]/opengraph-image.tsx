import { ImageResponse } from "next/og";
import { eventDateLine, publicEvent } from "@/lib/server-public";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Event";

/** The preview card WhatsApp and others show: the flyer if there is one, else the church's colours. */
export default async function Image({ params }: { params: Promise<{ church: string; event: string }> }) {
  const { church, event } = await params;
  const d = await publicEvent(church, event);
  const color = d?.church.profile?.color ?? "#4f46e5";
  const e = d?.event;
  const theme = e?.theme || e?.tagline;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: `linear-gradient(135deg, #0f0d1a 0%, ${color} 60%, #f59e0b 130%)`, color: "white", fontFamily: "sans-serif" }}>
        {e?.flyer && !e.flyer.startsWith("data:") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.flyer} alt="" style={{ height: 630, width: 470, objectFit: "cover" }} />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, flex: 1 }}>
          <div style={{ display: "flex", fontSize: 28, opacity: 0.85, textTransform: "uppercase", letterSpacing: 4 }}>{d?.church.name ?? "Traqi"}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {theme ? <div style={{ display: "flex", fontSize: 32, fontStyle: "italic", opacity: 0.9, marginBottom: 16 }}>{`“${theme}”`}</div> : null}
            <div style={{ display: "flex", fontSize: e?.flyer ? 64 : 84, fontWeight: 800, lineHeight: 1.02 }}>{e?.title ?? "Event"}</div>
            <div style={{ display: "flex", fontSize: 30, marginTop: 24, opacity: 0.9 }}>{e ? eventDateLine(e.days) : ""}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26 }}>
            <div style={{ display: "flex", background: "white", color: "#111", padding: "12px 24px", borderRadius: 999, fontWeight: 700 }}>Register free</div>
            <div style={{ display: "flex", opacity: 0.75 }}>Powered by Traqi</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
