import { describe, expect, it } from "vitest";
import { genderAnswer, isGenderQuestion, memberReturn, namesFromGoogle, opensFirstTime, ticketSeenKey } from "@/lib/event-join";

describe("Registering for an event as a member", () => {
  it("reads first and last name from Google", () => {
    expect(namesFromGoogle({ given_name: "Ada", family_name: "Obi" })).toEqual({ firstName: "Ada", lastName: "Obi" });
    expect(namesFromGoogle({ full_name: "Chidi Emeka Okafor" })).toEqual({ firstName: "Chidi", lastName: "Emeka Okafor" });
    expect(namesFromGoogle(undefined)).toEqual({ firstName: "", lastName: "" });
  });
  it("comes back to the event page as a member, with the form for Register now", () => {
    expect(memberReturn("/heirs/rise-2026")).toBe("/heirs/rise-2026?member=1");
    expect(memberReturn("/heirs/rise-2026", true)).toBe("/heirs/rise-2026?member=1&register=1");
  });
  it("answers the event's Gender question from 'I am'", () => {
    expect(isGenderQuestion({ type: "choice", label: "Gender" })).toBe(true);
    expect(isGenderQuestion({ type: "text", label: "Gender" })).toBe(false);
    expect(genderAnswer({ options: ["Male", "Female"] }, "F")).toBe("Female");
    expect(genderAnswer({ options: ["Men", "Women"] }, "M")).toBe("Men");
    expect(genderAnswer({ options: [] }, "M")).toBe("Male");
  });
  it("opens a new ticket on Home the first time only", () => {
    const store = new Set<string>();
    const r = { id: "rg1", at: new Date().toISOString() };
    expect(opensFirstTime(r, (k) => store.has(k))).toBe(true);
    store.add(ticketSeenKey(r.id));
    expect(opensFirstTime(r, (k) => store.has(k))).toBe(false);
    expect(opensFirstTime({ id: "old", at: "2020-01-01T00:00:00Z" }, () => false)).toBe(false);
  });
});
