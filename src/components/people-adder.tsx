"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { fullName } from "@/lib/format";
import { Avatar, Button, Field, Sheet, inputCls } from "./ui";

/** One-tap team adds: all leaders, all department heads, a whole department, all workers, or one person. */
export function PeopleAdder({ open, onClose, title, exclude = [], onAdd }: { open: boolean; onClose: () => void; title: string; exclude?: string[]; onAdd: (ids: string[], what: string) => void }) {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const depts = state.groups.filter((g) => g.kind === "department");
  const heads = [...new Set(depts.flatMap((g) => g.leaderIds))];
  const leaders = [...new Set([...state.groups.flatMap((g) => g.leaderIds), ...state.people.filter((p) => p.stage === "leader").map((p) => p.id)])];
  const workers = state.people.filter((p) => p.stage === "worker" && !p.inactive).map((p) => p.id);
  const found = q.trim() ? state.people.filter((p) => !p.isChild && !exclude.includes(p.id) && fullName(p).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Button onClick={() => onAdd(heads, "all department heads")}>All heads</Button>
        <Button onClick={() => onAdd(leaders, "all leaders")}>All leaders</Button>
        <Button onClick={() => onAdd(workers, "all workers")}>All workers</Button>
      </div>
      <p className="mb-2 text-sm font-medium">A whole department</p>
      <div className="mb-4 flex flex-wrap gap-1.5">{depts.map((g) => (
        <button type="button" key={g.id} onClick={() => onAdd([...g.leaderIds, ...g.memberIds, ...state.groups.filter((u) => u.parentId === g.id).flatMap((u) => u.memberIds)], g.name)} className="min-h-10 rounded-full bg-surface px-3.5 text-[13.5px] ring-1 ring-line hover:ring-brand/40">{g.name}</button>
      ))}</div>
      <Field label="Or one person"><input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" /></Field>
      <ul className="mt-2 divide-y divide-line">{found.map((p) => <li key={p.id} className="flex items-center gap-3 py-2"><Avatar person={p} size={30} /><span className="flex-1">{fullName(p)}</span><Button className="py-1.5 text-[13px]" onClick={() => { onAdd([p.id], fullName(p)); setQ(""); }}>Add</Button></li>)}</ul>
    </Sheet>
  );
}
