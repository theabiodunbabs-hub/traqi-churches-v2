import { describe, expect, it } from "vitest";
import { recommend, suggestSlug } from "@/lib/setup";

describe("church web addresses", () => {
  it("suggests short addresses", () => {
    expect(suggestSlug("Heirs Church")).toBe("heirs");
    expect(suggestSlug("Christ Apostolic Church")).toBe("cac");
    expect(suggestSlug("Christ Apostolic Church Ikeja")).toBe("cac-ikeja");
    expect(suggestSlug("Redeemed Christian Church of God")).toBe("rccg");
    expect(suggestSlug("The Covenant Nation")).toBe("covenant-nation");
  });
});

describe("Let Traqi recommend", () => {
  it("picks a level from four answers", () => {
    expect(recommend({ onlyPastor: true, size: "lt100", places: "one" }).level).toBe("close");
    expect(recommend({ onlyPastor: false, size: "100-500", places: "one" }).level).toBe("growing");
    expect(recommend({ onlyPastor: false, places: "few" }).level).toBe("branches");
    expect(recommend({ places: "many", regions: true }).level).toBe("network");
  });
});

import { rankChurches } from "@/lib/church-search";
describe("finding a church", () => {
  const list = [
    { name: "Christ Apostolic Church Ikeja", slug: "cac-ikeja", city: "Ikeja" },
    { name: "Redeemed Christian Church of God Light House", slug: "rccg-lh", city: "Lekki" },
    { name: "Heirs Church", slug: "heirs", city: "Lagos" },
    { name: "Harvesters International Christian Centre", slug: "harvesters", city: "Lekki" },
  ];
  it("understands abbreviations, partial names and typos", () => {
    expect(rankChurches("cac", list)[0].slug).toBe("cac-ikeja");
    expect(rankChurches("rccg", list)[0].slug).toBe("rccg-lh");
    expect(rankChurches("harv", list)[0].slug).toBe("harvesters");
    expect(rankChurches("vest", list)[0].slug).toBe("harvesters");
    expect(rankChurches("heris", list)[0].slug).toBe("heirs");
  });
  it("doesn't return unrelated churches", () => {
    expect(rankChurches("zzq", list)).toHaveLength(0);
  });
});
