/**
 * Tickets and certificates drawn as pictures in the browser, so people download just the ticket
 * or just the certificate: PNG, JPEG or PDF. A certificate is always landscape, whatever the screen.
 */
import QRCode from "qrcode";
import { savePicture } from "./share";

export type Format = "png" | "jpeg" | "pdf";

const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
const DISPLAY = '"Bricolage Grotesque Variable", "Fraunces Variable", Georgia, serif';
const SANS = '"Figtree Variable", system-ui, sans-serif';
const SERIF = '"Fraunces Variable", Georgia, "Times New Roman", serif';

function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, max: number, start: number, family: string) {
  let size = start;
  do { ctx.font = `${weight} ${size}px ${family}`; size -= 2; } while (ctx.measureText(text).width > max && size > 18);
  return size + 2;
}
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
async function logoOrInitials(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, church: { name: string; logo?: string; color: string }, light = false) {
  if (church.logo) {
    try { const img = await load(church.logo); ctx.save(); rounded(ctx, x, y, size, size, size * 0.22); ctx.clip(); ctx.drawImage(img, x, y, size, size); ctx.restore(); return; } catch { /* fall back to initials */ }
  }
  ctx.fillStyle = light ? "rgba(255,255,255,.18)" : church.color; rounded(ctx, x, y, size, size, size * 0.22); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = `700 ${size * 0.4}px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(church.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(), x + size / 2, y + size / 2 + 2);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}

/* ---------------- Ticket ---------------- */
export type TicketInfo = { event: string; when: string; venue?: string; name: string; code: string; status: string; church: { name: string; logo?: string; color: string } };

/** A classic admission ticket: event on the left, a tear line, and the QR stub on the right. */
export async function ticketCanvas(t: TicketInfo): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const W = 1600, H = 700, stub = 470;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f4f3f8"; ctx.fillRect(0, 0, W, H);
  // Card with notches at the tear line
  ctx.save();
  rounded(ctx, 30, 30, W - 60, H - 60, 44); ctx.clip();
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(30, 30, W - stub, H);
  g.addColorStop(0, t.church.color); g.addColorStop(1, "#151226");
  ctx.fillStyle = g; ctx.fillRect(30, 30, W - stub - 30, H - 60);
  ctx.restore();
  ctx.fillStyle = "#f4f3f8";
  ctx.beginPath(); ctx.arc(W - stub, 30, 34, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W - stub, H - 30, 34, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#c9c6d9"; ctx.lineWidth = 4; ctx.setLineDash([14, 14]);
  ctx.beginPath(); ctx.moveTo(W - stub, 80); ctx.lineTo(W - stub, H - 80); ctx.stroke(); ctx.setLineDash([]);

  // Left: church, event, when, where, name
  const L = 100, maxW = W - stub - L - 70;
  await logoOrInitials(ctx, L, 90, 76, t.church, true);
  ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.font = `600 26px ${SANS}`; ctx.fillText(t.church.name.toUpperCase(), L + 100, 140);
  ctx.fillStyle = "#fff";
  fit(ctx, t.event, 700, maxW, 70, DISPLAY); ctx.fillText(t.event, L, 260);
  ctx.font = `500 32px ${SANS}`; ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillText(t.when, L, 320);
  if (t.venue) { fit(ctx, t.venue, 400, maxW, 28, SANS); ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fillText(t.venue, L, 366); }
  ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.font = `600 22px ${SANS}`; ctx.fillText("ADMIT ONE", L, 500);
  ctx.fillStyle = "#fff"; fit(ctx, t.name || "Guest", 700, maxW, 52, DISPLAY); ctx.fillText(t.name || "Guest", L, 560);

  // Right stub: QR, code, status
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, t.code, { width: 300, margin: 1, color: { dark: "#151226", light: "#ffffff" } });
  const sx = W - stub + (stub - 30 - 300) / 2;
  ctx.drawImage(qr, sx, 120);
  ctx.textAlign = "center"; ctx.fillStyle = "#151226";
  ctx.font = `700 40px ${SANS}`; ctx.fillText(t.code, sx + 150, 482);
  ctx.fillStyle = "#6b6885"; ctx.font = `500 24px ${SANS}`; ctx.fillText(t.status, sx + 150, 524);
  ctx.fillStyle = "#9a97b0"; ctx.font = `500 20px ${SANS}`; ctx.fillText("Show this at the door", sx + 150, 600);
  ctx.textAlign = "left";
  return c;
}

/* ---------------- Certificate ---------------- */
export type Signer = { name: string; title: string; signature?: string };
export type CertInfo = { name: string; course: string; date: string; certNo?: string; signers: Signer[]; church: { name: string; logo?: string; color: string }; verifyUrl?: string; heading?: string };

/** A landscape certificate, A4 proportions, drawn the same on every device. */
export async function certificateCanvas(ci: CertInfo): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const W = 2480, H = 1754;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const col = ci.church.color;
  ctx.fillStyle = "#fffdf8"; ctx.fillRect(0, 0, W, H);
  // Soft corner washes and a double frame
  const wash = (x: number, y: number, r: number, color: string) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
  wash(W, 0, 900, `${col}26`); wash(0, H, 900, "rgba(245,158,11,.12)");
  ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.strokeRect(70, 70, W - 140, H - 140);
  ctx.strokeStyle = `${col}55`; ctx.lineWidth = 3; ctx.strokeRect(100, 100, W - 200, H - 200);

  ctx.textAlign = "center";
  await logoOrInitials(ctx, W / 2 - 75, 190, 150, ci.church);
  ctx.textAlign = "center";
  ctx.fillStyle = "#2a2740"; ctx.font = `600 46px ${SANS}`; ctx.fillText(ci.church.name, W / 2, 420);
  ctx.fillStyle = col; ctx.font = `600 40px ${SANS}`;
  ctx.fillText((ci.heading ?? "Certificate of completion").toUpperCase().split("").join(String.fromCharCode(8202)), W / 2, 540);
  ctx.fillStyle = "#6b6885"; ctx.font = `italic 400 44px ${SERIF}`; ctx.fillText("This is to certify that", W / 2, 650);
  ctx.fillStyle = "#151226"; fit(ctx, ci.name, 600, W - 600, 150, SERIF); ctx.fillText(ci.name, W / 2, 820);
  ctx.strokeStyle = `${col}66`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W / 2 - 600, 870); ctx.lineTo(W / 2 + 600, 870); ctx.stroke();
  ctx.fillStyle = "#6b6885"; ctx.font = `italic 400 44px ${SERIF}`; ctx.fillText("has faithfully completed", W / 2, 960);
  ctx.fillStyle = "#151226"; fit(ctx, ci.course, 600, W - 700, 76, DISPLAY); ctx.fillText(ci.course, W / 2, 1060);
  ctx.fillStyle = "#6b6885"; ctx.font = `500 38px ${SANS}`; ctx.fillText(ci.date, W / 2, 1130);

  // Signatures along the bottom
  const signers = ci.signers.slice(0, 3);
  const slot = (W - 500) / Math.max(signers.length, 1);
  for (const [i, s] of signers.entries()) {
    const cx = 250 + slot * i + slot / 2, base = 1450;
    if (s.signature) {
      try { const img = await load(s.signature); const h = 150, w = Math.min(460, (img.width / img.height) * h); ctx.drawImage(img, cx - w / 2, base - h - 10, w, h); } catch { /* no image */ }
    }
    ctx.textAlign = "center";
    ctx.strokeStyle = "#2a2740"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx - 240, base); ctx.lineTo(cx + 240, base); ctx.stroke();
    ctx.fillStyle = "#151226"; ctx.font = `600 36px ${SANS}`; ctx.fillText(s.name, cx, base + 52);
    ctx.fillStyle = "#6b6885"; ctx.font = `400 30px ${SANS}`; ctx.fillText(s.title, cx, base + 94);
  }
  // Certificate number and a QR to check it's genuine
  if (ci.verifyUrl) {
    const qr = document.createElement("canvas");
    await QRCode.toCanvas(qr, ci.verifyUrl, { width: 150, margin: 0, color: { dark: "#2a2740", light: "#fffdf8" } });
    ctx.drawImage(qr, W - 300, H - 330);
  }
  ctx.textAlign = "left"; ctx.fillStyle = "#9a97b0"; ctx.font = `500 26px ${SANS}`;
  if (ci.certNo) ctx.fillText(`Certificate no. ${ci.certNo}`, 160, H - 165);
  ctx.textAlign = "left";
  return c;
}

/* ---------------- Saving ---------------- */
export async function saveCanvas(c: HTMLCanvasElement, name: string, format: Format) {
  const safe = name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "traqi";
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const land = c.width >= c.height;
    // Certificates go on A4; tickets on a page their own size
    const a4 = Math.abs(c.width / c.height - 1.414) < 0.02;
    const pdf = a4 ? new jsPDF({ orientation: land ? "landscape" : "portrait", unit: "mm", format: "a4" })
      : new jsPDF({ orientation: land ? "landscape" : "portrait", unit: "px", format: [c.width / 2, c.height / 2], hotfixes: ["px_scaling"] });
    const w = pdf.internal.pageSize.getWidth(), h = pdf.internal.pageSize.getHeight();
    pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, w, h);
    await savePicture(pdf.output("blob"), `${safe}.pdf`, { title: name });
    return;
  }
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, format === "png" ? "image/png" : "image/jpeg", 0.92));
  if (!blob) return;
  await savePicture(blob, `${safe}.${format === "png" ? "png" : "jpg"}`, { title: name });
}

/** Share the picture straight to WhatsApp and other apps where the phone allows it. */
export async function shareCanvas(c: HTMLCanvasElement, name: string, text: string): Promise<boolean> {
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
  if (!blob) return false;
  const file = new File([blob], `${name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "ticket"}.png`, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text }); return true; } catch { return true; } }
  return false;
}
