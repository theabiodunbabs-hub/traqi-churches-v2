"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { assertSafe, fileStamp, saveBlob, slugFile, toCSV, toXLSX, type SheetSpec } from "@/lib/download";
import { fullName } from "@/lib/format";
import { Button, cx, toast } from "./ui";

/** Download a list as Excel or CSV. Every download is logged. */
export function DownloadButton({ what, sheets, label = "Download", small, className }: { what: string; sheets: () => SheetSpec[]; label?: string; small?: boolean; className?: string }) {
  const { state, me, put, newId } = useStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const go = async (format: "xlsx" | "csv") => {
    setOpen(false);
    if (!me) return;
    setBusy(true);
    try {
      const list = sheets();
      assertSafe(list);
      const rows = list.reduce((n, s) => n + s.rows.length, 0);
      const base = `${slugFile(state.church.name)}-${slugFile(what)}-${fileStamp()}`;
      if (format === "csv") {
        saveBlob(new Blob(["﻿" + toCSV(list[0])], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
      } else {
        saveBlob(await toXLSX(list, { church: state.church.name, by: fullName(me) }), `${base}.xlsx`);
      }
      put("downloads", { id: newId("dl"), byId: me.id, what: `${what} (${format === "csv" ? "CSV" : "Excel"})`, rows, at: new Date().toISOString() }, `downloaded ${what} as ${format === "csv" ? "CSV" : "Excel"}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "The download didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const single = (() => { try { return sheets().length === 1; } catch { return false; } })();
  return (
    <div ref={ref} className={cx("relative", className)}>
      <Button onClick={() => (single ? setOpen(!open) : go("xlsx"))} disabled={busy} aria-haspopup={single ? "menu" : undefined} aria-expanded={open} className={small ? "h-9 px-3 text-[13px]" : undefined}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {label}
      </Button>
      {open && (
        <div role="menu" className="pop absolute right-0 z-30 mt-1.5 w-52 overflow-hidden rounded-2xl bg-surface p-1.5 shadow-xl ring-1 ring-line">
          <button role="menuitem" onClick={() => go("xlsx")} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-page"><FileSpreadsheet size={16} className="text-good" /> Excel (.xlsx)</button>
          <button role="menuitem" onClick={() => go("csv")} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-page"><FileText size={16} className="text-brand" /> CSV</button>
        </div>
      )}
    </div>
  );
}
