"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { useStore } from "@/lib/store";
import { MetSomeone } from "@/components/outreach";
import { Button } from "@/components/ui";

/** The link an outreach team opens: straight into "I met someone", tagged to the outreach. */
function Met() {
  const q = useSearchParams();
  const router = useRouter();
  const { state } = useStore();
  const o = state.outreaches.find((x) => x.id === q.get("o"));
  const [open, setOpen] = useState(true);
  return (
    <div className="mx-auto max-w-md py-6 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Megaphone size={26} /></span>
      <h1 className="mt-4 font-display text-[26px] font-semibold">{o ? o.name : "I met someone"}</h1>
      <p className="mt-1 text-ink-soft">Add each person as you meet them. The follow-up team takes it from there.</p>
      <Button variant="primary" className="mt-6 w-full py-3" onClick={() => setOpen(true)}>Add someone</Button>
      <Button className="mt-2 w-full py-3" onClick={() => router.push("/today")}>Done for now</Button>
      <MetSomeone open={open} onClose={() => setOpen(false)} outreachId={o?.id} />
    </div>
  );
}

export default function MetPage() { return <Suspense><Met /></Suspense>; }
