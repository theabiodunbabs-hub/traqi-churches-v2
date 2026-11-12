/**
 * A ready-to-post image for WhatsApp status and Instagram: the flyer (or the event's colours),
 * the title, theme, date, venue and a QR code to the registration page. Made in the browser.
 */
import QRCode from "qrcode";
import type { ChurchEvent } from "./types";
import { daysOf, themeOf } from "./events";

const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(/\s+/); const lines: string[] = []; let line = "";
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}

export async function shareImage(e: ChurchEvent, church: { name: string; color?: string; logo?: string }, url: string, size: "story" | "square" = "story"): Promise<Blob> {
  const W = 1080, H = size === "story" ? 1920 : 1080;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const color = church.color ?? "#4f46e5";
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0f0d1a"); g.addColorStop(0.55, color); g.addColorStop(1, "#f59e0b");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // The flyer fills the top when there is one
  let y = 120;
  if (e.flyer) {
    try {
      const img = await load(e.flyer);
      const boxH = size === "story" ? 1080 : 620, boxW = W - 160;
      const s = Math.min(boxW / img.width, boxH / img.height);
      const w = img.width * s, h = img.height * s;
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 60;
      ctx.drawImage(img, (W - w) / 2, y, w, h); ctx.restore();
      y += h + 70;
    } catch { /* no flyer: use the colours */ }
  }
  ctx.fillStyle = "#fff";
  ctx.font = "600 34px system-ui, sans-serif";
  ctx.globalAlpha = 0.8; ctx.fillText(church.name.toUpperCase(), 80, y); ctx.globalAlpha = 1;
  y += 40;
  if (!e.flyer) {
    y += 160;
    ctx.font = "700 112px system-ui, sans-serif";
    for (const l of wrap(ctx, e.title, W - 160).slice(0, 4)) { y += 118; ctx.fillText(l, 80, y); }
    const th = themeOf(e);
    if (th) { ctx.font = "italic 500 48px Georgia, serif"; ctx.globalAlpha = 0.9; for (const l of wrap(ctx, `“${th}”`, W - 160).slice(0, 2)) { y += 70; ctx.fillText(l, 80, y); } ctx.globalAlpha = 1; }
  } else {
    ctx.font = "700 64px system-ui, sans-serif";
    for (const l of wrap(ctx, e.title, W - 160).slice(0, 2)) { y += 72; ctx.fillText(l, 80, y); }
  }
  const days = daysOf(e);
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });
  y += 70;
  ctx.font = "600 42px system-ui, sans-serif";
  ctx.fillText(days.length > 1 ? `${fmt(days[0].date)} to ${fmt(days.at(-1)!.date)}` : fmt(days[0].date), 80, y);
  if (e.venue || e.mode === "virtual") { y += 58; ctx.font = "400 38px system-ui, sans-serif"; ctx.globalAlpha = 0.85; ctx.fillText(e.mode === "virtual" ? "Online" : e.venue!.slice(0, 48), 80, y); ctx.globalAlpha = 1; }

  // QR and link at the bottom
  const qr = await load(await QRCode.toDataURL(url, { margin: 1, width: 300, color: { dark: "#111111", light: "#ffffff" } }));
  const qy = H - 380;
  ctx.fillStyle = "#fff"; roundRect(ctx, 80, qy, 300, 300, 28); ctx.fill();
  ctx.drawImage(qr, 92, qy + 12, 276, 276);
  ctx.fillStyle = "#fff"; ctx.font = "700 46px system-ui, sans-serif"; ctx.fillText("Register free", 420, qy + 110);
  ctx.font = "400 34px system-ui, sans-serif"; ctx.globalAlpha = 0.85;
  for (const [i, l] of wrap(ctx, url.replace(/^https?:\/\//, ""), W - 500).slice(0, 2).entries()) ctx.fillText(l, 420, qy + 170 + i * 44);
  ctx.globalAlpha = 1;
  return new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
