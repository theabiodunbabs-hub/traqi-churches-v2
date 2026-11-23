"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff, SwitchCamera, X } from "lucide-react";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
declare global { interface Window { BarcodeDetector?: new (o: { formats: string[] }) => Detector } }

/**
 * Scans QR codes with the phone's own camera, inside Traqi: no other app needed.
 * Uses the browser's barcode reader where there is one (Android Chrome) and jsQR everywhere else (iPhone Safari).
 * Calls onCode once per code; the same code is ignored for a few seconds so one ticket isn't read twice.
 */
export function QrScanner({ onCode, onClose, paused }: { onCode: (code: string) => void; onClose: () => void; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState("");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const cb = useRef(onCode); cb.current = onCode;
  const hold = useRef(paused); hold.current = paused;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false; let raf = 0;
    const last = { code: "", at: 0 };
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setErr("This browser can't open the camera. Type the ticket ID instead."); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch (x) {
        setErr(x instanceof Error && x.name === "NotAllowedError" ? "Camera access was blocked. Allow the camera for this site in your browser settings, then try again." : "Couldn't open the camera. Type the ticket ID instead.");
        return;
      }
      if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
      const v = video.current!; v.srcObject = stream; v.setAttribute("playsinline", "true"); await v.play().catch(() => {});
      const native = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
      const jsqr = native ? null : (await import("jsqr")).default;
      const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const seen = (code: string) => {
        const now = Date.now();
        if (!code || hold.current || (code === last.code && now - last.at < 4000)) return;
        last.code = code; last.at = now;
        try { navigator.vibrate?.(60); } catch { /* not supported */ }
        cb.current(code);
      };
      let busy = false;
      const tick = async () => {
        if (stop) return;
        if (!busy && v.readyState >= 2 && v.videoWidth) {
          busy = true;
          try {
            if (native) { const r = await native.detect(v); if (r[0]) seen(r[0].rawValue); }
            else if (jsqr) {
              const w = Math.min(640, v.videoWidth); const h = Math.round((w / v.videoWidth) * v.videoHeight);
              canvas.width = w; canvas.height = h; ctx.drawImage(v, 0, 0, w, h);
              const r = jsqr(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
              if (r?.data) seen(r.data);
            }
          } catch { /* a frame that couldn't be read */ }
          busy = false;
        }
        raf = requestAnimationFrame(() => void tick());
      };
      void tick();
    })();
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [facing]);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-black">
      {err ? (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 p-6 text-center text-white"><CameraOff size={30} /><p className="text-[14.5px]">{err}</p></div>
      ) : (
        <>
          <video ref={video} muted playsInline className="aspect-[4/3] w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="size-[58%] max-h-[70%] rounded-3xl ring-4 ring-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,.35)]" /></div>
          <p className="absolute inset-x-0 bottom-3 text-center text-[13px] font-medium text-white drop-shadow">{paused ? "Checking…" : "Point the camera at the ticket's QR code"}</p>
        </>
      )}
      <div className="absolute right-2 top-2 flex gap-1.5">
        {!err && <button type="button" onClick={() => setFacing(facing === "environment" ? "user" : "environment")} className="rounded-full bg-black/55 p-2.5 text-white" aria-label="Switch camera"><SwitchCamera size={18} /></button>}
        <button type="button" onClick={onClose} className="rounded-full bg-black/55 p-2.5 text-white" aria-label="Close the camera"><X size={18} /></button>
      </div>
    </div>
  );
}

/** A QR code on a ticket holds the ticket ID; older or other links may hold a URL ending with it. */
export const codeFromScan = (raw: string) => {
  const t = raw.trim();
  const m = /([A-Z0-9]{2,6}-[A-Z0-9]{3,})\s*$/i.exec(t);
  return (m ? m[1] : t).toUpperCase();
};
