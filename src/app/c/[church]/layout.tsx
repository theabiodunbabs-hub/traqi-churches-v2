import type { Metadata } from "next";
import { publicChurch } from "@/lib/server-public";

export async function generateMetadata({ params }: { params: Promise<{ church: string }> }): Promise<Metadata> {
  const { church } = await params;
  const c = await publicChurch(church);
  if (!c) return { title: "Church · Traqi" };
  const where = [c.profile?.address, c.profile?.city].filter(Boolean).join(", ");
  const description = `${where ? `${where}. ` : ""}Service times, directions, events, and a warm welcome.`;
  return { title: c.name, description, openGraph: { title: c.name, description, siteName: c.name }, twitter: { card: "summary_large_image", title: c.name, description } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
