"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function Home() {
  const { ready, me } = useStore();
  const router = useRouter();
  useEffect(() => { if (ready) router.replace(me ? "/today" : "/login"); }, [ready, me, router]);
  return null;
}
