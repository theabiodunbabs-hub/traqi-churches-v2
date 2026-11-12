"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { useStore, type ImportRow } from "@/lib/store";
import { Button, Empty, PageHeader, Panel, cx, inputCls } from "@/components/ui";

type FieldKey = "skip" | "fullName" | "firstName" | "lastName" | "gender" | "phone" | "whatsapp" | "email" | "birthday" | "location" | "occupation" | "department";
const FIELDS: { key: FieldKey; label: string; guess: RegExp }[] = [
  { key: "fullName", label: "Full name", guess: /^(full ?name|name|names)$/i },
  { key: "firstName", label: "First name", guess: /first|given|fore/i },
  { key: "lastName", label: "Last name", guess: /last|sur|family/i },
  { key: "gender", label: "Gender", guess: /gender|sex/i },
  { key: "phone", label: "Phone", guess: /phone|mobile|tel|gsm|number/i },
  { key: "whatsapp", label: "WhatsApp", guess: /whats/i },
  { key: "email", label: "Email", guess: /mail/i },
  { key: "birthday", label: "Birthday", guess: /birth|dob/i },
  { key: "location", label: "Area", guess: /area|address|location|city|lives/i },
  { key: "occupation", label: "Occupation", guess: /occup|job|work|profession/i },
  { key: "department", label: "Department", guess: /dept|department|unit|ministry/i },
];

const SAMPLE = [
  ["Full name", "Phone number", "Sex", "Date of birth", "Area", "Occupation", "Department"],
  ["Olamide Bakare", "0803 551 2290", "Male", "12/04/1990", "Yaba", "Engineer", "Edify Worship"],
  ["Chiamaka Obi", "0816 223 9045", "Female", "03/11/1995", "Surulere", "Nurse", "Ushering"],
  ["Adewale Johnson", "0905 118 7734", "M", "", "Ikeja", "Banker", ""],
  ["Ruth Okafor", "0703 664 1120", "F", "21/07/1988", "Lekki", "", "Welfare"],
  ["Samuel Etim", "", "Male", "", "Ajah", "Student", ""],
  ["Grace Ademola", "0802 997 3301", "Female", "15/02/1992", "Gbagada", "Teacher", "Media"],
];

const guessField = (h: string): FieldKey => FIELDS.find((f) => f.guess.test(h.trim()))?.key ?? "skip";

function toDate(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "number") { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : undefined; }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // Nigerian order: day/month/year
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return undefined;
}

export default function Import() {
  const { access, state, findByPhone, importPeople } = useStore();
  const [file, setFile] = useState<string | null>(null);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [map, setMap] = useState<FieldKey[]>([]);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ added: number; updated: number } | null>(null);

  const load = (name: string, data: unknown[][]) => {
    const clean = data.filter((r) => r.some((c) => String(c ?? "").trim()));
    if (clean.length < 2) return setErr("That file has no rows under the headings.");
    setFile(name); setRows(clean); setMap(clean[0].map((h) => guessField(String(h ?? "")))); setErr(""); setDone(null);
  };

  const onFile = async (f: File) => {
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      load(f.name, XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true }) as unknown[][]);
    } catch { setErr("We couldn't read that file. Save it as .xlsx or .csv and try again."); }
  };

  const parsed = useMemo(() => {
    if (rows.length < 2) return null;
    const out: { row: ImportRow; status: "new" | "update" }[] = [];
    const skipped: { line: number; why: string }[] = [];
    const seen = new Set<string>();
    rows.slice(1).forEach((r, i) => {
      const v: Partial<Record<FieldKey, string>> = {};
      map.forEach((k, ci) => { if (k !== "skip" && r[ci] !== undefined && r[ci] !== null && String(r[ci]).trim()) v[k] = k === "birthday" ? toDate(r[ci]) : String(r[ci]).trim(); });
      let first = v.firstName, last = v.lastName;
      if (!first && v.fullName) { const parts = v.fullName.split(/\s+/); first = parts[0]; last = parts.slice(1).join(" ") || last; }
      const g = (v.gender ?? "").toLowerCase();
      const gender = g.startsWith("f") ? "F" : g.startsWith("m") ? "M" : undefined;
      const phone = v.phone ?? "";
      const key = phone.replace(/\D/g, "").slice(-10);
      if (!first) return skipped.push({ line: i + 2, why: "no name" });
      if (key.length < 10) return skipped.push({ line: i + 2, why: "no phone number" });
      if (!gender) return skipped.push({ line: i + 2, why: "gender missing" });
      if (seen.has(key)) return skipped.push({ line: i + 2, why: "same phone as an earlier row" });
      seen.add(key);
      out.push({
        status: findByPhone(phone) ? "update" : "new",
        row: { firstName: first, lastName: last ?? "", gender, phone, whatsapp: v.whatsapp, email: v.email, birthday: v.birthday, location: v.location, occupation: v.occupation, groupName: v.department },
      });
    });
    return { out, skipped };
  }, [rows, map, findByPhone]);

  if (!access) return null;
  if (!access.can("people.edit")) return <Empty title="Not available" body="Ask the admin to import people." />;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/people" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"><ArrowLeft size={15} /> People</Link>
      <PageHeader title="Import people" sub="Bring in your Excel or CSV member lists. People already in Traqi are matched by phone number and only their missing details are filled in." />

      {done ? (
        <div className="rise rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
          <CheckCircle2 size={48} className="mx-auto text-good" />
          <h2 className="mt-4 font-display text-2xl font-semibold">Import finished</h2>
          <p className="mt-2 text-ink-soft">{done.added} new {done.added === 1 ? "person" : "people"} added and {done.updated} updated.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => { setFile(null); setRows([]); setDone(null); }}>Import another file</Button>
            <Link href="/people" className="inline-flex items-center rounded-xl bg-brand px-4 text-sm font-medium text-white">See everyone</Link>
          </div>
        </div>
      ) : !file ? (
        <>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
            className="flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed border-line bg-surface px-6 py-14 text-center transition hover:border-brand/50"
          >
            <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Upload size={26} /></span>
            <span className="mt-4 font-display text-xl font-semibold">Drop your file here, or tap to choose</span>
            <span className="mt-1 text-sm text-muted">.xlsx, .xls or .csv. The first row should be the headings.</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </label>
          {err && <p className="mt-3 text-sm text-alert" role="alert">{err}</p>}
          <button onClick={() => load("Sample member list.xlsx", SAMPLE)} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand">
            <FileSpreadsheet size={16} /> No file to hand? Try a sample list
          </button>
        </>
      ) : parsed && (
        <div className="space-y-6">
          <Panel title="Match your columns" action={<span className="text-sm text-muted">{file}</span>}>
            <p className="-mt-2 mb-4 text-sm text-ink-soft">We guessed what each column holds. Change any that are wrong. Name, phone and gender are needed.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {rows[0].map((h, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-page px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{String(h)}</span>
                  <span className="text-muted" aria-hidden>→</span>
                  <select className="h-9 w-40 shrink-0 rounded-lg bg-surface px-2 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-brand" value={map[i]} onChange={(e) => setMap(map.map((m, j) => (j === i ? (e.target.value as FieldKey) : m)))} aria-label={`Column ${String(h)}`}>
                    <option value="skip">Don&apos;t import</option>
                    {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </Panel>

          <div className="grid grid-cols-3 gap-3">
            <Stat n={parsed.out.filter((r) => r.status === "new").length} label="new people" tone="good" />
            <Stat n={parsed.out.filter((r) => r.status === "update").length} label="already here, will fill gaps" />
            <Stat n={parsed.skipped.length} label="rows skipped" tone={parsed.skipped.length ? "glow" : undefined} />
          </div>

          <Panel title="Check before importing">
            <ul className="-mx-2 divide-y divide-line text-[14.5px]">
              {parsed.out.slice(0, 8).map(({ row, status }) => (
                <li key={row.phone} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-2.5">
                  <span className="min-w-40 flex-1 font-medium">{row.firstName} {row.lastName}</span>
                  <span className="text-muted">{row.phone}</span>
                  {row.groupName && <span className="text-ink-soft">{state.groups.some((g) => g.name.toLowerCase() === row.groupName!.toLowerCase()) ? row.groupName : `${row.groupName} (no such department, skipped)`}</span>}
                  <span className={cx("rounded-md px-1.5 py-0.5 text-xs font-medium", status === "new" ? "bg-good-soft text-good" : "bg-brand-soft text-brand")}>{status === "new" ? "New" : "Update"}</span>
                </li>
              ))}
            </ul>
            {parsed.out.length > 8 && <p className="mt-2 text-sm text-muted">And {parsed.out.length - 8} more.</p>}
            {parsed.skipped.length > 0 && (
              <div className="mt-4 rounded-xl bg-glow-soft p-3 text-sm text-glow-ink">
                <p className="font-medium">Skipped rows</p>
                <p className="mt-1">{parsed.skipped.map((x) => `row ${x.line} (${x.why})`).join(", ")}. Fix them in your file and import again.</p>
              </div>
            )}
          </Panel>

          <div className="flex justify-end gap-2">
            <Button onClick={() => { setFile(null); setRows([]); }}>Choose another file</Button>
            <Button variant="primary" disabled={!parsed.out.length} onClick={() => setDone(importPeople(parsed.out.map((r) => r.row), file))}>
              Import {parsed.out.length} {parsed.out.length === 1 ? "person" : "people"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: "good" | "glow" }) {
  return (
    <div className={cx("rounded-2xl p-4 ring-1", tone === "good" ? "bg-good-soft ring-good/15" : tone === "glow" ? "bg-glow-soft ring-glow/25" : "bg-surface ring-line")}>
      <p className={cx("num text-3xl font-semibold", tone === "good" && "text-good", tone === "glow" && "text-glow-ink")}>{n}</p>
      <p className="mt-0.5 text-[13px] text-ink-soft">{label}</p>
    </div>
  );
}
