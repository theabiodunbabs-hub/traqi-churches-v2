import { describe, expect, it } from "vitest";
import { seed, P, type SeedState } from "@/lib/seed";
import { accessFor } from "@/lib/access";
import { actionsFor, balance, firstStage, linesTotal, seesBalance, seesFund, totalOf } from "@/lib/funds";
import { notificationsFor } from "@/lib/domain";

const clone = (): SeedState => JSON.parse(JSON.stringify(seed));
const fund = (s: SeedState, id: string) => s.funds.find((f) => f.id === id)!;
const acts = (s: SeedState, who: string, id: string) => actionsFor(s, accessFor(s, who), fund(s, id));

describe("fund requests", () => {
  it("route 2: finance reviews first, then the pastor approves, then finance pays", () => {
    const s = clone();
    expect(firstStage(s)).toBe("finance");
    expect(acts(s, P.bursar.id, "fr1")).toEqual(expect.arrayContaining(["forward", "return"]));
    expect(acts(s, P.bursar.id, "fr1")).not.toContain("approve");
    expect(acts(s, P.lead.id, "fr2")).toEqual(expect.arrayContaining(["approve", "return", "decline"]));
    expect(acts(s, P.bursar.id, "fr2")).toEqual([]);
  });
  it("route 3: finance can approve up to the limit, and no more", () => {
    const s = clone();
    s.church.profile!.finance = { ...s.church.profile!.finance!, route: 3, limit: 50000 };
    expect(acts(s, P.bursar.id, "fr6")).toContain("approve"); // ₦46,000 refund
    expect(acts(s, P.bursar.id, "fr1")).not.toContain("approve"); // ₦588,500
  });
  it("route 1: requests go straight to the pastor", () => {
    const s = clone();
    s.church.profile!.finance = { route: 1 };
    expect(firstStage(s)).toBe("pastor");
  });
  it("part payments leave the rest to pay", () => {
    const s = clone();
    const f = fund(s, "fr3");
    expect(totalOf(s, f)).toBe(120000);
    f.payments = [f.payments[0]];
    expect(acts(s, P.bursar.id, "fr3")).toContain("pay");
  });
  it("a worker sees only their own requests; the pastor can hide the balance from finance", () => {
    const s = clone();
    expect(seesFund(s, accessFor(s, P.member.id), fund(s, "fr1"))).toBe(false);
    expect(seesFund(s, accessFor(s, P.media.id), fund(s, "fr1"))).toBe(true);
    const fin = { ...accessFor(s, P.bursar.id) };
    s.church.profile!.finance!.hideBalance = true;
    expect(seesBalance(s, accessFor(s, P.lead.id))).toBe(true);
    expect(typeof balance(s).left).toBe("number");
    expect(fin.personId).toBe(P.bursar.id);
  });
  it("adds up line items", () => {
    expect(linesTotal([{ id: "a", item: "x", qty: 3, unit: 1500 }, { id: "b", item: "y", qty: 1, unit: 500 }])).toBe(5000);
  });
});

describe("counselling and invitations", () => {
  it("the pastor and his helpers hear about new requests; others don't", () => {
    const s = clone();
    const has = (who: string) => notificationsFor(s, accessFor(s, who), s.people.find((p) => p.id === who)!).some((n) => n.key.startsWith("cs-cs1"));
    expect(has(P.lead.id)).toBe(true);
    expect(has(P.admin.id)).toBe(true);
    expect(has(P.choir.id)).toBe(false);
  });
  it("invitations reach only the admin and pastorate", () => {
    const s = clone();
    const has = (who: string) => notificationsFor(s, accessFor(s, who), s.people.find((p) => p.id === who)!).some((n) => n.href === "/invitations");
    expect(has(P.lead.id)).toBe(true);
    expect(has(P.admin.id)).toBe(true);
    expect(has(P.media.id)).toBe(false);
  });
});
