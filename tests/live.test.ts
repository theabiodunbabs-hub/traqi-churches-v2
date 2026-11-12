import { describe, expect, it, vi } from "vitest";
import columns from "./db-columns.json";

// A fake Supabase client that records every write.
const calls: { table: string; op: string; row?: unknown; filters: string[] }[] = [];
vi.mock("@/lib/supabase", () => {
  const from = (table: string) => {
    const rec = { table, op: "", row: undefined as unknown, filters: [] as string[] };
    const chain = {
      update(row: unknown) { rec.op = "update"; rec.row = row; return chain; },
      insert(row: unknown) { rec.op = "insert"; rec.row = row; calls.push(rec); return Promise.resolve({ error: null }); },
      delete() { rec.op = "delete"; return chain; },
      eq(col: string, v: string) { rec.filters.push(`${col}=${v}`); return chain; },
      then(res: (v: { error: null }) => void) { calls.push(rec); res({ error: null }); },
    };
    return chain;
  };
  return { supabase: { from }, LIVE: true, newId: () => crypto.randomUUID() };
});

const { tables, snapshotOf, syncState } = await import("@/lib/live");
const { seed } = await import("@/lib/seed");

describe("app rows match the database", () => {
  it("every saved field is a real column", () => {
    const t = tables(seed, "church-1");
    for (const [table, rows] of Object.entries(t)) {
      const cols = new Set((columns as Record<string, string[]>)[table]);
      expect(cols.size, `table ${table} exists`).toBeGreaterThan(0);
      for (const row of rows.values()) for (const k of Object.keys(row)) expect(cols.has(k), `${table}.${k}`).toBe(true);
    }
  });
});

describe("saving changes", () => {
  it("saves nothing when nothing changed", async () => {
    calls.length = 0;
    await syncState(snapshotOf(seed, "c"), seed, "c");
    expect(calls).toEqual([]);
  });

  it("assigning a first-timer is one update to that case, plus the activity entry", async () => {
    calls.length = 0;
    const c = seed.cases[0];
    const next = { ...seed, cases: seed.cases.map((x) => (x.id === c.id ? { ...x, assigneeId: "p5" } : x)),
      activity: [{ id: "new-a", at: new Date().toISOString(), actorId: "p1", text: "assigned someone" }, ...seed.activity] };
    await syncState(snapshotOf(seed, "c"), next, "c");
    expect(calls.map((x) => `${x.op} ${x.table}`)).toEqual(["update followup_cases", "insert activity_log"]);
    expect(calls[0].filters).toEqual([`id=${c.id}`, "church_id=c"]);
  });

  it("logging a call inserts one contact and never re-sends old ones", async () => {
    calls.length = 0;
    const c = seed.cases.find((x) => x.contacts.length)!;
    const next = { ...seed, cases: seed.cases.map((x) => (x.id === c.id ? { ...x, contacts: [...x.contacts, { at: "2026-11-05T19:00:00.000Z", byId: "p11", method: "call" as const, outcome: "Spoke with them", reached: true }] } : x)) };
    await syncState(snapshotOf(seed, "c"), next, "c");
    expect(calls.map((x) => `${x.op} ${x.table}`)).toEqual(["insert followup_contacts"]);
    expect((calls[0].row as unknown[]).length).toBe(1);
  });

  it("removing a role deletes just that assignment", async () => {
    calls.length = 0;
    const a = seed.assignments.at(-1)!;
    await syncState(snapshotOf(seed, "c"), { ...seed, assignments: seed.assignments.slice(0, -1) }, "c");
    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe("delete");
    expect(calls[0].filters).toEqual([`person_id=${a.personId}`, `role_id=${a.roleId}`]);
  });
});
