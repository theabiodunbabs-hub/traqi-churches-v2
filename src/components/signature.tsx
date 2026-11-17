"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, ImagePlus, PenLine, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Sheet, cx, inputCls, toast } from "./ui";
import { fullName } from "@/lib/format";
import type { Signer } from "@/lib/types";

/** Turn a photo of a signature into dark ink on a see-through background, cropped to the ink. */
export async function cleanSignature(src: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const scale = Math.min(1, 900 / img.width);
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h); const px = d.data;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
    const alpha = px[i + 3] < 20 ? 0 : Math.max(0, Math.min(255, (200 - lum) * 2.2));
    px[i] = 20; px[i + 1] = 18; px[i + 2] = 48; px[i + 3] = alpha;
    if (alpha > 40) { const x = (i / 4) % w, y = Math.floor(i / 4 / w); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  ctx.putImageData(d, 0, 0);
  if (maxX <= minX || maxY <= minY) throw new Error("We couldn't find a signature in that picture. Try a clearer photo on white paper.");
  const pad = 10, cw = maxX - minX + pad * 2, ch = maxY - minY + pad * 2;
  const out = document.createElement("canvas"); out.width = cw; out.height = ch;
  out.getContext("2d")!.drawImage(c, minX - pad, minY - pad, cw, ch, 0, 0, cw, ch);
  return out.toDataURL("image/png");
}

/** Sign with a finger or a mouse. */
function DrawPad({ onDone, onCancel }: { onDone: (dataUrl: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  useEffect(() => {
    const c = ref.current!; const r = c.getBoundingClientRect();
    c.width = r.width * 2; c.height = r.height * 2;
    const ctx = c.getContext("2d")!; ctx.scale(2, 2); ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#141230";
  }, []);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  return (
    <div>
      <canvas ref={ref} className="h-48 w-full touch-none rounded-2xl bg-white ring-1 ring-line"
        onPointerDown={(e) => { drawing.current = true; ref.current!.setPointerCapture(e.pointerId); const ctx = ref.current!.getContext("2d")!; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); }}
        onPointerMove={(e) => { if (!drawing.current) return; const ctx = ref.current!.getContext("2d")!; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); setEmpty(false); }}
        onPointerUp={() => { drawing.current = false; }} />
      <p className="mt-2 text-[13px] text-muted">Sign inside the box.</p>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => { const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setEmpty(true); }}><Eraser size={15} /> Clear</Button>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" className="flex-1" disabled={empty} onClick={async () => onDone(await cleanSignature(ref.current!.toDataURL("image/png")))}>Use this signature</Button>
      </div>
    </div>
  );
}

/**
 * Who signs a course's certificate: up to three people, each with a title and a signature.
 * A signature is added or changed only by the person themselves or the lead pastor.
 */
export function SignersEditor({ value, onChange }: { value: Signer[]; onChange: (v: Signer[]) => void }) {
  const { state, me, access } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [drawFor, setDrawFor] = useState<number | null>(null);
  const [uploadFor, setUploadFor] = useState<number | null>(null);
  const leaders = state.people.filter((p) => state.assignments.some((a) => a.personId === p.id && !a.pending) && !p.inactive).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const canSign = (s: Signer) => !!access?.isLead || (!!s.personId && s.personId === me?.id);
  const set = (i: number, patch: Partial<Signer>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">Certificate signed by</span>
      <ul className="space-y-2.5">
        {value.map((s, i) => (
          <li key={i} className="rounded-2xl bg-page p-3 ring-1 ring-line">
            <div className="grid gap-2 sm:grid-cols-2">
              <select className={inputCls} value={s.personId ?? ""} onChange={(e) => { const p = state.people.find((x) => x.id === e.target.value); set(i, { personId: p?.id, name: p ? fullName(p) : s.name, signature: p?.id === s.personId ? s.signature : undefined }); }} aria-label="Who signs">
                <option value="">{s.name && !s.personId ? s.name : "Choose who signs"}</option>
                {leaders.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
              </select>
              <input className={inputCls} value={s.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Lead Pastor" aria-label="Their title" />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {s.signature ? <img src={s.signature} alt={`${s.name}'s signature`} className="h-12 max-w-[180px] rounded-lg bg-white object-contain px-2 ring-1 ring-line" /> : <span className="text-[13px] text-muted">No signature yet{s.name ? `: a line with ${s.name.split(" ")[0]}'s name is printed instead` : ""}.</span>}
              <span className="ml-auto flex gap-1.5">
                {canSign(s) ? <>
                  <Button className="px-2.5 py-1.5 text-[13px]" onClick={() => setDrawFor(i)}><PenLine size={14} /> Draw</Button>
                  <Button className="px-2.5 py-1.5 text-[13px]" onClick={() => { setUploadFor(i); file.current?.click(); }}><ImagePlus size={14} /> Upload</Button>
                  {s.signature && <Button variant="ghost" className="px-2 py-1.5 text-[13px]" onClick={() => set(i, { signature: undefined })}>Remove</Button>}
                </> : s.personId && <span className="text-[12.5px] text-muted">Only {s.name.split(" ")[0]} or the lead pastor can add this signature.</span>}
                <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted hover:bg-alert-soft hover:text-alert" aria-label="Remove signer"><Trash2 size={15} /></button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {value.length < 3 && <button type="button" onClick={() => onChange([...value, { name: "", title: "" }])} className={cx("mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-sm font-medium text-brand")}><Plus size={15} /> Add someone who signs</button>}
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = ""; if (!f || uploadFor === null) return;
        const url = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f); });
        try { set(uploadFor, { signature: await cleanSignature(url) }); toast("Signature added"); } catch (x) { toast(x instanceof Error ? x.message : "That picture didn't work."); }
        setUploadFor(null);
      }} />
      <Sheet open={drawFor !== null} onClose={() => setDrawFor(null)} title="Draw the signature">
        {drawFor !== null && <DrawPad onCancel={() => setDrawFor(null)} onDone={(d) => { set(drawFor, { signature: d }); setDrawFor(null); toast("Signature added"); }} />}
      </Sheet>
      <p className="mt-2 text-[12.5px] text-muted">Tip: for an upload, sign on plain white paper and take a clear photo. Traqi removes the background.</p>
    </div>
  );
}
