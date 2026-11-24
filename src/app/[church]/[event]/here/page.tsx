"use client";

import { useParams } from "next/navigation";
import { VenueCheckin } from "@/components/venue-checkin";

/** Check-in at the venue: traqi.church/heirs/rise-2026/here?k=CODE (from the printed code or the screen). */
export default function VenueCheckinPage() {
  const { church, event } = useParams<{ church: string; event: string }>();
  return <VenueCheckin church={church} event={event} />;
}
