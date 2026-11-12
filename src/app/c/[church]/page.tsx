"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Clock, Mail, MapPin, Phone, Radio } from "lucide-react";
import { useStore } from "@/lib/store";
import { churchPage, type PublicChurch } from "@/lib/live";
import { ChurchMark, COVERS, LogoMark } from "@/components/brand";
import { eventWhen } from "@/components/event-page";
import { WEEKDAYS } from "@/lib/domain";
import { usePublicTheme } from "@/components/theme";

const fmt = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

/** The church's public home page: traqi.space/c/heirs */
export default function ChurchHome() {
  const { church: slug } = useParams<{ church: string }>();
  const { ready, mode, state } = useStore();
  const [live, setLive] = useState<PublicChurch | null | undefined>(undefined);
  useEffect(() => { if (mode === "live") churchPage(slug).then(setLive).catch(() => setLive(null)); }, [mode, slug]);
  usePublicTheme(mode === "live" ? live?.profile : state.church.profile);
  if (!ready || (mode === "live" && live === undefined)) return null;
  const c: PublicChurch | null = mode === "live" ? live ?? null
    : { name: state.church.name, slug: state.church.slug, profile: state.church.profile ?? {}, events: state.events.filter((e) => e.status === "published" && Date.parse(e.end) > Date.now()) };
  if (!c) return <div className="flex min-h-screen items-center justify-center p-6 text-center"><p className="font-display text-2xl font-semibold">Church not found</p></div>;
  const p = c.profile;
  const color = p.color ?? "#4f46e5";
  const services = (p.services ?? []).slice().sort((a, b) => a.weekdays[0] - b.weekdays[0] || a.start.localeCompare(b.start));
  const sunday = services.filter((s) => s.kind === "sunday");

  return (
    <div className="min-h-screen bg-page">
      <header className="relative overflow-hidden px-5 pb-20 pt-6 text-white" style={{ background: `radial-gradient(900px 500px at 90% -10%, ${color}, transparent 70%), radial-gradient(700px 400px at 0% 100%, #f59e0b55, transparent 70%), var(--color-deep)` }}>
        <nav className="relative mx-auto flex max-w-5xl items-center gap-3">
          <ChurchMark church={{ name: c.name, profile: p as never }} size={42} className="ring-2 ring-white/20" />
          <span className="font-display text-lg font-semibold">{c.name}</span>
          <Link href={`/join?church=${c.slug}`} className="ml-auto hidden rounded-xl px-3.5 py-2 text-sm font-medium text-white/80 hover:bg-white/10 sm:block">Join on Traqi</Link>
          <Link href={`/checkin/${c.slug}`} className="rounded-xl bg-white/15 px-3.5 py-2 text-sm font-medium backdrop-blur hover:bg-white/25 sm:ml-0">Check in</Link>
        </nav>
        <div className="relative mx-auto mt-16 max-w-5xl md:mt-24">
          <h1 className="max-w-3xl font-display text-[46px] font-semibold leading-[1.02] tracking-tight md:text-[76px]">You belong here.</h1>
          {sunday.length > 0 && <p className="mt-5 text-[19px] text-white/80">Join us on Sundays at {sunday.map((s) => fmt(s.start)).join(" and ")}.</p>}
          <div className="mt-8 flex flex-wrap gap-2">
            <Link href={`/welcome?church=${c.slug}`} className="inline-flex items-center gap-2 rounded-2xl bg-surface px-5 py-3 font-semibold text-ink shadow-lg hover:bg-white/90">New here? Say hello <ArrowRight size={17} /></Link>
            {p.liveStream && <a href={p.liveStream} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-alert px-5 py-3 font-semibold text-white"><Radio size={17} /> Watch live</a>}
          </div>
        </div>
      </header>

      <main className="relative mx-auto -mt-10 max-w-5xl space-y-6 px-4 pb-16">
        {p.welcome && (
          <section className="card p-6 md:p-10">
            <p className="text-[13px] font-semibold uppercase tracking-[.2em]" style={{ color }}>A word from our pastor</p>
            <p className="mt-4 whitespace-pre-line font-display text-[21px] leading-relaxed tracking-tight md:text-[26px]">{p.welcome}</p>
          </section>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <section className="card p-6">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Clock size={19} style={{ color }} /> Service times</h2>
            <ul className="mt-4 space-y-3">{services.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl bg-page px-4 py-3">
                <span><b className="block font-semibold">{s.name}</b><span className="text-[13px] text-muted">{s.weekdays.length > 3 ? `${WEEKDAYS[s.weekdays[0]]} to ${WEEKDAYS[s.weekdays.at(-1)!]}` : s.weekdays.map((d) => WEEKDAYS[d]).join(", ")}{s.mode === "virtual" ? " · Online" : ""}</span></span>
                <span className="num font-semibold">{fmt(s.start)}</span>
              </li>
            ))}</ul>
          </section>
          <section className="card overflow-hidden">
            {p.address && <iframe title="Map" className="h-48 w-full border-0" loading="lazy" src={p.pin ? `https://maps.google.com/maps?q=${p.pin.lat},${p.pin.lng}&z=16&output=embed` : `https://maps.google.com/maps?q=${encodeURIComponent([p.address, p.city, p.state].filter(Boolean).join(", "))}&output=embed`} />}
            <div className="space-y-3 p-6">
              {p.address && (
                <div className="flex items-start gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-muted" />
                  <span><span className="block">{[p.address, p.city, p.state].filter(Boolean).join(", ")}</span>{p.directions && <span className="mt-1 block text-[14px] text-ink-soft">{p.directions}</span>}
                    <a className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white" target="_blank" rel="noreferrer"
                      href={p.pin ? `https://www.google.com/maps/dir/?api=1&destination=${p.pin.lat},${p.pin.lng}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([p.address, p.city, p.state].filter(Boolean).join(", "))}`}>Get directions</a></span>
                </div>
              )}
              {p.phone && <a className="flex items-center gap-3 hover:text-brand" href={`tel:${p.phone}`}><Phone size={18} className="text-muted" />{p.phone}</a>}
              {p.email && <a className="flex items-center gap-3 hover:text-brand" href={`mailto:${p.email}`}><Mail size={18} className="text-muted" />{p.email}</a>}
              <div className="flex gap-2 pt-2">
                {p.socials?.instagram && <Social href={p.socials.instagram} label="Instagram"><span className="text-[13px] font-semibold">IG</span></Social>}
                {p.socials?.facebook && <Social href={p.socials.facebook} label="Facebook"><span className="text-[13px] font-semibold">f</span></Social>}
                {p.socials?.youtube && <Social href={p.socials.youtube} label="YouTube"><span className="text-[13px] font-semibold">▶</span></Social>}
                {p.socials?.x && <Social href={p.socials.x} label="X"><span className="font-bold">𝕏</span></Social>}
              </div>
            </div>
          </section>
        </div>

        {(p.branches ?? []).length > 0 && (
          <section>
            <h2 className="mb-4 font-display text-2xl font-semibold">Our branches</h2>
            <div className="grid gap-3 md:grid-cols-2">{p.branches!.map((b) => (
              <div key={b.id} className="card flex gap-4 p-5">
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl" style={{ background: `${color}1a`, color }}>{b.logo ? <img src={b.logo} alt="" className="h-full w-full object-cover" /> : <MapPin size={20} />}</span>
                <div className="min-w-0">
                  <p className="font-semibold">{b.name}</p>
                  {b.address && <p className="text-[14px] text-ink-soft">{[b.address, b.city].filter(Boolean).join(", ")}</p>}
                  {b.directions && <p className="mt-1 text-[13px] text-muted">{b.directions}</p>}
                  {b.address && <a className="mt-2 inline-flex text-sm font-medium" style={{ color }} target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([b.address, b.city].filter(Boolean).join(", "))}`}>Get directions</a>}
                </div>
              </div>
            ))}</div>
          </section>
        )}

        {c.events.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-2xl font-semibold">Coming up</h2>
            <div className="grid gap-4 md:grid-cols-2">{c.events.map((e) => (
              <Link key={e.id} href={`/${c.slug}/${e.slug}`} className="card card-hover overflow-hidden">
                <div className="h-28 p-5 text-white" style={{ background: COVERS[e.cover % COVERS.length] }}><p className="text-[12.5px] font-medium uppercase tracking-wider text-white/80">{eventWhen(e)}</p></div>
                <div className="p-5"><p className="font-display text-xl font-semibold">{e.title}</p><p className="mt-1 text-[14px] text-ink-soft">{e.theme ?? e.tagline}</p></div>
              </Link>
            ))}</div>
          </section>
        )}
      </main>
      <footer className="flex items-center justify-center gap-2 pb-10 text-xs text-muted"><LogoMark size={16} /> Powered by Traqi for Churches</footer>
    </div>
  );
}

function Social({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" aria-label={label} className="flex size-10 items-center justify-center rounded-xl bg-page text-ink-soft ring-1 ring-line hover:text-brand">{children}</a>;
}
