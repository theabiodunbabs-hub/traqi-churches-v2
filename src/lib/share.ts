/**
 * Copying links and saving pictures that work on every phone and browser, including WhatsApp's and
 * Instagram's built-in browsers, iPhones, and plain http on a laptop.
 */

/** Copies text. Tries the clipboard, then the older copy command; if both are blocked, shows the text selected to copy by hand. */
export async function copyText(text: string, label = "Copy this link"): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* blocked: try the older way */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;font-size:16px";
    document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy"); ta.remove();
    if (ok) return true;
  } catch { /* still blocked */ }
  manualCopy(text, label);
  return false;
}

/**
 * Saves a picture (or a PDF). Phones: the share sheet (Save image, WhatsApp, Status…). Computers: a download.
 * Where neither works (some in-app browsers), the picture opens on screen to press and hold to save.
 */
export async function savePicture(blob: Blob, filename: string, opts: { title?: string; text?: string } = {}): Promise<"shared" | "saved" | "shown"> {
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  if (touch && nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: opts.title, text: opts.text }); return "shared"; }
    catch (e) { if ((e as Error)?.name === "AbortError") return "shared"; /* otherwise fall through */ }
  }
  const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|TikTok|; wv\)/i.test(navigator.userAgent);
  const canDownload = "download" in HTMLAnchorElement.prototype;
  if (canDownload && !inApp) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return "saved";
  }
  if (!(blob.type || "").startsWith("image/")) { window.open(URL.createObjectURL(blob), "_blank", "noopener"); return "shown"; }
  showPicture(blob);
  return "shown";
}

// ---------- Fallback screens (plain DOM, so they work from any page) ----------
function overlay(content: HTMLElement) {
  document.getElementById("traqi-share-overlay")?.remove();
  const wrap = document.createElement("div");
  wrap.id = "traqi-share-overlay";
  wrap.setAttribute("role", "dialog"); wrap.setAttribute("aria-modal", "true");
  wrap.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,8,30,.72);backdrop-filter:blur(3px);font-family:system-ui,sans-serif";
  const box = document.createElement("div");
  box.style.cssText = "width:min(100%,440px);max-height:92vh;overflow:auto;background:#fff;color:#151226;border-radius:20px;padding:16px;box-shadow:0 30px 80px rgba(0,0,0,.4)";
  const close = document.createElement("button");
  close.type = "button"; close.textContent = "Done";
  close.style.cssText = "margin-top:12px;width:100%;height:46px;border:0;border-radius:14px;background:#4f46e5;color:#fff;font-weight:600;font-size:15px;cursor:pointer";
  const done = () => { wrap.remove(); document.removeEventListener("keydown", esc); };
  const esc = (e: KeyboardEvent) => { if (e.key === "Escape") done(); };
  close.onclick = done; wrap.onclick = (e) => { if (e.target === wrap) done(); };
  document.addEventListener("keydown", esc);
  box.append(content, close); wrap.append(box); document.body.append(wrap);
  close.focus();
  return box;
}

function manualCopy(text: string, label: string) {
  const c = document.createElement("div");
  const p = document.createElement("p"); p.textContent = label; p.style.cssText = "margin:0 0 4px;font-weight:700;font-size:16px";
  const hint = document.createElement("p"); hint.textContent = "Press and hold the text below, then choose Copy."; hint.style.cssText = "margin:0 0 10px;color:#5f5c85;font-size:13.5px";
  const input = document.createElement("textarea");
  input.value = text; input.readOnly = true; input.rows = Math.min(6, Math.ceil(text.length / 34));
  input.style.cssText = "width:100%;box-sizing:border-box;padding:12px;border-radius:12px;border:1.5px solid #c7c4e8;font-size:16px;line-height:1.4;resize:none;color:#151226;background:#f6f5fb";
  c.append(p, hint, input);
  overlay(c);
  setTimeout(() => { input.focus(); input.select(); }, 30);
}

function showPicture(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const c = document.createElement("div");
  const p = document.createElement("p"); p.textContent = "Press and hold the picture, then choose Save"; p.style.cssText = "margin:0 0 10px;font-weight:700;font-size:15.5px;text-align:center";
  const img = document.createElement("img"); img.src = url; img.alt = "Picture to save";
  img.style.cssText = "display:block;width:100%;height:auto;border-radius:12px;-webkit-touch-callout:default;user-select:auto";
  c.append(p, img);
  overlay(c);
}
