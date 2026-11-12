"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Building2, Map as MapIcon, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Empty, Field, PageHeader, Panel, Sheet, Tabs, Toggle, cx, inputCls, toast } from "@/components/ui";
import { DownloadButton } from "@/components/download";
import { branchStats, type BranchRow } from "@/lib/branches";
import { slugify } from "@/lib/events";
import { uploadImage } from "@/lib/upload";
import { fullName } from "@/lib/format";
import { LEVELS } from "@/lib/setup";
import type { Branch, ChurchLevel } from "@/lib/types";

type Tab = "league" | "branches" | "regions" | "setup";
type SortKey = keyof Pick<BranchRow, "people" | "lastSunday" | "firstTimers" | "cameBack" | "serving" | "growth">;

export default function Branches() {
  const { state, access } = useStore();
  const branches = state.church.profile?.branches ?? [];
  const [tab, setTab] = useState<Tab>(branches.length ? "league" : "branches");
  if (!access) return null;
  if (!access.isPastoral && !access.can("roles.manage")) return <Empty title="For pastors and admins" body="Branches are set up by headquarters." />;
  const network = state.church.profile?.level === "network" || (state.church.profile?.regions ?? []).length > 0;
  return (
    <div>
      <PageHeader title="Branches" sub="Headquarters sees every branch. Each branch pastor sees their own people, services and departments." />
      <Tabs className="mb-6" value={tab} onChange={setTab} items={[
        ...(branches.length ? [{ key: "league" as Tab, label: "How branches are doing" }] : []),
        { key: "branches", label: "Branches", count: branches.length },
        ...(network ? [{ key: "regions" as Tab, label: "Regions" }] : []),
        { key: "setup", label: "Size and offerings" },
      ]} />
      {tab === "league" && <League />}
      {tab === "branches" && <BranchList />}
      {tab === "regions" && <Regions />}
      {tab === "setup" && <Setup />}
    </div>
  );
}

function League() {
  const { state } = useStore();
  const rows = useMemo(() => branchStats(state), [state]);
  const [sort, setSort] = useState<SortKey>("lastSunday");
  const sorted = [...rows].sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
  const cols: { k: SortKey; label: string; fmt?: (v: number | null) => string }[] = [
    { k: "people", label: "People" }, { k: "lastSunday", label: "Last Sunday" }, { k: "firstTimers", label: "First-timers this month" },
    { k: "cameBack", label: "Came back", fmt: (v) => (v === null ? "–" : `${v}%`) }, { k: "serving", label: "Serving", fmt: (v) => `${v}%` },
    { k: "growth", label: "On last month", fmt: (v) => (v === null ? "–" : v > 0 ? `+${v}` : String(v)) },
  ];
  return (
    <Panel title={<span className="flex items-center gap-2"><Trophy size={17} className="text-glow-ink" /> League table</span>} action={
      <DownloadButton what="Branch league table" small sheets={() => [{ name: "Branches", rows: sorted, columns: [{ key: "name", label: "Branch", value: (r: BranchRow) => r.name, width: 24 }, ...cols.map((c) => ({ key: c.k, label: c.label, value: (r: BranchRow) => r[c.k] }))] }]} />
    }>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[640px] text-[14px]">
          <thead><tr className="text-left text-[12px] uppercase tracking-wider text-muted">
            <th className="pb-2 pr-3 font-semibold">#</th><th className="pb-2 pr-3 font-semibold">Branch</th>
            {cols.map((c) => <th key={c.k} className="pb-2 pr-3 text-right font-semibold"><button onClick={() => setSort(c.k)} className={cx("inline-flex items-center gap-1", sort === c.k && "text-brand")}>{c.label}{sort === c.k && <ArrowDown size={12} />}</button></th>)}
          </tr></thead>
          <tbody className="divide-y divide-line">{sorted.map((r, i) => (
            <tr key={r.id}>
              <td className="py-3 pr-3"><span className={cx("flex size-7 items-center justify-center rounded-lg text-[12px] font-bold", i === 0 ? "bg-glow text-white" : i === 1 ? "bg-j2 text-on-light" : "bg-page text-muted")}>{i + 1}</span></td>
              <td className="py-3 pr-3"><b className="font-medium">{r.name}</b>{r.city && <span className="block text-[12px] text-muted">{r.city}</span>}</td>
              {cols.map((c) => <td key={c.k} className={cx("num py-3 pr-3 text-right", sort === c.k && "font-semibold", c.k === "growth" && (r.growth > 0 ? "text-good" : r.growth < 0 ? "text-alert" : ""))}>{c.fmt ? c.fmt(r[c.k]) : r[c.k]}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="mt-4 text-[12.5px] text-muted">Last Sunday counts people who checked in. Tap a column to sort.</p>
    </Panel>
  );
}

function BranchList() {
  const { state, removeBranch } = useStore();
  const [edit, setEdit] = useState<Branch | "new" | null>(null);
  const branches = state.church.profile?.branches ?? [];
  const regions = state.church.profile?.regions ?? [];
  return (
    <div className="space-y-4">
      {branches.length === 0 ? (
        <div className="card flex flex-col items-center p-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Building2 size={26} /></span>
          <p className="mt-4 font-display text-xl font-semibold">One church, many places</p>
          <p className="mt-1 max-w-md text-ink-soft">Add a branch for each place your church meets. Each starts with your departments, which the branch can change and add to.</p>
          <Button variant="primary" className="mt-5" onClick={() => setEdit("new")}><Plus size={16} /> Add a branch</Button>
        </div>
      ) : (
        <>
          <div className="flex justify-end"><Button variant="primary" onClick={() => setEdit("new")}><Plus size={16} /> Add a branch</Button></div>
          <div className="grid gap-3 md:grid-cols-2">{branches.map((b) => {
            const people = state.people.filter((p) => p.branchId === b.id && !p.inactive).length;
            const pastor = state.people.find((p) => p.id === b.pastorId);
            return (
              <div key={b.id} className="card flex gap-4 p-5">
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-soft text-brand">{b.logo ? <img src={b.logo} alt="" className="h-full w-full object-cover" /> : <Building2 size={22} />}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[17px] font-semibold">{b.name}</p>
                  <p className="text-[13px] text-muted">{[b.city, regions.find((r) => r.id === b.regionId)?.name].filter(Boolean).join(" · ") || "No city yet"}</p>
                  <p className="mt-2 text-[13.5px] text-ink-soft">{people} people · {pastor ? `Pastor: ${fullName(pastor)}` : "No branch pastor yet"}</p>
                  <p className="mt-1 truncate text-[12.5px] text-muted">traqi.space/c/{state.church.slug} · {b.slug}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setEdit(b)} className="rounded-lg p-2 text-muted hover:bg-page hover:text-ink" aria-label={`Edit ${b.name}`}><Pencil size={15} /></button>
                  <button onClick={() => { if (confirm(`Close ${b.name}? Its people will belong to headquarters, and its departments will be removed.`)) removeBranch(b.id); }} className="rounded-lg p-2 text-muted hover:bg-alert-soft hover:text-alert" aria-label={`Close ${b.name}`}><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}</div>
        </>
      )}
      {edit && <BranchSheet branch={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function BranchSheet({ branch, onClose }: { branch?: Branch; onClose: () => void }) {
  const { state, saveBranch, newId } = useStore();
  const [b, setB] = useState<Branch>(branch ?? { id: newId("br"), name: "", slug: "" });
  const [copy, setCopy] = useState(true);
  const [busy, setBusy] = useState(false);
  const regions = state.church.profile?.regions ?? [];
  const taken = (state.church.profile?.branches ?? []).filter((x) => x.id !== b.id).map((x) => x.slug);
  const leaders = state.people.filter((p) => !p.inactive && !p.isChild && (p.isLeader || ["leader", "worker"].includes(p.stage))).sort((x, y) => fullName(x).localeCompare(fullName(y)));
  const save = () => {
    if (b.name.trim().length < 2) return toast("Give the branch a name");
    const slug = b.slug || slugify(b.name);
    if (taken.includes(slug)) return toast("Another branch already uses that short name");
    if (!b.address?.trim()) return toast("Add the branch's address so people can find it");
    saveBranch({ ...b, name: b.name.trim(), slug }, !branch && copy);
    toast(branch ? "Branch saved" : `${b.name} added`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={branch ? `Edit ${branch.name}` : "Add a branch"} footer={<Button variant="primary" className="w-full py-3" disabled={busy} onClick={save}>{branch ? "Save" : "Add branch"}</Button>}>
      <div className="space-y-4">
        <Field label="Name"><input className={inputCls} value={b.name} onChange={(x) => setB({ ...b, name: x.target.value, slug: branch ? b.slug : slugify(x.target.value) })} placeholder="Heirs Church, Lekki" /></Field>
        <Field label="Short name" hint="Used in links and lists."><input className={inputCls} value={b.slug} onChange={(x) => setB({ ...b, slug: slugify(x.target.value) })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="City or area"><input className={inputCls} value={b.city ?? ""} onChange={(x) => setB({ ...b, city: x.target.value || undefined })} /></Field>
          {regions.length > 0 && <Field label="Region"><select className={inputCls} value={b.regionId ?? ""} onChange={(x) => setB({ ...b, regionId: x.target.value || undefined })}><option value="">None</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>}
        </div>
        <Field label="Address"><input className={inputCls} value={b.address ?? ""} onChange={(x) => setB({ ...b, address: x.target.value || undefined })} /></Field>
        <Field label="Directions"><textarea rows={2} className={inputCls} value={b.directions ?? ""} onChange={(x) => setB({ ...b, directions: x.target.value || undefined })} placeholder="Opposite the filling station, second gate" /></Field>
        <Field label="Branch pastor" hint="Give them the Pastor role for this branch in Roles, so they can manage it.">
          <select className={inputCls} value={b.pastorId ?? ""} onChange={(x) => setB({ ...b, pastorId: x.target.value || undefined })}><option value="">Choose later</option>{leaders.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}</select>
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Branch logo (optional)</span>
          <p className="mb-2 text-[12.5px] text-muted">The colours stay the same as headquarters. A branch can use its own version of the logo.</p>
          <div className="flex items-center gap-3">
            <span className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-page ring-1 ring-line">{b.logo ? <img src={b.logo} alt="" className="h-full w-full object-cover" /> : <Building2 size={20} className="text-muted" />}</span>
            <label className="cursor-pointer text-sm font-medium text-brand">{b.logo ? "Change" : "Upload"}<input type="file" accept="image/*" hidden onChange={async (x) => { const f = x.target.files?.[0]; if (!f) return; setBusy(true); try { setB({ ...b, logo: await uploadImage(f, "logo", 512, true) }); } finally { setBusy(false); } }} /></label>
            {b.logo && <button className="text-sm text-alert" onClick={() => setB({ ...b, logo: undefined })}>Remove</button>}
          </div>
        </div>
        {!branch && (
          <label className="flex items-center justify-between gap-3 rounded-xl bg-page p-3 text-sm ring-1 ring-line">
            <span><b className="font-medium">Start with headquarters&apos; departments</b><span className="block text-[12.5px] text-muted">The branch can rename, remove and add its own</span></span>
            <Toggle label="Copy departments" on={copy} onChange={setCopy} />
          </label>
        )}
      </div>
    </Sheet>
  );
}

function Regions() {
  const { state, updateChurch, newId } = useStore();
  const regions = state.church.profile?.regions ?? [];
  const branches = state.church.profile?.branches ?? [];
  const [name, setName] = useState("");
  const set = (r: typeof regions, text: string) => updateChurch({}, { regions: r }, text);
  const leaders = state.people.filter((p) => !p.inactive && (p.isLeader || p.stage === "leader"));
  return (
    <div className="space-y-4">
      <form className="flex gap-2" onSubmit={(x) => { x.preventDefault(); if (name.trim()) { set([...regions, { id: newId("rg"), name: name.trim() }], `added the ${name.trim()} region`); setName(""); } }}>
        <input className={cx(inputCls, "flex-1")} value={name} onChange={(x) => setName(x.target.value)} placeholder="New region, e.g. Lagos Mainland" /><Button type="submit"><Plus size={15} /> Add</Button>
      </form>
      {regions.length === 0 ? <Empty title="No regions yet" body="Group branches into regions or zones, each with an overseer." icon={<MapIcon size={26} />} /> : (
        <div className="grid gap-3 md:grid-cols-2">{regions.map((r, i) => (
          <div key={r.id} className="card p-5">
            <div className="flex items-center gap-2">
              <input className="min-w-0 flex-1 bg-transparent font-display text-[17px] font-semibold outline-none" value={r.name} onChange={(x) => set(regions.map((y) => (y.id === r.id ? { ...y, name: x.target.value } : y)), "renamed a region")} />
              <button disabled={i === 0} onClick={() => { const n = [...regions]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set(n, "reordered regions"); }} className="rounded-lg p-1.5 text-muted disabled:opacity-30" aria-label="Move up"><ArrowUp size={14} /></button>
              <button onClick={() => set(regions.filter((y) => y.id !== r.id), `removed the ${r.name} region`)} className="rounded-lg p-1.5 text-muted hover:text-alert" aria-label={`Remove ${r.name}`}><Trash2 size={14} /></button>
            </div>
            <Field label="Regional overseer"><select className={inputCls} value={r.overseerId ?? ""} onChange={(x) => set(regions.map((y) => (y.id === r.id ? { ...y, overseerId: x.target.value || undefined } : y)), `set the overseer for ${r.name}`)}><option value="">Not yet</option>{leaders.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}</select></Field>
            <p className="mt-3 text-[13px] text-muted">{branches.filter((b) => b.regionId === r.id).map((b) => b.name).join(", ") || "No branches in this region yet. Choose the region when editing a branch."}</p>
          </div>
        ))}</div>
      )}
    </div>
  );
}

function Setup() {
  const { state, updateChurch } = useStore();
  const level = state.church.profile?.level ?? "growing";
  const at = state.church.profile?.offeringsAt ?? "hq";
  return (
    <div className="space-y-5">
      <Panel title="Your church's size">
        <p className="mb-3 text-[13.5px] text-ink-soft">You can change this as you grow. Nothing is lost.</p>
        <div className="grid gap-2 md:grid-cols-2">{LEVELS.map((l) => (
          <button key={l.k} onClick={() => updateChurch({}, { level: l.k as ChurchLevel }, `changed the church size to ${l.name}`)} className={cx("rounded-2xl p-4 text-left ring-1", level === l.k ? "bg-brand-soft ring-2 ring-brand" : "bg-page ring-line hover:ring-ink/20")}>
            <b className="block">{l.name}</b><span className="text-[13px] text-muted">{l.who}</span>
          </button>
        ))}</div>
      </Panel>
      <Panel title="Offerings">
        <div className="grid gap-2 md:grid-cols-2">
          {([["branch", "Each branch counts its own", "Branch counters record and lodge; headquarters sees the totals"], ["hq", "Sent to headquarters", "Branches don't record offerings; headquarters does"]] as const).map(([k, t, d]) => (
            <button key={k} onClick={() => updateChurch({}, { offeringsAt: k }, `set offerings to ${k === "branch" ? "counted per branch" : "handled by headquarters"}`)} className={cx("rounded-2xl p-4 text-left ring-1", at === k ? "bg-brand-soft ring-2 ring-brand" : "bg-page ring-line")}>
              <b className="block">{t}</b><span className="text-[13px] text-muted">{d}</span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
