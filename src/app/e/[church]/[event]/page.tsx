"use client";

import { useParams } from "next/navigation";
import { PublicEvent } from "@/components/public-event";

/** The older link (/e/church/event) keeps working. */
export default function OldEventLink() {
  const { church, event } = useParams<{ church: string; event: string }>();
  return <PublicEvent church={church} event={event} />;
}
