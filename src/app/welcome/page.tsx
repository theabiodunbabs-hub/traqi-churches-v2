"use client";

import { useEffect, useState } from "react";
import { CheckinFlow } from "@/components/checkin-flow";

/** The first-timer form. It is the same flow as check-in, starting at "Say hello". */
export default function Welcome() {
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => { setSlug(new URLSearchParams(location.search).get("church") ?? ""); }, []);
  if (slug === null) return null;
  return <CheckinFlow slug={slug} startNew />;
}
