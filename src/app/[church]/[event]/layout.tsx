import type { Metadata } from "next";
import { eventDateLine, publicEvent } from "@/lib/server-public";

/** Link previews: the church's name, the event, its date and the flyer (or a branded card). */
export async function generateMetadata({ params }: { params: Promise<{ church: string; event: string }> }): Promise<Metadata> {
  const { church, event } = await params;
  const d = await publicEvent(church, event);
  if (!d?.event) return { title: "Event · Traqi" };
  const e = d.event;
  const theme = e.theme || e.tagline;
  const title = `${e.title} · ${d.church.name}`;
  const description = [theme, eventDateLine(e.days), e.mode === "virtual" ? "Online" : e.venue, "Register free"].filter(Boolean).join(" · ");
  return {
    title, description,
    openGraph: { title: e.title, description, siteName: d.church.name, type: "website" },
    twitter: { card: "summary_large_image", title: e.title, description },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
