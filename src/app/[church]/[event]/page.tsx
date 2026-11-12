"use client";

import { useParams } from "next/navigation";
import { PublicEvent } from "@/components/public-event";

/** The short event link: traqi.space/heirs/rise-2026 */
export default function EventLink() {
  const { church, event } = useParams<{ church: string; event: string }>();
  return <PublicEvent church={church} event={event} />;
}
