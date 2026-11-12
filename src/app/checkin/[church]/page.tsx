"use client";

import { useParams } from "next/navigation";
import { CheckinFlow } from "@/components/checkin-flow";

/** The church's one permanent check-in link: /checkin/heirs. It opens whichever service is on. */
export default function Checkin() {
  const { church } = useParams<{ church: string }>();
  return <CheckinFlow slug={church} />;
}
