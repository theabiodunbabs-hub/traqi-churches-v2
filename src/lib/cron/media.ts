import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Event pictures and videos are removed 14 days after the event (round 8). Registrations stay.
 * Runs with the morning job: empties each event's folder in the event-media bucket, then marks the page cleared.
 */
export async function clearEventMedia(db: SupabaseClient): Promise<number> {
  const { data: due, error } = await db.rpc("event_media_due");
  if (error) throw new Error(error.message);
  let n = 0;
  for (const d of (due ?? []) as { church_id: string; event_id: string }[]) {
    const folder = `${d.church_id}/event-${d.event_id}`;
    const { data: files } = await db.storage.from("event-media").list(folder, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${folder}/${f.name}`);
    if (paths.length) {
      const { error: rm } = await db.storage.from("event-media").remove(paths);
      if (rm) continue;
    }
    const { error: up } = await db.rpc("event_media_cleared", { c: d.church_id, ev: d.event_id });
    if (!up) n++;
  }
  return n;
}
