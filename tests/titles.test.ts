import { describe, it, expect } from "vitest";
import { readTitle } from "../src/lib/titles";
const D = ["Ushering", "Choir", "Media", "Children's Church", "Follow-up"];
describe("titles", () => {
  it.each([
    ["Head of Ushering", "head", "Ushering"], ["Ushering Lead", "head", "Ushering"], ["Head Usher", "head", "Ushering"], ["HOD Ushers", "head", "Ushering"],
    ["Asst. Head Usher", "assistant", "Ushering"], ["Deputy Lead, Choir", "assistant", "Choir"], ["Choir Coordinator", "head", "Choir"],
    ["Media Director", "head", "Media"], ["Chorister", "member", "Choir"], ["Usher", "member", "Ushering"], ["", "member", undefined],
  ])("%s", (t, pos, dept) => { const r = readTitle(t, D); expect(r.position).toBe(pos); expect(r.dept).toBe(dept); });
});
