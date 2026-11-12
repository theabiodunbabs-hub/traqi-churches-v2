"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Empty } from "@/components/ui";
import { ChurchMark, LogoMark } from "@/components/brand";
import { fullName, longDate } from "@/lib/format";

/** A printable certificate. "Save as PDF" from the print dialog gives the PDF. */
export default function Certificate() {
  const { id } = useParams<{ id: string }>();
  const { state } = useStore();
  const e = state.enrolments.find((x) => x.id === id);
  const p = e && state.programmes.find((x) => x.id === e.programmeId);
  const person = e && state.people.find((x) => x.id === e.personId);
  if (!e || !p || !person || e.status !== "completed") return <Empty title="Certificate not ready" body="It appears once the class is finished." />;
  const color = state.church.profile?.color ?? "#4f46e5";
  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={`/classes/${p.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={15} /> {p.name}</Link>
        <Button variant="primary" onClick={() => window.print()}><Download size={15} /> Save as PDF</Button>
      </div>
      <div className="relative aspect-[1.414] overflow-hidden rounded-[20px] bg-surface p-[5%] shadow-2xl ring-1 ring-line print:rounded-none print:shadow-none print:ring-0">
        <div aria-hidden className="absolute inset-3 rounded-[14px] border-2" style={{ borderColor: `${color}33` }} />
        <div aria-hidden className="absolute -right-24 -top-24 size-72 rounded-full opacity-15" style={{ background: color }} />
        <div aria-hidden className="absolute -bottom-28 -left-20 size-72 rounded-full bg-glow opacity-15" />
        <div className="relative flex h-full flex-col items-center justify-between text-center">
          <div className="flex flex-col items-center gap-3">
            <ChurchMark church={state.church} size={64} />
            <p className="font-display text-lg font-semibold tracking-wide">{state.church.name}</p>
          </div>
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[.35em] text-muted">Certificate of completion</p>
            <p className="mt-4 text-ink-soft">This is to certify that</p>
            <p className="mt-2 font-display text-[44px] font-semibold leading-tight tracking-tight" style={{ color }}>{fullName(person)}</p>
            <p className="mt-2 text-ink-soft">has faithfully completed</p>
            <p className="mt-1 font-display text-2xl font-semibold">{p.name}</p>
            <p className="mt-2 text-[14px] text-muted">{longDate(e.completedAt?.slice(0, 10))}</p>
          </div>
          <div className="flex w-full flex-wrap items-end justify-around gap-6">
            {p.signatories.map((s) => <div key={s} className="min-w-44"><div className="mb-1.5 h-px bg-black/30" /><p className="text-[13px] text-ink-soft">{s}</p></div>)}
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-muted"><LogoMark size={12} /> {e.certNo} · Issued with Traqi</p>
        </div>
      </div>
    </div>
  );
}
