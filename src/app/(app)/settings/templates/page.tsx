"use client";

import { useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Badge, Button, PageHeader, Panel, cx, inputCls, toast } from "@/components/ui";
import { TEMPLATE_LABEL } from "@/lib/templates";
import { fill } from "@/lib/format";
import type { MessageTemplate, TemplateCategory } from "@/lib/types";

const BLANKS = [["first_name", "Their first name"], ["church_name", "Church name"], ["my_name", "Your name"], ["service_time", "Sunday service time"], ["event_name", "Event name"], ["event_link", "Event link"]] as const;

/** Ready-made WhatsApp messages, in a few versions each. Used whenever someone taps WhatsApp. */
export default function Templates() {
  const { state, access, me, put, drop, newId } = useStore();
  const [cat, setCat] = useState<TemplateCategory>("welcome");
  const [editing, setEditing] = useState<string | null>(null);
  if (!access || !me) return null;
  const manage = access.can("messages.bulk") || access.can("roles.manage") || access.isPastoral;
  const list = state.templates.filter((t) => t.category === cat && (!t.ownerId || t.ownerId === me.id))
    .sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault) || Number(!!a.ownerId) - Number(!!b.ownerId));
  const sample = { first_name: "Adaeze", church_name: state.church.name, my_name: me.firstName, service_time: "7:30 AM", event_name: "Youth Conference", event_link: "traqi.space/e/…" };
  const cats = Object.keys(TEMPLATE_LABEL) as TemplateCategory[];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Message templates" sub="Ready-made messages for WhatsApp. Choose one, tweak it, send. Church versions are shared; yours are just for you." />
      <div className="grid gap-5 md:grid-cols-[230px_1fr]">
        <nav className="card h-fit p-2">
          {cats.map((c) => {
            const n = state.templates.filter((t) => t.category === c && (!t.ownerId || t.ownerId === me.id)).length;
            return (
              <button key={c} onClick={() => { setCat(c); setEditing(null); }} className={cx("flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[14px]", cat === c ? "bg-brand-soft font-semibold text-brand" : "text-ink-soft hover:bg-page")}>
                {TEMPLATE_LABEL[c]}<span className="text-[12px] text-muted">{n}</span>
              </button>
            );
          })}
        </nav>
        <div className="space-y-3">
          {list.map((t) => <TemplateCard key={t.id} t={t} />)}
          <div className="flex flex-wrap gap-2">
            {manage && <Button onClick={() => { const id = newId("tp"); put("templates", { id, category: cat, name: `Version ${list.filter((x) => !x.ownerId).length + 1}`, body: "Hello {first_name}, " }, "added a message template"); setEditing(id); }}><Plus size={15} /> Add a church version</Button>}
            <Button variant="ghost" onClick={() => { const id = newId("tp"); put("templates", { id, category: cat, name: "My version", body: "Hello {first_name}, ", ownerId: me.id }); setEditing(id); }}><Star size={15} /> Add my own version</Button>
          </div>
        </div>
      </div>
    </div>
  );

  function TemplateCard({ t }: { t: MessageTemplate }) {
    const editable = t.ownerId === me!.id || manage;
    const [body, setBody] = useState(t.body);
    const [name, setName] = useState(t.name);
    const open = editing === t.id;
    return (
      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          {open ? <input className={cx(inputCls, "w-48 py-1.5")} value={name} onChange={(e) => setName(e.target.value)} /> : <p className="font-display text-[17px] font-semibold">{t.name}</p>}
          {t.isDefault && <Badge tone="brand">Default</Badge>}
          {t.ownerId && <Badge tone="glow"><Star size={11} /> Yours</Badge>}
          <span className="ml-auto flex gap-1">
            {!open && editable && <Button variant="ghost" onClick={() => setEditing(t.id)}>Edit</Button>}
            {!open && manage && !t.isDefault && !t.ownerId && <Button variant="ghost" onClick={() => { list.forEach((x) => x.isDefault && put("templates", { ...x, isDefault: false })); put("templates", { ...t, isDefault: true }, "changed a default template"); toast("Default changed"); }}>Make default</Button>}
            {editable && !t.isDefault && <Button variant="ghost" className="text-alert" onClick={() => { drop("templates", t.id); toast("Template removed"); }} aria-label="Delete"><Trash2 size={15} /></Button>}
          </span>
        </div>
        {open ? (
          <div className="mt-3 space-y-3">
            <textarea className={cx(inputCls, "min-h-32")} value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="flex flex-wrap gap-1.5">{BLANKS.map(([k, l]) => <button key={k} onClick={() => setBody(`${body}{${k}}`)} className="rounded-full bg-page px-2.5 py-1 text-[12px] ring-1 ring-line hover:ring-brand">+ {l}</button>)}</div>
            <div className="flex gap-2"><Button variant="primary" onClick={() => { put("templates", { ...t, body, name: name.trim() || t.name }, t.ownerId ? undefined : "edited a message template"); setEditing(null); toast("Saved"); }}>Save</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
          </div>
        ) : null}
        <div className="mt-3 rounded-2xl rounded-tl-md bg-[#e7fbe9] px-4 py-3 text-[14.5px] leading-relaxed">{fill(open ? body : t.body, sample)}</div>
      </Panel>
    );
  }
}
