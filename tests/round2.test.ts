import { describe, expect, it } from "vitest";
import { seed, P, type SeedState } from "@/lib/seed";
import { accessFor, roleActive } from "@/lib/access";
import { autoPick, followSettings, teamFull, teamLoad } from "@/lib/metrics";
import { defaultJourney, setJourney } from "@/lib/journey";
import { onClassDone, onEnrolled, onPlaced, onReturned, confirmStage, nextStepFor } from "@/lib/journey-engine";
import type { Person } from "@/lib/types";

setJourney(defaultJourney("class_first"));
const clone = (): SeedState => JSON.parse(JSON.stringify(seed));
const visitor = (over: Partial<Person> = {}): Person => ({ id: "p-new", firstName: "Ada", lastName: "Obi", gender: "F", phone: "0800", stage: "first_timer", missedInARow: 0, firstVisit: "2026-11-01", ...over } as Person);

describe("roles that wait or end", () => {
  it("a role waiting for the pastor's approval gives nothing yet", () => {
    const s = clone();
    const media = s.roles.find((r) => r.key === "media")!;
    s.assignments.push({ personId: P.member.id, roleId: media.id, scope: { type: "church" }, pending: { byId: P.admin.id, at: "x", action: "give" } });
    expect(accessFor(s, P.member.id).roleNames).not.toContain(media.name);
  });
  it("a temporary role stops on its end date", () => {
    const a = { personId: "x", roleId: "y", scope: { type: "church" as const }, until: "2020-01-01" };
    expect(roleActive(a)).toBe(false);
    expect(roleActive({ ...a, until: "2999-01-01" })).toBe(true);
  });
  it("a removal waiting for approval keeps the role until the pastor agrees", () => {
    expect(roleActive({ personId: "x", roleId: "y", scope: { type: "church" }, pending: { byId: "z", at: "x", action: "remove" } })).toBe(true);
  });
});

describe("assistants", () => {
  it("get the abilities their head chose, inside the department only", () => {
    const s = clone();
    const g = s.groups.find((x) => x.id === "g-outreach")!;
    const helper = g.memberIds.find((id) => !g.leaderIds.includes(id))!;
    expect(accessFor(s, helper).can("followup.assign")).toBe(false);
    g.assistants = [{ personId: helper, title: "Follow-up assistant: Assignments", perms: ["followup.assign"] }];
    const a = accessFor(s, helper);
    expect(a.can("followup.assign")).toBe(true);
    expect(a.roleNames).toContain("Follow-up assistant: Assignments");
    expect(a.isMemberOnly).toBe(false);
  });
});

describe("auto-assign", () => {
  it("skips people who are away or full, and alerts when everyone is", () => {
    const s = clone();
    const team = teamLoad(s);
    const first = autoPick(s, visitor())!;
    expect(first).toBeTruthy();
    s.people = s.people.map((p) => (p.id === first.id ? { ...p, unavailable: true } : p));
    expect(autoPick(s, visitor())?.id).not.toBe(first.id);
    const g = s.groups.find((x) => x.tags?.includes("followup"))!;
    g.followup = { auto: true, limit: 0, sameGender: false };
    expect(autoPick(s, visitor())).toBeUndefined();
    expect(teamFull(s)).toBe(true);
    expect(team.length).toBeGreaterThan(0);
  });
  it("can match the same gender, and can be switched off", () => {
    const s = clone();
    const g = s.groups.find((x) => x.tags?.includes("followup"))!;
    g.followup = { auto: true, limit: 50, sameGender: true };
    expect(autoPick(s, visitor({ gender: "F" }))?.gender).toBe("F");
    g.followup = { auto: false, limit: 5, sameGender: false };
    expect(followSettings(s).auto).toBe(false);
    expect(autoPick(s, visitor())).toBeUndefined();
  });
});

describe("journey", () => {
  it("moves people forward when they come back, start and finish the class", () => {
    let s = clone();
    s.people.push(visitor());
    s = onReturned(s, "p-new").state;
    expect(s.people.find((p) => p.id === "p-new")!.stage).toBe("returning");
    s = onEnrolled(s, "p-new", "pr-foundation").state;
    expect(s.people.find((p) => p.id === "p-new")!.stage).toBe("discipleship");
    s = onClassDone(s, "p-new", "pr-foundation").state;
    expect(s.people.find((p) => p.id === "p-new")!.stage).toBe("member");
  });
  it("waits for a leader where the stage asks for it", () => {
    let s = clone();
    s.people.push(visitor({ stage: "member" }));
    const r = onClassDone(s, "p-new", "pr-workers");
    expect(r.awaiting).toBe("worker");
    s = confirmStage(r.state, "p-new").state;
    expect(s.people.find((p) => p.id === "p-new")!.stage).toBe("worker");
  });
  it("puts people on probation only when the church uses it", () => {
    let s = clone();
    s.people.push(visitor({ stage: "member" }));
    const g = s.groups.find((x) => x.kind === "department")!.id;
    expect(onPlaced(s, "p-new", g).probation).toBeFalsy();
    s.church.profile = { ...s.church.profile!, journey: { ...defaultJourney(), probation: { enabled: true, months: 3, holdBack: [] } } };
    const r = onPlaced(s, "p-new", g);
    expect(r.probation).toBe(true);
    expect(r.state.people.find((p) => p.id === "p-new")!.probation?.reason).toBe("no_class");
  });
  it("tells each person their next step", () => {
    const s = clone();
    expect(nextStepFor(s, visitor({ stage: "returning" }))?.title).toMatch(/Foundation/);
  });
});

import { understand, ask, missedLastSunday } from "@/lib/ask";
import { assertSafe, toCSV } from "@/lib/download";
import { fullChurch, peopleSheet } from "@/lib/exports";

describe("Ask Traqi", () => {
  const a = accessFor(seed, P.lead.id);
  it("understands everyday wording and spelling slips", () => {
    expect(understand("who misssed sunday", a)?.key).toBe("missed");
    expect(understand("how many frist timers this month", a)?.key).toBe("firsttimers");
    expect(understand("birthdys", a)?.key).toBe("birthdays");
    expect(understand("offerng this month", a)?.key).toBe("giving");
    expect(understand("banana", a)).toBeNull();
  });
  it("keeps giving away from people who can't see finance", () => {
    expect(understand("giving this month", accessFor(seed, P.member.id))?.key).not.toBe("giving");
  });
  it("answers with numbers and people", () => {
    const r = ask(seed, a, "who missed last sunday");
    expect(r.people?.length).toBe(missedLastSunday(seed, a.visiblePeople()).length > 30 ? 30 : missedLastSunday(seed, a.visiblePeople()).length);
  });
});

describe("downloads", () => {
  const a = accessFor(seed, P.lead.id);
  it("never include care, welfare or prayer", () => {
    expect(() => assertSafe(fullChurch(seed, a))).not.toThrow();
    expect(() => assertSafe([{ name: "Welfare", columns: [], rows: [] }])).toThrow();
    expect(() => assertSafe([{ name: "People", columns: [{ key: "x", label: "Care notes", value: () => "" }], rows: [] }])).toThrow();
  });
  it("hide phone numbers the downloader can't see", () => {
    const w = accessFor(seed, P.worker.id);
    const sheet = peopleSheet(seed, w, [seed.people.find((p) => p.id === P.member.id)!]);
    expect(toCSV(sheet)).toContain("Hidden");
  });
  it("stop spreadsheet formulas sneaking in", () => {
    expect(toCSV({ name: "x", columns: [{ key: "n", label: "N", value: (r: { n: string }) => r.n }], rows: [{ n: "=HYPERLINK(1)" }] })).toContain("'=HYPERLINK");
  });
});

import { daysOf, duplicateEvent, happeningNow, lagosISO, suggestQuestions, withDayPlan, cleanOptions, slugify } from "@/lib/events";

describe("events", () => {
  const rise = seed.events.find((e) => e.id === "ev-youth")!;
  it("keeps start, end and dates in step with the day plan", () => {
    const e = withDayPlan(rise, [{ date: "2027-03-02", start: "17:00", end: "21:00" }, { date: "2027-03-01", start: "10:00", end: "12:00" }]);
    expect(e.days).toEqual(["2027-03-01", "2027-03-02"]);
    expect(e.start).toBe(lagosISO("2027-03-01", "10:00"));
    expect(e.end).toBe(lagosISO("2027-03-02", "21:00"));
  });
  it("knows what's happening now", () => {
    const d = daysOf(rise)[1];
    const t = Date.parse(lagosISO(d.date, "11:15"));
    expect(happeningNow(rise, t)?.session?.title).toBe("Finding your purpose");
    expect(happeningNow(rise, Date.parse(lagosISO(d.date, "23:00")))).toBeNull();
  });
  it("suggests questions that fit the event", () => {
    const labels = suggestQuestions({ ...rise, questions: [] }).map((q) => q.label);
    expect(labels).toContain("Will you need accommodation?");
    const couples = seed.events.find((e) => e.id === "ev-couples")!;
    expect(suggestQuestions({ ...couples, questions: [] }).map((q) => q.label)).toContain("Spouse's name");
  });
  it("lets choices contain commas", () => {
    expect(cleanOptions(["Yes, I will", " No ", "", "Yes, I will"])).toEqual(["Yes, I will", "No"]);
  });
  it("duplicates for next year with fresh dates", () => {
    const c = duplicateEvent(rise, "new", P.media.id);
    expect(c.status).toBe("draft");
    expect(c.slug).toBe("rise-2027");
    expect(c.title).toContain("2027");
    expect(c.days[0] > rise.days[0]).toBe(true);
  });
  it("makes clean links", () => {
    expect(slugify("Rise: Youth Conference 2026!")).toBe("rise-youth-conference-2026");
  });
});

import { branchStats } from "@/lib/branches";

describe("branches", () => {
  it("splits people and first-timers by branch for the league table", () => {
    const s = clone();
    s.church.profile = { ...s.church.profile!, branches: [{ id: "b1", name: "Lekki", slug: "lekki" }] };
    const moved = s.people.filter((p) => !p.isChild && !p.inactive).slice(0, 10).map((p) => p.id);
    s.people = s.people.map((p) => (moved.includes(p.id) ? { ...p, branchId: "b1" } : p));
    const rows = branchStats(s);
    expect(rows.map((r) => r.name)).toEqual(["Headquarters", "Lekki"]);
    expect(rows[1].people).toBe(10);
    expect(rows[0].people + rows[1].people).toBe(s.people.filter((p) => !p.isChild && !p.inactive).length);
  });
  it("lets a branch pastor see only their branch's people", () => {
    const s = clone();
    s.church.profile = { ...s.church.profile!, branches: [{ id: "b1", name: "Lekki", slug: "lekki" }] };
    const someone = s.people.find((p) => !p.isChild && p.id !== P.worker.id)!;
    s.people = s.people.map((p) => (p.id === someone.id ? { ...p, branchId: "b1" } : p));
    const pastor = s.roles.find((r) => r.key === "pastor")!;
    s.assignments = s.assignments.filter((a) => a.personId !== P.worker.id);
    s.assignments.push({ personId: P.worker.id, roleId: pastor.id, scope: { type: "branch", branchId: "b1" } });
    const a = accessFor(s, P.worker.id);
    const seen = a.visiblePeople().map((p) => p.id);
    expect(seen).toContain(someone.id);
    expect(a.can("people.view", { personId: someone.id })).toBe(true);
    expect(a.can("people.view", { personId: P.member.id })).toBe(false);
  });
});

import { dailyEmail, lagosNow, mondayEmail, monthlyEmail, quietHours, eventReminderEmail } from "@/lib/email/templates";
import { summaryFromState } from "@/lib/email/from-state";

describe("emails", () => {
  const s = summaryFromState(seed);
  it("build every email with a subject, html and plain text", () => {
    for (const m of [dailyEmail(s, "https://x", "Femi"), mondayEmail(s, "https://x", "Femi"), monthlyEmail(s, "https://x", "Femi")]) {
      expect(m.subject).toContain(seed.church.name);
      expect(m.html).toContain("<html");
      expect(m.text.length).toBeGreaterThan(40);
      for (const p of seed.prayers) expect(m.html).not.toContain(p.body.slice(0, 20));
    }
    const e = seed.events.find((x) => x.id === "ev-youth")!;
    expect(eventReminderEmail(s.church, "https://x", e, "Ada Obi", "RISE-AAAAAA").html).toContain("RISE-AAAAAA");
  });
  it("escape names so they can't inject anything", () => {
    expect(dailyEmail({ ...s, birthdays: ["<script>x</script>"] }, "https://x", "A").html).not.toContain("<script>x");
  });
  it("respect quiet hours and know the last day of the month in Lagos", () => {
    expect(quietHours(22)).toBe(true); expect(quietHours(5)).toBe(true); expect(quietHours(7)).toBe(false); expect(quietHours(20)).toBe(false);
    expect(lagosNow(new Date("2026-11-30T19:00:00Z"))).toMatchObject({ hour: 20, isLastDayOfMonth: true });
    expect(lagosNow(new Date("2026-11-29T23:30:00Z"))).toMatchObject({ hour: 0, isLastDayOfMonth: true });
    expect(lagosNow(new Date("2026-11-16T06:00:00Z")).weekday).toBe("Mon");
  });
});
