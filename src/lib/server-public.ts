/**
 * Server-side reads of public pages, for link previews on WhatsApp, Facebook and X.
 * Uses the publishable key and the same public functions the pages use.
 */
type PublicEventData = { church: { name: string; slug: string; profile?: { color?: string; logo?: string } }; event: { title: string; theme?: string; tagline?: string; description?: string; flyer?: string; start: string; days: string[]; venue?: string; mode?: string } } | null;

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body), next: { revalidate: 300 } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

export const publicEvent = (church: string, event: string) => rpc<PublicEventData>("event_page", { p_slug: church, p_event: event });
export const publicChurch = (church: string) => rpc<{ name: string; slug: string; profile?: { color?: string; logo?: string; address?: string; city?: string } } | null>("church_page", { p_slug: church });

export const eventDateLine = (days: string[]) => {
  const f = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
  if (!days?.length) return "";
  return days.length > 1 ? `${f(days[0], { day: "numeric", month: "short" })} to ${f(days.at(-1)!, { day: "numeric", month: "short", year: "numeric" })}` : f(days[0], { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
