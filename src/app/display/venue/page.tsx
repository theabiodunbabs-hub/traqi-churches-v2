"use client";

import { useEffect, useState } from "react";
import { VenueDisplay } from "@/components/venue-codes";

/** The venue check-in code: on a screen (changes every minute) or printed (?print=1). */
export default function VenueDisplayPage() {
  const [q, setQ] = useState<{ e: string; print: boolean } | null>(null);
  useEffect(() => { const p = new URLSearchParams(location.search); setQ({ e: p.get("e") ?? "", print: !!p.get("print") }); }, []);
  return q ? <VenueDisplay eventId={q.e} print={q.print} /> : null;
}
