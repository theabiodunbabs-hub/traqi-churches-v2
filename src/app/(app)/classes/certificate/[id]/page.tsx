"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, Loader2, Share2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Empty, toast } from "@/components/ui";
import { fullName, longDate } from "@/lib/format";
import { signersOf } from "@/lib/domain";
import { certificateCanvas, saveCanvas, shareCanvas, type Format } from "@/lib/keepsake";

/**
 * The certificate is drawn as one landscape picture, so it looks the same on a phone held upright,
 * a tablet or a laptop, and downloads as just the certificate: PNG, JPEG or an A4 landscape PDF.
 */
export default function Certificate() {
  const { id } = useParams<{ id: string }>();
  const { state } = useStore();
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState<Format | "share" | null>(null);
  const e = state.enrolments.find((x) => x.id === id);
  const p = e && state.programmes.find((x) => x.id === e.programmeId);
  const person = e && state.people.find((x) => x.id === e.personId);
  const ready = !!(e && p && person && e.status === "completed");

  useEffect(() => {
    if (!ready) return;
    let live = true;
    certificateCanvas({
      name: fullName(person), course: p!.name, date: longDate(e!.completedAt?.slice(0, 10)), certNo: e!.certNo,
      signers: signersOf(p!), church: { name: state.church.name, logo: state.church.profile?.logo, color: state.church.profile?.color ?? "#4f46e5" },
      verifyUrl: typeof window !== "undefined" && e!.certNo ? `${location.origin}/c/${state.church.slug}?cert=${encodeURIComponent(e!.certNo)}` : undefined,
    }).then((c) => { if (live) setCanvas(c); });
    return () => { live = false; };
  }, [ready, e, p, person, state.church]);

  if (!ready) return <Empty title="Certificate not ready" body="It appears once the course is finished." />;
  const name = `${p!.name} certificate ${fullName(person)}`;
  const save = async (f: Format) => { if (!canvas) return; setBusy(f); try { await saveCanvas(canvas, name, f); } finally { setBusy(null); } };

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/classes/${p!.id}`} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={15} /> {p!.name}</Link>
      <div className="overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-line">
        {canvas ? <img src={canvas.toDataURL("image/jpeg", 0.9)} alt={`Certificate for ${fullName(person)}`} className="block aspect-[1.414] w-full" />
          : <div className="flex aspect-[1.414] w-full items-center justify-center text-muted"><Loader2 className="animate-spin" /></div>}
      </div>
      <p className="mt-3 text-center text-[13px] text-muted">Always landscape. Turn your phone sideways to see it bigger.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button variant="primary" disabled={!canvas || !!busy} onClick={() => void save("pdf")}><Download size={15} /> {busy === "pdf" ? "Saving…" : "PDF"}</Button>
        <Button disabled={!canvas || !!busy} onClick={() => void save("png")}><Download size={15} /> {busy === "png" ? "Saving…" : "PNG image"}</Button>
        <Button disabled={!canvas || !!busy} onClick={() => void save("jpeg")}><Download size={15} /> {busy === "jpeg" ? "Saving…" : "JPEG image"}</Button>
        <Button disabled={!canvas || !!busy} onClick={async () => { if (!canvas) return; setBusy("share"); try { if (!(await shareCanvas(canvas, name, `I finished ${p!.name} at ${state.church.name}!`))) { await saveCanvas(canvas, name, "png"); toast("Saved. Share it from your photos."); } } finally { setBusy(null); } }}><Share2 size={15} /> Share</Button>
      </div>
    </div>
  );
}
