// Department titles mean the same thing whatever a church calls them:
// "Head of Ushering", "Ushering Lead", "Head Usher" and "HOD Ushering" are all the head of Ushering.
// "Asst. Head Usher", "Deputy Lead, Choir" and "Assistant Coordinator" are assistants.

export type TitleRead = { position: "head" | "assistant" | "member"; dept?: string };

const ASSISTANT = /\b(asst|ass't|assistant|deputy|vice|second|2nd|associate)\b/i;
const HEAD = /\b(head|hod|h\.o\.d|lead|leader|coordinator|co-ordinator|director|captain|president|overseer|chairman|chairperson|chair|convener|team lead|superintendent|in charge|i\/c)\b/i;
const FILLER = /\b(of|the|department|dept|unit|ministry|team|group|for|and|&|head|hod|h\.o\.d|lead|leader|coordinator|co-ordinator|director|captain|president|overseer|chairman|chairperson|chair|convener|superintendent|in|charge|i\/c|asst|ass't|assistant|deputy|vice|second|2nd|associate)\b/gi;

/** Words that name the same department. */
const ALIAS: Record<string, string> = { chorister: "choir", choristers: "choir", singer: "choir", singers: "choir", vocalist: "choir", instrumentalist: "music", usherette: "usher", steward: "usher", greeter: "welcome", teacher: "children", technician: "media" };
/** Same word, different endings: usher / ushers / ushering, media / medias. */
const stem = (w: string) => (ALIAS[w.toLowerCase()] ?? w).toLowerCase().replace(/[^a-z]/g, "").replace(/(ering|ing|ers|er|ists|ist|es|s)$/, "").slice(0, 5);

/** The department a title is about, from the church's own department names. */
export function deptFromTitle(title: string, depts: string[]): string | undefined {
  const words = title.replace(FILLER, " ").split(/[\s,/()-]+/).filter((w) => w.length > 2).map(stem);
  if (!words.length) return undefined;
  return depts.find((d) => d.split(/[\s&/,-]+/).filter((w) => w.length > 2).map(stem).some((x) => words.includes(x)));
}

/** Read a title: head, assistant or member, and of which department (if it names one). */
export function readTitle(title: string | undefined, depts: string[]): TitleRead {
  const t = (title ?? "").trim();
  if (!t) return { position: "member" };
  const dept = deptFromTitle(t, depts);
  if (ASSISTANT.test(t)) return { position: "assistant", dept };
  if (HEAD.test(t) || /^(chief|senior)\b/i.test(t)) return { position: "head", dept };
  return { position: "member", dept };
}

/** "Ushering Lead → Head of Ushering", for the import preview. */
export function titleSays(r: TitleRead) {
  if (!r.dept) return r.position === "head" ? "Head (which department?)" : r.position === "assistant" ? "Assistant (which department?)" : "";
  return r.position === "head" ? `Head of ${r.dept}` : r.position === "assistant" ? `Assistant, ${r.dept}` : `Member of ${r.dept}`;
}
