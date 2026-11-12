"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, ExternalLink, Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Field, PageHeader, Panel, Toggle, cx, inputCls, toast } from "@/components/ui";
import { ChurchMark } from "@/components/brand";
import { BrandPicker } from "@/components/brand-picker";
import { CustomFieldsEditor } from "@/components/custom-fields";
import { DEFAULT_TERMS, TERM_LABELS } from "@/lib/words";
import { CURRENCY_SYMBOL, money } from "@/lib/format";
import type { ChurchProfile, Resource } from "@/lib/types";
import { DownloadButton } from "@/components/download";
import { fullChurch } from "@/lib/exports";

const RESOURCE_KINDS: { k: Resource["kind"]; label: string; test: RegExp }[] = [
  { k: "youtube", label: "YouTube", test: /youtu/ }, { k: "telegram", label: "Telegram", test: /t\.me|telegram/ },
  { k: "drive", label: "Google Drive", test: /drive\.google|docs\.google/ }, { k: "podcast", label: "Podcast", test: /podcast|spotify|anchor/ },
  { k: "instagram", label: "Instagram", test: /instagram/ }, { k: "facebook", label: "Facebook", test: /facebook|fb\.watch/ },
  { k: "website", label: "Website", test: /./ },
];

/** WhatsApp community, latest sermon and resource links members see on their home page. */
function CommunityEditor({ p, set }: { p: ChurchProfile; set: <K extends keyof ChurchProfile>(k: K, v: ChurchProfile[K]) => void }) {
  const list = p.resources ?? [];
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const add = () => {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return toast("Paste a full link, starting with https://");
    const kind = RESOURCE_KINDS.find((k) => k.test.test(u.toLowerCase()))?.k ?? "other";
    set("resources", [...list, { id: `rs${Date.now()}`, title: title.trim() || RESOURCE_KINDS.find((k) => k.k === kind)?.label || "Link", url: u, kind }]);
    setTitle(""); setUrl("");
  };
  return (
    <div className="space-y-4">
      <Field label="WhatsApp community link" hint="Members see a Join button on their home page.">
        <input className={inputCls} inputMode="url" placeholder="https://chat.whatsapp.com/…" value={p.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value.trim() || undefined)} />
      </Field>
      <label className="flex items-center gap-3 rounded-2xl bg-page px-4 py-3 ring-1 ring-line">
        <span className="flex-1"><span className="block text-[14.5px]">Show it to people not yet confirmed</span><span className="block text-[12.5px] text-muted">People who joined through Traqi search, before you confirm them</span></span>
        <Toggle label="Show WhatsApp link to unconfirmed joiners" on={!!p.whatsappForUnconfirmed} onChange={(v) => set("whatsappForUnconfirmed", v)} />
      </label>
      <Field label="Latest sermon or message" hint="Opens on YouTube or wherever it lives. Traqi doesn't play it.">
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={inputCls} placeholder="Title" value={p.pinnedMessage?.title ?? ""} onChange={(e) => set("pinnedMessage", { title: e.target.value, url: p.pinnedMessage?.url ?? "" })} />
          <input className={inputCls} inputMode="url" placeholder="https://youtube.com/…" value={p.pinnedMessage?.url ?? ""} onChange={(e) => set("pinnedMessage", { title: p.pinnedMessage?.title ?? "", url: e.target.value.trim() })} />
        </div>
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-medium">Resource links</p>
        {list.length > 0 && (
          <ul className="mb-2 divide-y divide-line rounded-2xl ring-1 ring-line">
            {list.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="rounded-md bg-page px-1.5 text-[11px] font-medium text-ink-soft ring-1 ring-line">{RESOURCE_KINDS.find((k) => k.k === r.kind)?.label ?? "Link"}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium">{r.title}</span><span className="block truncate text-[12px] text-muted">{r.url}</span></span>
                <button onClick={() => set("resources", list.filter((x) => x.id !== r.id))} className="rounded-lg p-2 text-muted hover:bg-alert-soft hover:text-alert" aria-label={`Remove ${r.title}`}><X size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
          <input className={inputCls} placeholder="Sermons on YouTube" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className={inputCls} inputMode="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
          <Button onClick={add}><Plus size={15} /> Add</Button>
        </div>
      </div>
    </div>
  );
}

export default function ChurchSettings() {
  const { state, access, updateChurch } = useStore();
  const [p, setP] = useState<ChurchProfile>(() => ({ ...(state.church.profile as ChurchProfile) }));
  const [name, setName] = useState(state.church.name);
  const [goal, setGoal] = useState(state.church.attendanceGoal ?? 0);
  const [newCat, setNewCat] = useState("");
  if (!access) return null;
  if (!(access.can("roles.manage") || access.isLead)) return <p className="text-muted">Only the lead pastor and the admin can change the church profile.</p>;
  const set = <K extends keyof ChurchProfile>(k: K, v: ChurchProfile[K]) => setP({ ...p, [k]: v });
  const origin = typeof window !== "undefined" ? location.origin : "";
  const links = [["Church page", `/c/${state.church.slug}`], ["Sunday check-in", `/checkin/${state.church.slug}`], ["First-timer welcome", `/welcome?church=${state.church.slug}`]];
  const save = () => { const clean = { ...p, terms: Object.fromEntries(Object.entries(p.terms ?? {}).filter(([, v]) => v?.trim())) }; updateChurch({ name: name.trim() || state.church.name, attendanceGoal: goal || undefined }, clean, "updated the church profile"); toast("Church profile saved"); };
  const color = p.color ?? "#4f46e5";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Church profile" sub="Your name, look and details. They appear on every public page and certificate." actions={<Button variant="primary" onClick={save}><Check size={16} /> Save changes</Button>} />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Panel title="Look">
            <div className="mb-5"><Field label="Church name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field></div>
            <BrandPicker name={name} value={{ logo: p.logo, color: p.color, accent: p.accent, heading: p.heading }} onChange={(v) => setP({ ...p, ...v })} />
          </Panel>

          <Panel title="Your church's words">
            <p className="mb-4 text-[14px] text-ink-soft">Use the words your church already uses. Menus, buttons, reports and downloads all follow them.</p>
            <div className="space-y-3">
              {TERM_LABELS.map((t) => (
                <div key={t.key} className="grid gap-2 rounded-2xl bg-page p-3 ring-1 ring-line sm:grid-cols-[160px_1fr_1fr] sm:items-center">
                  <span><b className="block text-[14px] font-semibold">{DEFAULT_TERMS[t.key]}</b><span className="text-[12px] text-muted">{t.hint}</span></span>
                  <input className={inputCls} aria-label={`Your word for ${DEFAULT_TERMS[t.key]}`} placeholder={t.examples.split(",")[0]} value={p.terms?.[t.key] ?? ""}
                    onChange={(e) => setP({ ...p, terms: { ...p.terms, [t.key]: e.target.value } })} />
                  {t.plural ? <input className={inputCls} aria-label={`Plural of your word for ${DEFAULT_TERMS[t.key]}`} placeholder={`Plural, e.g. ${DEFAULT_TERMS[t.plural]}`} value={p.terms?.[t.plural] ?? ""}
                    onChange={(e) => setP({ ...p, terms: { ...p.terms, [t.plural!]: e.target.value } })} /> : <span className="hidden text-[12px] text-muted sm:block">e.g. {t.examples}</span>}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Extra details about people">
            <CustomFieldsEditor value={p.customFields ?? []} onChange={(v) => setP({ ...p, customFields: v })} />
          </Panel>

          <Panel title="Contact and public page">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Church email" hint="Messages to members come from this address."><input className={inputCls} type="email" value={p.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Phone"><input className={inputCls} value={p.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
            </div>
            <div className="mt-3 space-y-3">
              <Field label="Street address"><input className={inputCls} value={p.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City or area"><input className={inputCls} value={p.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>
                <Field label="State"><input className={inputCls} value={p.state ?? ""} onChange={(e) => set("state", e.target.value)} /></Field>
              </div>
              <Field label="How to find you" hint="Shown with a Get directions button."><textarea className={cx(inputCls, "min-h-20")} value={p.directions ?? ""} onChange={(e) => set("directions", e.target.value)} placeholder="Opposite First Bank, white gate with our blue sign." /></Field>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => navigator.geolocation?.getCurrentPosition((x) => { set("pin", { lat: +x.coords.latitude.toFixed(6), lng: +x.coords.longitude.toFixed(6) }); toast("Map pin added. Save to keep it."); }, () => toast("We couldn't get your location"))}>
                  {p.pin ? "Update the map pin" : "Add a map pin"}
                </Button>
                {p.pin && <span className="text-[12.5px] text-muted">{p.pin.lat}, {p.pin.lng} · <button className="font-medium text-alert" onClick={() => set("pin", undefined)}>Remove</button></span>}
                <span className="text-[12px] text-muted">Optional. Best done inside the church.</span>
              </div>
              <Field label="A welcome from the pastor"><textarea className={cx(inputCls, "min-h-28")} value={p.welcome ?? ""} onChange={(e) => set("welcome", e.target.value)} /></Field>
              <Field label="Live stream link"><input className={inputCls} value={p.liveStream ?? ""} onChange={(e) => set("liveStream", e.target.value)} placeholder="https://youtube.com/@…" /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["instagram", "facebook", "youtube", "x"] as const).map((k) => <Field key={k} label={k === "x" ? "X" : k[0].toUpperCase() + k.slice(1)}><input className={inputCls} value={p.socials?.[k] ?? ""} onChange={(e) => set("socials", { ...p.socials, [k]: e.target.value })} placeholder="https://…" /></Field>)}
              </div>
            </div>
          </Panel>

          <Panel title="Community and resources">
            <CommunityEditor p={p} set={set} />
          </Panel>
          <Panel title="Offerings and welfare">
            <div className="space-y-4">
              <Field label="Welfare approval limit for pastors" hint={`Above ${money(p.approvalLimit)}, the lead pastor decides.`}><input inputMode="numeric" className={inputCls} value={p.approvalLimit} onChange={(e) => set("approvalLimit", Number(e.target.value.replace(/\D/g, "")) || 0)} /></Field>
              <label className="flex items-center justify-between gap-3 rounded-xl bg-page p-3 text-sm ring-1 ring-line"><span>Every offering count needs a witness</span><Toggle label="Witness" on={p.witness} onChange={(v) => set("witness", v)} /></label>
              <div><span className="mb-1.5 block text-sm font-medium">Kinds of giving</span>
                <div className="flex flex-wrap gap-1.5">{p.categories.map((c) => <span key={c} className="inline-flex items-center gap-1 rounded-full bg-page py-1 pl-3 pr-1 text-sm ring-1 ring-line">{c}<button onClick={() => set("categories", p.categories.filter((x) => x !== c))} className="rounded-full p-1 text-muted hover:bg-surface" aria-label={`Remove ${c}`}><X size={12} /></button></span>)}
                  <form onSubmit={(e) => { e.preventDefault(); if (newCat.trim()) { set("categories", [...p.categories, newCat.trim()]); setNewCat(""); } }} className="flex"><input className="w-36 rounded-full bg-surface px-3 py-1 text-sm ring-1 ring-line outline-none focus:ring-brand" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Add a kind" /></form>
                </div>
              </div>
              <div><span className="mb-1.5 block text-sm font-medium">Currencies counted</span>
                <div className="flex flex-wrap gap-1.5">{Object.keys(CURRENCY_SYMBOL).map((c) => <button key={c} onClick={() => c !== "NGN" && set("currencies", p.currencies.includes(c) ? p.currencies.filter((x) => x !== c) : [...p.currencies, c])} className={cx("rounded-full px-3 py-1.5 text-sm ring-1", p.currencies.includes(c) ? "bg-deep text-white ring-deep" : "bg-surface ring-line")}>{CURRENCY_SYMBOL[c]} {c}</button>)}</div>
              </div>
              <Field label="Sunday attendance goal"><input inputMode="numeric" className={inputCls} value={goal || ""} onChange={(e) => setGoal(Number(e.target.value.replace(/\D/g, "")) || 0)} placeholder="300" /></Field>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Your links">
            <ul className="space-y-2">{links.map(([l, path]) => (
              <li key={l} className="rounded-2xl bg-page p-3 ring-1 ring-line">
                <p className="text-[13px] font-semibold">{l}</p>
                <div className="mt-1 flex items-center gap-1"><span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">{(origin + path).replace(/^https?:\/\//, "")}</span>
                  <button onClick={() => { navigator.clipboard?.writeText(origin + path); toast("Link copied"); }} className="rounded-lg p-1.5 hover:bg-surface" aria-label={`Copy ${l}`}><Copy size={14} /></button>
                  <Link href={path} target="_blank" className="rounded-lg p-1.5 hover:bg-surface" aria-label={`Open ${l}`}><ExternalLink size={14} /></Link></div>
              </li>
            ))}</ul>
          </Panel>
          <div id="data" className="scroll-mt-20" />
          <Panel title="Your data">
            <p className="text-[13.5px] text-ink-soft">Every list has a Download button for Excel or CSV. Download everything at once here: people, children, first-timers, departments, Sundays and events{access.canFinance ? ", and giving" : ""}.</p>
            <p className="mt-2 text-[12.5px] text-muted">Care notes, welfare and prayer requests are never downloaded. Every download is recorded in the activity log.</p>
            {(access.isLead || access.can("sheets.connect")) && <DownloadButton className="mt-3" what="Whole church" label="Download everything" sheets={() => fullChurch(state, access)} />}
          </Panel>
          <div className="overflow-hidden rounded-3xl text-white" style={{ background: `radial-gradient(400px 200px at 100% 0%, ${color}, transparent 70%), var(--color-deep)` }}>
            <div className="p-5"><ChurchMark church={{ name, profile: p }} size={40} /><p className="mt-8 font-display text-2xl font-semibold leading-tight">You belong here.</p><p className="mt-1 text-sm text-white/70">How your public pages look</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

