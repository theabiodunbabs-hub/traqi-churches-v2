"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LIVE, supabase } from "@/lib/supabase";
import { Landing } from "@/components/landing/landing";

/**
 * traqi's front door: the landing page for visitors.
 * Anyone already signed in goes straight to their Home.
 */
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (!LIVE || !supabase) return;
    supabase.auth.getSession().then(({ data }) => { if (data.session) router.replace("/today"); });
  }, [router]);
  return <Landing />;
}
