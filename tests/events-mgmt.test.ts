import { describe, expect, it } from "vitest";
import { seed, P, type SeedState } from "@/lib/seed";
import { accessFor } from "@/lib/access";
import { actionsFor, stageLabel } from "@/lib/funds";
import { notificationsFor } from "@/lib/domain";
import { briefing, checksIn, committeeRights, findRegs, lookupKind, managesTeams, myEventDuties, nextTicket, teamOf, ticketPrefix } from "@/lib/event-mgmt";
import { storeDesk } from "@/lib/checkin";
import type { FundRequest, Registration } from "@/lib/types";

const clone = (): SeedState => JSON.parse(JSON.stringify(seed));
const youth = (s: SeedState) => s.events.find((e) => e.id === "ev-youth")!;
const a = (s: SeedState, id: string) => accessFor(s, id);
const noteKeys = (s: SeedState, id: string) => notificationsFor(s, a(s, id), s.people.find((p) => p.id === id)!).map((n) => n.key);

describe("ticket IDs", () => {
  it("are short, tied to the event and numbered: Charisma Conference 2026 gives CH26-00001", () => {
    const e = { ...youth(clone()), title: "Charisma Conference 2026", start: "2026-12-01T09:00:00Z", ticketPrefix: undefined };
    expect(ticketPrefix(e)).toBe("CH26");
    expect(nextTicket(e, [])).toBe("CH26-00001");
  });
  it("carry on from the highest number, and the committee can choose the start", () => {
    const s = clone(); const e = youth(s);
    expect(ticketPrefix(e)).toBe("RI26");
    expect(nextTicket(e, s.registrations)).toBe("RI26-00067");
    expect(nextTicket(e, s.registrations, 2)).toBe("RI26-00069");
  });
});

describe("finding someone at the door", () => {
  it("tells ticket IDs, phone numbers, emails and names apart", () => {
    expect(lookupKind("ri26-00012").by).toBe("ticket");
    expect(lookupKind("0803 555 0142").by).toBe("phone");
    expect(lookupKind("Ada@Example.com")).toEqual({ by: "email", q: "ada@example.com" });
    expect(lookupKind("Kelechi").by).toBe("name");
  });
  it("finds a registration by each of them", () => {
    const s = clone(); const regs = s.registrations.filter((r) => r.eventId === "ev-youth");
    const r = regs.find((x) => x.email)!;
    expect(findRegs(regs, r.ticket.toLowerCase())[0].id).toBe(r.id);
    expect(findRegs(regs, r.phone)[0].id).toBe(r.id);
    expect(findRegs(regs, r.email!.toUpperCase())[0].id).toBe(r.id);
  });
});

describe("check-in by many people at once", () => {
  const desk = (s: SeedState, me: string) => storeDesk({
    e: youth(s), regs: () => s.registrations, meId: me, nameOf: (id) => s.people.find((p) => p.id === id)?.firstName ?? "",
    save: (r) => { s.registrations = [...s.registrations.filter((x) => x.id !== r.id), r]; }, newId: (p) => `${p}${Math.random()}`, personByPhone: () => undefined, day: () => "", session: () => undefined,
  });
  it("lets a ticket in once, and tells the next person who let them in", async () => {
    const s = clone(); const day = youth(s).days[0];
    const r = s.registrations.find((x) => x.eventId === "ev-youth")!;
    expect((await desk(s, P.worker.id).mark(r.id, day, "qr")).result).toBe("in");
    const again = await desk(s, P.media.id).mark(r.id, day, "ticket");
    expect(again.result).toBe("already");
    expect(again.reg.inBy).toBe(s.people.find((p) => p.id === P.worker.id)!.firstName);
    const saved = s.registrations.find((x) => x.id === r.id) as Registration;
    expect(saved.checkinLog).toHaveLength(1);
    expect(saved.checkinLog![0]).toMatchObject({ byId: P.worker.id, via: "qr", day });
  });
  it("counts registered, in and still to come", async () => {
    const s = clone(); const d = desk(s, P.worker.id); const day = youth(s).days[0];
    const before = await d.stats(day);
    const r = s.registrations.find((x) => x.eventId === "ev-youth" && x.type !== "online")!;
    await d.mark(r.id, day, "phone");
    const after = await d.stats(day);
    expect(after.in).toBe(before.in + 1);
    expect(after.notYet).toBe(before.notYet - 1);
  });
  it("gives a walk-in the next ticket number", async () => {
    const s = clone();
    const m = await desk(s, P.worker.id).walkin({ name: "New Walker", phone: "0809 111 2222" }, youth(s).days[0]);
    expect(m.result).toBe("in");
    expect(m.reg.ticket).toBe("RI26-00067");
  });
});

describe("committee rights and teams", () => {
  it("the head and assistant manage everything; others only what they were given", () => {
    const s = clone(); const e = youth(s);
    expect(committeeRights(e, a(s, P.outreach.id)).can("team")).toBe(true);
    expect(committeeRights(e, a(s, P.media.id)).can("meetings")).toBe(true); // assistant head
    expect(committeeRights(e, a(s, P.usher.id)).can("meetings")).toBe(false);
    expect(committeeRights(e, a(s, P.bursar.id)).can("budget")).toBe(true); // Finance Lead
    expect(committeeRights(e, a(s, P.member.id)).sees).toBe(false);
  });
  it("choosing a department puts all its members on the check-in team", () => {
    const s = clone(); const e = youth(s);
    const media = s.groups.find((g) => g.id === "g-media")!;
    expect(teamOf(s, e.duties!.checkin).length).toBeGreaterThanOrEqual(media.memberIds.length);
    const someone = media.memberIds.find((id) => !e.committee!.members.some((m) => m.personId === id))!;
    expect(checksIn(s, e, a(s, someone))).toBe(true);
    expect(checksIn(s, e, a(s, P.member.id))).toBe(false);
  });
  it("the Registration Lead can manage the teams", () => {
    const s = clone();
    expect(managesTeams(youth(s), a(s, P.membership.id))).toBe(true);
    expect(managesTeams(youth(s), a(s, P.choir.id))).toBe(false);
  });
});

describe("event budgets", () => {
  const req = (s: SeedState, patch: Partial<FundRequest>): FundRequest => {
    const f: FundRequest = { id: "frx", byId: P.choir.id, at: new Date().toISOString(), title: "Drums", purpose: "", category: "Events", eventId: "ev-youth", lines: [{ id: "l", item: "x", qty: 1, unit: 1000 }], stage: "committee", history: [], payments: [], ...patch };
    s.funds.push(f); return f;
  };
  it("go to the committee first: the head and Finance Lead review, finance can't yet", () => {
    const s = clone(); const f = req(s, {});
    expect(actionsFor(s, a(s, P.outreach.id), f)).toEqual(["committeeApprove", "committeeReturn"]);
    expect(actionsFor(s, a(s, P.bursar.id), f)).toEqual(["committeeApprove", "committeeReturn"]); // the committee's Finance Lead
    expect(actionsFor(s, a(s, P.choir.id), f)).toEqual([]);
  });
  it("only the Lead Pastor gives the final approval", () => {
    const s = clone(); const f = req(s, { stage: "pastor" });
    expect(actionsFor(s, a(s, P.lead.id), f)).toContain("approve");
    expect(actionsFor(s, a(s, P.associate.id), f)).not.toContain("approve");
  });
  it("sent back by finance, it waits with the committee", () => {
    const s = clone(); const f = req(s, { stage: "committee", returnedFrom: "finance", returnedTo: "committee" });
    expect(stageLabel(s, f)).toBe("Sent back by finance");
    expect(actionsFor(s, a(s, P.outreach.id), f)).toContain("committeeApprove");
  });
});

describe("briefing and notices", () => {
  it("shows registration against the target, men and women, places and accommodation", () => {
    const s = clone(); const b = briefing(s, youth(s));
    expect(b.target).toBe(500);
    expect(b.people).toBe(b.confirmed.length);
    expect(b.remaining).toBe(500 - b.people);
    expect(b.gender.reduce((n, [, c]) => n + c, 0)).toBe(b.confirmed.length);
    expect(b.locations.top[0][1]).toBeGreaterThan(0);
    expect(b.stay).toBeGreaterThan(0);
    expect(b.answers.some((x) => x.q.id === "q1")).toBe(true); // T-shirt sizes
  });
  it("committee members are told they're appointed and about the next meeting; the check-in team about their duty", () => {
    const s = clone();
    expect(noteKeys(s, P.usher.id).some((k) => k === "cmt-ev-youth")).toBe(true);
    expect(noteKeys(s, P.usher.id).some((k) => k.startsWith("cmm-cmt1"))).toBe(true);
    expect(myEventDuties(s, P.worker.id)[0].duties).toContain("checkin");
    expect(noteKeys(s, P.member.id).some((k) => k.startsWith("cmt-"))).toBe(false);
  });
  it("department members are asked about a new meeting until they answer", () => {
    const s = clone(); const g = s.groups.find((x) => x.id === "g-choir")!;
    const member = g.memberIds.find((id) => !g.leaderIds.includes(id))!; // the head set it up, so isn't asked
    g.meetings = [{ id: "dmx", title: "Rehearsal", kind: "programme", date: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10), time: "17:00", mode: "physical", venue: "Choir room", updatedAt: new Date().toISOString(), byId: P.choir.id }];
    expect(noteKeys(s, member).some((k) => k.startsWith("dm-dmx"))).toBe(true);
    s.rsvps.push({ id: `dept|dmx|${g.meetings[0].date}|${member}`, personId: member, kind: "dept", refId: g.id, meetingId: "dmx", date: g.meetings[0].date!, answer: "yes", at: new Date().toISOString() });
    expect(noteKeys(s, member).some((k) => k.startsWith("dm-dmx"))).toBe(false);
  });
});

describe("T-shirt size questions show as a dropdown list", () => {
  it("defaults T-shirt sizes to a dropdown, other choices to buttons, and follows the organiser's choice", async () => {
    const { showsDropdown, QUESTION_LIBRARY } = await import("@/lib/events");
    for (const label of ["T-shirt size", "Tshirt size", "T shirt size", "Your shirt size", "Jersey size"]) expect(showsDropdown({ type: "choice", label })).toBe(true);
    expect(showsDropdown({ type: "choice", label: "Gender" })).toBe(false);
    expect(showsDropdown({ type: "choice", label: "Gender", display: "dropdown" })).toBe(true);
    expect(showsDropdown({ type: "choice", label: "T-shirt size", display: "buttons" })).toBe(false);
    expect(showsDropdown({ type: "multi", label: "T-shirt size" })).toBe(false);
    expect(QUESTION_LIBRARY.find((q) => q.id === "tshirt")?.display).toBe("dropdown");
    expect(showsDropdown(youth(clone()).questions.find((q) => q.id === "q1")!)).toBe(true);
  });
});

describe("Event form: what's compulsory, and first and last name", () => {
  it("makes T-shirt, school or workplace and where they're coming from optional, everything else compulsory", async () => {
    const { isRequired, optionalByDefault, QUESTION_LIBRARY } = await import("@/lib/events");
    for (const label of ["T-shirt size", "School or workplace", "Where are you coming from?", "Which school do you attend?", "Your workplace"])
      expect(isRequired({ label })).toBe(false);
    for (const label of ["Gender", "Age range", "Any food needs or allergies?", "Are you a member of our church?", "Spouse's name"])
      expect(isRequired({ label })).toBe(true);
    expect(isRequired({ label: "T-shirt size", required: true })).toBe(true);
    expect(isRequired({ label: "Gender", required: false })).toBe(false);
    const optional = QUESTION_LIBRARY.filter((q) => optionalByDefault(q)).map((q) => q.id).sort();
    expect(optional).toEqual(["location", "school", "tshirt"]);
  });
  it("splits older one-name registrations into first and last name", async () => {
    const { splitName, joinName } = await import("@/lib/events");
    expect(splitName("Ada Grace Obi")).toEqual({ first: "Ada", last: "Grace Obi" });
    expect(splitName("Tunde")).toEqual({ first: "Tunde", last: "" });
    expect(joinName(" Ada ", "Obi ")).toBe("Ada Obi");
  });
});
