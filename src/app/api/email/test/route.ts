import { NextResponse } from "next/server";
import { admin, appUrl, send, sendingOn } from "@/lib/email/server";
import { testEmail, type EmailSummary } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

/** "Send a test email": goes only to the signed-in pastor or admin's own email. */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  let db;
  try { db = admin(); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
  const { data: u } = await db.auth.getUser(token);
  if (!u.user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const { churchId } = (await req.json().catch(() => ({}))) as { churchId?: string };
  const { data: me } = await db.from("people").select("id, first_name, email").eq("church_id", churchId ?? "").eq("user_id", u.user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: "You're not part of this church" }, { status: 403 });
  const { data: roles } = await db.from("role_assignments").select("roles(key)").eq("church_id", churchId!).eq("person_id", me.id).is("pending", null);
  const keys = (roles ?? []).map((r) => (r.roles as unknown as { key: string } | null)?.key);
  if (!keys.some((k) => k === "lead" || k === "admin")) return NextResponse.json({ error: "Only the lead pastor or admin can do this" }, { status: 403 });
  const to = me.email || u.user.email;
  if (!to) return NextResponse.json({ error: "Add your email to your profile first" }, { status: 400 });
  const { data: s } = await db.rpc("email_summary", { c: churchId });
  const status = await send(db, churchId!, "test", to, testEmail(s as EmailSummary, appUrl(), me.first_name));
  return NextResponse.json({ status, to, sendingOn: sendingOn() });
}

export async function GET() {
  return NextResponse.json({ sendingOn: sendingOn() });
}
