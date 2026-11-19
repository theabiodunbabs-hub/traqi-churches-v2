/**
 * Fund requests and retirement / spending reports.
 * The church picks one of three routes:
 *  1. Leader → pastor (the admin is copied)
 *  2. Leader → finance → pastorate
 *  3. Like 2, but finance can approve and pay up to a limit the pastorate sets
 * Anyone along the way can send a request back with a note.
 */
import type { SeedState } from "./seed";
import type { Access } from "./access";
import type { FinanceSetup, FundLine, FundRequest, FundStage, Person } from "./types";
import type { SheetSpec } from "./download";
import { financeByMonth } from "./domain";
import { fullName } from "./format";

export const DEFAULT_CATEGORIES = ["Equipment", "Outreach", "Welfare", "Maintenance", "Hospitality", "Events", "Utilities", "Transport", "Other"];
export const ROUTES: { n: 1 | 2 | 3; title: string; body: string }[] = [
  { n: 1, title: "Straight to the pastor", body: "Leaders send requests to the pastor. The admin is copied. Finance pays once approved." },
  { n: 2, title: "Finance first, then the pastorate", body: "Finance checks the figures and sends it on. The pastorate approves. Either can send it back." },
  { n: 3, title: "Finance approves small amounts", body: "Like the second, but finance can approve and pay anything up to a limit you set." },
];

export const setupOf = (s: SeedState): FinanceSetup => s.church.profile?.finance ?? { route: 2 };
export const linesTotal = (lines: FundLine[]) => lines.reduce((t, l) => t + (Number(l.qty) || 0) * (Number(l.unit) || 0), 0);
export const totalOf = (s: SeedState, f: FundRequest): number =>
  f.childIds?.length ? s.funds.filter((x) => f.childIds!.includes(x.id)).reduce((t, x) => t + linesTotal(x.lines), 0) + linesTotal(f.lines) : linesTotal(f.lines);
export const paidOf = (f: FundRequest) => f.payments.reduce((t, p) => t + p.amount, 0);
export const spentOf = (f: FundRequest) => (f.report ? linesTotal(f.report.lines) : 0);

export const isFinance = (a: Access) => a.can("finance.review");
export const isFinanceLead = (a: Access) => a.can("finance.review") && a.can("finance.approve");
/** Is this person one of the reviewers the finance lead or pastor picked? An empty list means everyone with the right. */
export const reviews = (s: SeedState, a: Access) => isFinance(a) && (!(setupOf(s).reviewerIds?.length) || setupOf(s).reviewerIds!.includes(a.personId) || isFinanceLead(a));
export const pays = (a: Access) => isFinance(a) || a.isLead;
export const seesBalance = (s: SeedState, a: Access) => a.isLead || a.isPastoral || isFinanceLead(a) || (isFinance(a) && !setupOf(s).hideBalance);

/** Where a request goes when it's sent (or sent again after being returned). */
export const firstStage = (s: SeedState): FundStage => (setupOf(s).route === 1 ? "pastor" : "finance");

/** Who can see a request. */
export function seesFund(s: SeedState, a: Access, f: FundRequest) {
  if (f.byId === a.personId || a.isPastoral || a.isAdmin || isFinance(a)) return true;
  if (f.groupId && a.leads.has(f.groupId)) return true;
  const ev = f.eventId ? s.events.find((e) => e.id === f.eventId) : undefined;
  return !!ev?.committee && (ev.committee.headId === a.personId || ev.committee.assistantId === a.personId);
}

export type FundAction = "forward" | "approve" | "return" | "decline" | "pay" | "acceptReport" | "returnReport";
/** What this person can do to a request right now. */
export function actionsFor(s: SeedState, a: Access, f: FundRequest): FundAction[] {
  const set = setupOf(s); const out: FundAction[] = [];
  const total = totalOf(s, f);
  if (f.parentId) return out;
  if (f.stage === "finance" && reviews(s, a)) {
    out.push("forward");
    if (set.route === 3 && total <= (set.limit ?? 0)) out.push("approve");
    if (f.refund && set.route === 3 && total <= (set.limit ?? 0)) out.push("pay");
    out.push("return");
  }
  if (f.stage === "pastor" && a.isPastoral) out.push("approve", "return", "decline");
  if ((f.stage === "approved" || (f.stage === "paid" && paidOf(f) < total)) && pays(a)) out.push("pay");
  if (f.stage === "paid" && f.report && !f.report.reviewedAt && isFinance(a)) out.push("acceptReport", "returnReport");
  return out;
}

export const STAGE_LABEL: Record<FundStage, string> = {
  committee: "With the committee", finance: "With finance", pastor: "With the pastor", approved: "Approved, to be paid",
  returned: "Sent back", declined: "Declined", paid: "Paid", closed: "Closed",
};
export function stageLabel(s: SeedState, f: FundRequest) {
  if (f.stage === "paid") return paidOf(f) < totalOf(s, f) ? "Part paid" : f.report ? (f.report.reviewedAt ? "Closed" : "Report sent") : "Paid, report due";
  return STAGE_LABEL[f.stage];
}
export const stageTone = (f: FundRequest): "good" | "glow" | "brand" | "neutral" | "alert" =>
  f.stage === "closed" ? "neutral" : f.stage === "returned" || f.stage === "declined" ? "alert" : f.stage === "approved" || f.stage === "paid" ? "good" : f.stage === "pastor" ? "glow" : "brand";

/** Money in (all counted offerings and other income) less money paid out on requests. */
export function balance(s: SeedState) {
  const income = financeByMonth(s).reduce((t, m) => t + m.cash + m.transfer, 0);
  const out = s.funds.reduce((t, f) => t + paidOf(f), 0);
  const back = s.funds.reduce((t, f) => t + (f.report?.reviewedAt ? f.report.returned ?? 0 : 0), 0);
  return { income, out, back, left: income - out + back };
}

/** Department budgets: how much of each has gone out this year or quarter. */
export function budgetUse(s: SeedState) {
  const now = new Date(); const q = Math.floor(now.getMonth() / 3);
  return (setupOf(s).budgets ?? []).map((b) => {
    const from = b.period === "year" ? new Date(now.getFullYear(), 0, 1) : new Date(now.getFullYear(), q * 3, 1);
    const used = s.funds.filter((f) => f.groupId === b.groupId && new Date(f.at) >= from && f.stage !== "declined" && f.stage !== "returned").reduce((t, f) => t + (paidOf(f) || (f.stage === "approved" ? totalOf(s, f) : 0)), 0);
    return { ...b, used, name: s.groups.find((g) => g.id === b.groupId)?.name ?? "Department" };
  });
}

export function insights(s: SeedState) {
  const year = String(new Date().getFullYear());
  const yr = s.funds.filter((f) => f.at.startsWith(year) && !f.parentId);
  const byCat = new Map<string, number>(); const byDept = new Map<string, number>();
  yr.forEach((f) => { const p = paidOf(f); if (!p) return; byCat.set(f.category, (byCat.get(f.category) ?? 0) + p); const g = s.groups.find((x) => x.id === f.groupId)?.name ?? "Other"; byDept.set(g, (byDept.get(g) ?? 0) + p); });
  const sort = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]);
  const waiting = s.funds.filter((f) => ["finance", "pastor", "approved", "committee"].includes(f.stage) && !f.parentId);
  const reportsDue = s.funds.filter((f) => f.stage === "paid" && !f.report && !f.refund);
  return { asked: yr.reduce((t, f) => t + totalOf(s, f), 0), paid: yr.reduce((t, f) => t + paidOf(f), 0), byCat: sort(byCat), byDept: sort(byDept), waiting, reportsDue };
}

const nm = (s: SeedState, id?: string) => { const p = s.people.find((x) => x.id === id) as Person | undefined; return p ? fullName(p) : ""; };
export function fundsSheet(s: SeedState): SheetSpec<FundRequest> {
  return {
    name: "Fund requests", rows: s.funds.filter((f) => !f.parentId),
    columns: [
      { key: "date", label: "Date", value: (f) => f.at.slice(0, 10), width: 12 },
      { key: "title", label: "Request", value: (f) => f.title, width: 30 },
      { key: "by", label: "By", value: (f) => nm(s, f.byId), width: 22 },
      { key: "dept", label: "Department", value: (f) => s.groups.find((g) => g.id === f.groupId)?.name ?? "", width: 20 },
      { key: "cat", label: "Category", value: (f) => f.category, width: 14 },
      { key: "asked", label: "Asked", value: (f) => totalOf(s, f), width: 14 },
      { key: "paid", label: "Paid", value: (f) => paidOf(f), width: 14 },
      { key: "spent", label: "Spent (report)", value: (f) => spentOf(f), width: 14 },
      { key: "back", label: "Returned", value: (f) => f.report?.returned ?? 0, width: 12 },
      { key: "stage", label: "Status", value: (f) => stageLabel(s, f), width: 18 },
    ],
  };
}
export function fundLinesSheet(s: SeedState): SheetSpec<FundLine & { req: FundRequest; kind: string }> {
  const rows = s.funds.flatMap((f) => [...f.lines.map((l) => ({ ...l, req: f, kind: "Budget" })), ...(f.report?.lines ?? []).map((l) => ({ ...l, req: f, kind: "Spent" }))]);
  return {
    name: "Line items", rows,
    columns: [
      { key: "req", label: "Request", value: (r) => r.req.title, width: 30 },
      { key: "kind", label: "Budget or spent", value: (r) => r.kind, width: 14 },
      { key: "dept", label: "Department", value: (r) => s.groups.find((g) => g.id === (r.groupId ?? r.req.groupId))?.name ?? "", width: 20 },
      { key: "item", label: "Item", value: (r) => r.item, width: 34 },
      { key: "qty", label: "Qty", value: (r) => r.qty, width: 8 },
      { key: "unit", label: "Unit cost", value: (r) => r.unit, width: 12 },
      { key: "amt", label: "Amount", value: (r) => r.qty * r.unit, width: 14 },
      { key: "receipt", label: "Receipt", value: (r) => (r.receipt ? "Yes" : ""), width: 9 },
    ],
  };
}
