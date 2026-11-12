import { describe, expect, it } from "vitest";
import { seed, P } from "@/lib/seed";
import { accessFor } from "@/lib/access";
import { firstStage, joinCounts, nextStage, openMeeting, progress, welfareAction, welfareRoute, welfareVisible } from "@/lib/domain";
import type { Meeting, WelfareRequest } from "@/lib/types";

const s = seed;
const at = (min: number) => new Date(Date.parse("2026-11-15T08:00:00Z") + min * 6e4).toISOString();
const m: Meeting = { id: "m", name: "1st service", kind: "sunday", date: "2026-11-15", start: at(0), end: at(120), mode: "physical", checkin: true, code: "1234" };

describe("check-in window", () => {
  it("opens 30 minutes before and closes when the service ends", () => {
    expect(openMeeting([m], Date.parse(at(-31)))).toBeUndefined();
    expect(openMeeting([m], Date.parse(at(-30)))).toBe(m);
    expect(openMeeting([m], Date.parse(at(119)))).toBe(m);
    expect(openMeeting([m], Date.parse(at(121)))).toBeUndefined();
  });
  it("ignores gatherings without check-in", () => {
    expect(openMeeting([{ ...m, checkin: false }], Date.parse(at(10)))).toBeUndefined();
  });
});

describe("welfare routes", () => {
  it("a pastor's own request goes to the lead pastor only", () => {
    expect(welfareRoute(s, P.resident.id).route).toEqual(["lead"]);
  });
  it("a leader's request goes straight to the pastorate", () => {
    expect(welfareRoute(s, P.media.id).route).toEqual(["pastorate"]);
  });
  it("a member's request goes through the Welfare head", () => {
    expect(welfareRoute(s, P.member.id).route).toEqual(["welfare", "pastorate"]);
  });
  it("a private worker's request skips their department head", () => {
    const w = { route: ["dept", "welfare", "pastorate"] } as WelfareRequest;
    expect(firstStage(w.route, true)).toBe("welfare");
    expect(firstStage(w.route, false)).toBe("dept");
    expect(nextStage({ ...w, private: true, stage: "welfare" } as WelfareRequest)).toBe("pastorate");
  });
  it("only the lead pastor sees a pastor's request", () => {
    const w = { id: "x", personId: P.resident.id, raisedById: P.resident.id, route: ["lead"], stage: "lead", private: false, minutes: [] } as unknown as WelfareRequest;
    expect(welfareVisible(accessFor(s, P.lead.id), w)).toBe(true);
    expect(welfareVisible(accessFor(s, P.associate.id), w)).toBe(false);
    expect(welfareVisible(accessFor(s, P.welfare.id), w)).toBe(false);
  });
  it("pastors decide up to the limit; above it, only the lead pastor", () => {
    const limit = s.church.profile!.approvalLimit;
    const w = { id: "y", personId: P.member.id, raisedById: P.member.id, route: ["welfare", "pastorate"], stage: "pastorate", private: false, minutes: [{ byId: P.welfare.id, role: "Welfare head", text: "", amount: limit + 1, at: at(0) }] } as unknown as WelfareRequest;
    expect(welfareAction(s, accessFor(s, P.associate.id), w)).toBeNull();
    expect(welfareAction(s, accessFor(s, P.lead.id), w)).toBe("decide");
    expect(welfareAction(s, accessFor(s, P.associate.id), { ...w, minutes: [{ ...w.minutes[0], amount: limit }] })).toBe("decide");
  });
});

describe("classes", () => {
  it("a Join click counts from 15 minutes before until the class ends", () => {
    const p = s.programmes[2];
    const sess = { id: "c", programmeId: p.id, moduleId: p.modules[0].id, date: "2026-11-15", start: at(0) };
    expect(joinCounts(sess, p, Date.parse(at(-16)))).toBe(false);
    expect(joinCounts(sess, p, Date.parse(at(-15)))).toBe(true);
    expect(joinCounts(sess, p, Date.parse(at(p.minutes + 1)))).toBe(false);
  });
  it("progress counts each class once, and recordings when the programme allows", () => {
    const e = s.enrolments.find((x) => x.programmeId === "pr-foundation")!;
    const pr = progress(s, e);
    expect(pr.done.length + pr.left.length).toBe(pr.prog.modules.length);
  });
});
