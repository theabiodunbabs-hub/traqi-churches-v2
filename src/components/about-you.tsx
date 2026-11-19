"use client";

import { Field, cx, inputCls } from "./ui";

/** Saved in the person's answers (custom) under these keys, so every form and the public check-in can fill them. */
export const ABOUT = { marital: "marital", maritalOther: "maritalOther", bornAgain: "bornAgain" } as const;
export type About = { marital?: string; maritalOther?: string; bornAgain?: string };

export const BORN_AGAIN: [string, string][] = [["yes", "Yes"], ["no", "No"], ["not_sure", "Not sure"], ["unknown", "I don't know what it means"]];
export const MARITAL: [string, string][] = [["single", "Single"], ["married", "Married"], ["other", "Others"]];

const chip = (on: boolean) => cx("min-h-11 rounded-full px-4 text-sm ring-1 transition", on ? "bg-deep text-white ring-deep" : "bg-surface text-ink-soft ring-line");

/** "Are you born again?" (first-timers) and marital status (first-timers and members). */
export function AboutYou({ value, onChange, bornAgain }: { value: About; onChange: (v: About) => void; bornAgain?: boolean }) {
  return (
    <>
      {bornAgain && (
        <Field label="Are you born again?">
          <div className="flex flex-wrap gap-1.5">{BORN_AGAIN.map(([k, l]) => <button type="button" key={k} onClick={() => onChange({ ...value, bornAgain: k })} className={chip(value.bornAgain === k)}>{l}</button>)}</div>
        </Field>
      )}
      <Field label="Marital status">
        <div className="flex flex-wrap gap-1.5">{MARITAL.map(([k, l]) => <button type="button" key={k} onClick={() => onChange({ ...value, marital: k, maritalOther: k === "other" ? value.maritalOther : undefined })} className={chip(value.marital === k)}>{l}</button>)}</div>
        {value.marital === "other" && <input className={cx(inputCls, "mt-2")} value={value.maritalOther ?? ""} onChange={(e) => onChange({ ...value, maritalOther: e.target.value })} placeholder="Tell us a little more (for example: engaged, widowed)" aria-label="Marital status, in your words" />}
      </Field>
    </>
  );
}

/** As answers for saving with the person's other answers. */
export const aboutAnswers = (a: About): Record<string, string> => Object.fromEntries(Object.entries({ [ABOUT.marital]: a.marital, [ABOUT.maritalOther]: a.marital === "other" ? a.maritalOther?.trim() : undefined, [ABOUT.bornAgain]: a.bornAgain }).filter(([, v]) => !!v)) as Record<string, string>;
export const aboutOf = (custom?: Record<string, string>): About => ({ marital: custom?.[ABOUT.marital], maritalOther: custom?.[ABOUT.maritalOther], bornAgain: custom?.[ABOUT.bornAgain] });
