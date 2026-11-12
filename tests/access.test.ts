import { describe, expect, it } from "vitest";
import { seed, P } from "@/lib/seed";
import { accessFor } from "@/lib/access";
import { attendance, cameBack, escalation, goneQuiet, teamLoad } from "@/lib/metrics";

const s = seed;
const confidential = s.careNotes.find((n) => n.level === "confidential")!;
const care = s.careNotes.find((n) => n.level === "care")!;

describe("care notes", () => {
  it("lead pastor reads confidential counselling notes", () => {
    expect(accessFor(s, P.lead.id).canReadNote(confidential)).toBe(true);
  });
  it("other pastors can't, until the lead pastor shares the note", () => {
    expect(accessFor(s, P.resident.id).canReadNote(confidential)).toBe(false);
    expect(accessFor(s, P.resident.id).canReadNote({ ...confidential, sharedWith: [P.resident.id] })).toBe(true);
  });
  it("Faculty of Training and Membership Ministry leaders read care notes but not confidential ones", () => {
    for (const id of [P.training.id, P.membership.id]) {
      expect(accessFor(s, id).canReadNote(care)).toBe(true);
      expect(accessFor(s, id).canReadNote(confidential)).toBe(false);
    }
  });
  it("department heads and workers read neither", () => {
    for (const id of [P.media.id, P.worker.id, P.member.id]) {
      expect(accessFor(s, id).canReadNote(care)).toBe(false);
      expect(accessFor(s, id).canReadNote(confidential)).toBe(false);
    }
  });
});

describe("who sees whom", () => {
  it("lead pastor sees everyone", () => {
    expect(accessFor(s, P.lead.id).visiblePeople().length).toBe(s.people.length);
  });
  it("the media head sees Media and its units, not the whole church", () => {
    const seen = new Set(accessFor(s, P.media.id).visiblePeople().map((p) => p.id));
    const media = s.groups.filter((g) => g.id === "g-media" || g.parentId === "g-media").flatMap((g) => g.memberIds);
    media.forEach((id) => expect(seen.has(id)).toBe(true));
    expect(seen.size).toBeLessThan(s.people.length);
  });
  it("a member sees only themselves", () => {
    expect(accessFor(s, P.member.id).visiblePeople().map((p) => p.id)).toEqual([P.member.id]);
  });
  it("only the lead pastor counts as lead", () => {
    expect(accessFor(s, P.lead.id).isLead).toBe(true);
    expect(accessFor(s, P.associate.id).isLead).toBe(false);
  });
  it("welfare requests: welfare head and pastors only", () => {
    expect(accessFor(s, P.welfare.id).seesWelfare).toBe(true);
    expect(accessFor(s, P.resident.id).seesWelfare).toBe(true);
    // Department heads minute their own workers' requests, so they see the welfare page.
    expect(accessFor(s, P.media.id).seesWelfare).toBe(true);
    expect(accessFor(s, P.member.id).seesWelfare).toBe(false);
  });
});

describe("numbers we show pastors", () => {
  it("only tracked people can be gone quiet", () => {
    goneQuiet(s.people).forEach((p) => expect(p.tracked).toBe(true));
  });
  it("came-back rate uses the 2 to 8 week cohort", () => {
    const c = cameBack(s);
    expect(c.of).toBeGreaterThan(0);
    expect(c.pct).toBe(Math.round((c.back / c.of) * 100));
  });
  it("attendance compares with the 4-week average", () => {
    const a = attendance(s);
    expect(a.series.length).toBe(8);
    expect(typeof a.vsAvg).toBe("number");
  });
  it("overdue first-timers escalate after 48 hours", () => {
    const overdue = s.cases.find((c) => c.stage === "new" && c.assigneeId && Date.now() - Date.parse(c.createdAt) > 49 * 36e5)!;
    expect(escalation(s, overdue).level).toBeGreaterThan(0);
  });
  it("assigning suggests the lightest load first", () => {
    const load = teamLoad(s);
    for (let i = 1; i < load.length; i++) if (load[i].near === load[i - 1].near) expect(load[i].open).toBeGreaterThanOrEqual(load[i - 1].open);
  });
});
