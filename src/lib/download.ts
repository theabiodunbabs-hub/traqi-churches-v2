/**
 * Excel and CSV downloads. Replaces the Google Sheets link.
 * Care notes, welfare and prayer requests are never part of a download.
 */

export type Column<T> = { key: string; label: string; value: (row: T) => string | number | boolean | null | undefined; width?: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SheetSpec<T = any> = { name: string; columns: Column<T>[]; rows: T[] };

/** Field names that must never leave Traqi in a file. */
const NEVER = /care|welfare|prayer|counsel|confidential/i;

export function assertSafe(sheets: SheetSpec[]) {
  for (const s of sheets) {
    if (NEVER.test(s.name)) throw new Error(`"${s.name}" can't be downloaded`);
    for (const c of s.columns) if (NEVER.test(c.key) || NEVER.test(c.label)) throw new Error(`"${c.label}" can't be downloaded`);
  }
}

const cell = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "Yes" : "No") : v);

export function toCSV<T>(s: SheetSpec<T>) {
  const esc = (v: unknown) => {
    const t = String(cell(v));
    // Guard against spreadsheet formulas in user-entered text
    const safe = /^[=+\-@]/.test(t) ? `'${t}` : t;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [s.columns.map((c) => esc(c.label)).join(","), ...s.rows.map((r) => s.columns.map((c) => esc(c.value(r))).join(","))].join("\r\n");
}

/** Builds an .xlsx workbook: one sheet per list, bold headers, frozen top row, filters on. */
export async function toXLSX(sheets: SheetSpec[], meta: { church: string; by: string }) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = `Traqi · ${meta.by}`;
  wb.title = meta.church;
  wb.created = new Date();
  const used = new Set<string>();
  for (const s of sheets) {
    let name = s.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet";
    while (used.has(name)) name = `${name.slice(0, 28)} ${used.size}`;
    used.add(name);
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = s.columns.map((c) => ({ header: c.label, key: c.key, width: c.width ?? Math.min(40, Math.max(12, c.label.length + 4)) }));
    s.rows.forEach((r) => ws.addRow(Object.fromEntries(s.columns.map((c) => {
      const v = cell(c.value(r));
      return [c.key, typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v];
    }))));
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F1D2B" } };
    head.height = 22;
    if (s.columns.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.columns.length } };
  }
  return new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const fileStamp = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
export const slugFile = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
