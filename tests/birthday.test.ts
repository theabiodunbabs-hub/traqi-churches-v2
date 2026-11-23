import { describe, expect, it } from "vitest";
import { NO_BIRTH_YEAR, birthdayISO, birthdayLabel, birthdayParts, dayMonth, daysToBirthday, hasBirthYear } from "@/lib/format";

describe("Birthdays: day and month only", () => {
  it("saves a day and month without a year, and shows it as DD-MM", () => {
    const b = birthdayISO(14, 3);
    expect(b).toBe(`${NO_BIRTH_YEAR}-03-14`);
    expect(dayMonth(b)).toBe("14-03");
    expect(birthdayLabel(b)).toBe("14 March");
    expect(hasBirthYear(b)).toBe(false);
  });
  it("allows 29 February and keeps days inside the month", () => {
    expect(birthdayISO(29, 2)).toBe(`${NO_BIRTH_YEAR}-02-29`);
    expect(birthdayISO(31, 4)).toBe(`${NO_BIRTH_YEAR}-04-30`);
  });
  it("keeps a year staff recorded, and older full dates still read", () => {
    expect(birthdayISO(2, 9, 2018)).toBe("2018-09-02");
    expect(birthdayLabel("1985-07-21")).toBe("21 July 1985");
    expect(birthdayParts("1985-07-21")).toEqual({ day: 21, month: 7, year: 1985 });
    expect(birthdayParts("")).toBeNull();
  });
  it("counts days to the next birthday the same with or without a year", () => {
    const t = new Date(); const m = t.getMonth() + 1, d = t.getDate();
    expect(daysToBirthday(birthdayISO(d, m))).toBe(0);
    expect(daysToBirthday(birthdayISO(d, m, 1990))).toBe(0);
  });
});
