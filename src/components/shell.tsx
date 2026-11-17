"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle, Bell, Building2, ChevronLeft, Check, Clock, GraduationCap, HeartHandshake, CalendarCheck, CalendarDays, HandCoins, Home, LayoutGrid, LogOut, Menu, MessageCircle,
  Plus, Search, Settings2, Share, HandHeart, Sparkles, Sprout, Users, UserRound, X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Asker, Avatar, Button, Confetti, Field, Sheet, Toasts, cx, inputCls, toast } from "./ui";
import { ChurchMark, LogoMark } from "./brand";
import { ThemeSwitch, useWords } from "./theme";
import { ContactPrompt } from "./care";
import { ago, fullName, hoursSince, stageInfo } from "@/lib/format";
import type { Access } from "@/lib/access";
import { currentChurchId, isOwnerLive, myChurches } from "@/lib/live";
import { notificationsFor, welfareAction, welfareVisible, type Note } from "@/lib/domain";
import { settingsPages } from "@/lib/settings-pages";
import { allowed, ask, searchAll, type Answer } from "@/lib/ask";

type Item = { href: string; label: string; icon: typeof Home; show: (a: Access) => boolean; badge?: number };
type Hub = { key: string; label: string; icon: typeof Home; items: Item[] };

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, me, access, state, signOut, saving, syncError, reload, mode } = useStore();
  const w = useWords();
  const router = useRouter();
  const path = usePathname();
  const [paletteOpen, setPalette] = useState(false);
  const [addOpen, setAdd] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [bell, setBell] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [ownerLive, setOwnerLive] = useState(false);
  useEffect(() => { if (mode === "live" && me) isOwnerLive().then(setOwnerLive).catch(() => setOwnerLive(false)); }, [mode, me]);

  useEffect(() => { if (ready && !me) router.replace("/login"); }, [ready, me, router]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(true); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => { setDrawer(false); setBell(false); }, [path]);

  const notes = useMemo(() => (me && access ? notificationsFor(state, access, me) : []), [state, access, me]);
  const seen = useSeen(me?.id);
  const unread = notes.filter((n) => !seen.has(n.key)).length;
  const overdue = useMemo(() => state.cases.filter((c) => c.stage === "new" && hoursSince(c.createdAt) > 48).length, [state.cases]);

  if (!ready || !me || !access) return <ShellSkeleton />;

  const staff = !access.isMemberOnly;
  const pendingEvents = state.events.filter((e) => e.status === "pending").length;
  const welfareWaiting = state.welfare.filter((x) => welfareVisible(access, x) && welfareAction(state, access, x)).length;
  const enrolled = state.enrolments.some((e) => e.personId === me.id);
  const prayersWaiting = state.prayers.filter((x) => !x.answered && !x.prayed.some((y) => y.byId === me.id) && hoursSince(x.at) <= 24 * 7).length;
  // Six places, each holding a few pages. The church's logo and name take you home.
  const hubDefs: Hub[] = [
    { key: "people", label: "People", icon: Users, items: [
      { href: "/people", label: "Everyone", icon: Users, show: (a) => a.can("people.view") },
      { href: "/messages", label: "Messages", icon: MessageCircle, show: (a) => !a.isMemberOnly },
    ] },
    { key: "follow", label: "Follow-up", icon: Sprout, items: [
      { href: "/first-timers", label: w.firstTimers, icon: Sprout, show: (a) => a.can("followup.assign") || a.can("followup.log"), badge: access.can("followup.assign") ? overdue : undefined },
      { href: "/outreach", label: "Outreach", icon: Sprout, show: (a) => a.isPastoral || a.can("followup.assign") || a.can("followup.log") || state.groups.some((g) => g.tags?.includes("outreach") && g.leaderIds.includes(me.id)) },
    ] },
    { key: "care", label: "Care", icon: HeartHandshake, items: [
      { href: "/welfare", label: w.welfare, icon: HeartHandshake, show: () => true, badge: welfareWaiting || undefined },
      { href: "/prayer", label: "Prayer", icon: HandHeart, show: () => true, badge: access.seesPrayers ? prayersWaiting || undefined : undefined },
    ] },
    { key: "services", label: "Services", icon: CalendarCheck, items: [
      { href: "/attendance", label: "Attendance", icon: CalendarCheck, show: (a) => a.can("attendance.record") || a.can("checkin.code") || a.isPastoral || a.leads.size > 0 },
      { href: "/finance", label: "Offerings", icon: HandCoins, show: (a) => a.canFinance },
    ] },
    { key: "ministry", label: "Ministry", icon: LayoutGrid, items: [
      { href: "/departments", label: w.departments, icon: LayoutGrid, show: (a) => a.can("people.view") || a.can("groups.manage") },
      { href: "/classes", label: "Classes", icon: GraduationCap, show: (a) => !a.isMemberOnly || enrolled || state.programmes.length > 0 },
      { href: "/events", label: "Events", icon: CalendarDays, show: () => true, badge: access.isPastoral ? pendingEvents || undefined : undefined },
    ] },
    { key: "settings", label: "Settings", icon: Settings2, items: settingsPages.filter((x) => x.show(access)).length ? [
      { href: "/settings", label: "Settings", icon: Settings2, show: () => true },
    ] : [] },
  ];
  const hubs = hubDefs.map((h) => ({ ...h, items: h.items.filter((i) => i.show(access)) })).filter((h) => h.items.length);
  const isIn = (href: string) => path === href || path.startsWith(href + "/");
  const activeHub = hubs.find((h) => h.key === "settings" ? path.startsWith("/settings") || path.startsWith("/activity") : h.items.some((i) => isIn(i.href)));
  const canAdd = access.can("followup.assign") || access.can("people.edit");
  const isOwner = mode === "demo" ? access.isLead : ownerLive;
  const home = path === "/today";

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3 scrollbar-dark" aria-label="Main">
      {hubs.map((h) => {
        const on = activeHub?.key === h.key;
        const badge = h.items.reduce((n, i) => n + (i.badge ?? 0), 0);
        return (
          <div key={h.key}>
            <NavLink item={{ href: h.items[0].href, label: h.label, icon: h.icon, show: () => true, badge: on && h.items.length > 1 ? undefined : badge || undefined }} active={on} />
            {on && h.items.length > 1 && (
              <div className="mb-1.5 ml-[30px] mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                {h.items.map((it) => (
                  <Link key={it.href} href={it.href} aria-current={isIn(it.href) ? "page" : undefined}
                    className={cx("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13.5px]", isIn(it.href) ? "bg-white/[.1] font-medium text-white" : "text-white/60 hover:bg-white/[.06] hover:text-white")}>
                    <span className="flex-1">{it.label}</span>
                    {!!it.badge && <span className="min-w-5 rounded-full bg-alert px-1.5 text-center text-[12px] font-semibold leading-5 text-white">{it.badge}</span>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {isOwner && (
        <div className="mt-4"><NavLink item={{ href: "/owner", label: "Traqi owner view", icon: Sparkles, show: () => true }} active={path.startsWith("/owner")} /></div>
      )}
    </nav>
  );

  const footer = (
    <div className="space-y-2 border-t border-white/[.08] p-3">
      <ChurchSwitcher />
      <ThemeSwitch dark />
      <div className="flex items-center gap-2 rounded-2xl bg-white/[.06] px-3 py-2">
        <Sparkles size={15} className="shrink-0 text-accent" />
        <span className="flex-1 text-[12px] leading-tight text-white/70"><b className="block font-semibold text-white">Early access</b>Free, all unlocked</span>
        <button type="button" onClick={() => setFeedback(true)} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-white/20">Feedback</button>
      </div>
      <div className="flex items-center gap-3 rounded-xl p-1.5">
        <Link href={`/people/${me.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 hover:bg-white/[.06]">
          <Avatar person={me} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">{fullName(me)}</span>
            <span className="block truncate text-xs text-white/60">{access.roleNames.join(", ")}</span>
          </span>
        </Link>
        <button type="button" onClick={() => { signOut(); router.push("/login"); }} className="rounded-lg p-2.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label={mode === "live" ? "Sign out" : "Switch person"} title={mode === "live" ? "Sign out" : "Switch person"}>
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );

  const bellBtn = (cls: string) => (
    <button type="button" onClick={() => { setBell(true); }} className={cx("relative rounded-xl p-2 transition", cls)} aria-label={`Notifications${unread ? `, ${unread} new` : ""}`}>
      <Bell size={19} />
      {unread > 0 && <span className="pop absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-alert px-1 text-[12px] font-bold leading-[18px] text-white ring-2 ring-[var(--color-deep)]">{unread > 9 ? "9+" : unread}</span>}
    </button>
  );

  // Phone and tablet bottom bar: home first, then the person's main places
  const order = ["people", "follow", "services", "ministry", "care"];
  const tabs: Item[] = order.map((k) => hubs.find((h) => h.key === k)).filter((h): h is Hub => !!h)
    .map((h) => ({ href: h.items[0].href, label: h.label, icon: h.icon, show: () => true })).slice(0, canAdd ? 3 : 4);
  const homeTab: Item = { href: "/today", label: "Home", icon: Home, show: () => true };
  const barItems = [homeTab, ...tabs];
  const sub = activeHub && activeHub.items.length > 1 ? activeHub.items : null;

  return (
    <div className="min-h-screen lg:pl-[264px]">
      {/* Laptop side menu: dark and church-tinted */}
      <aside className="side fixed inset-y-0 left-0 hidden w-[264px] flex-col lg:flex">
        <ChurchHeader active={home} />
        <div className="flex gap-2 px-3 pb-3">
          <button type="button" onClick={() => setPalette(true)} className="flex flex-1 items-center gap-2 rounded-xl bg-white/[.07] px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[.11] hover:text-white">
            <Search size={15} /> {staff ? "Search or ask" : "Ask Traqi"}
            <kbd className="ml-auto rounded-md bg-white/10 px-1.5 text-[12px] text-white/70">⌘K</kbd>
          </button>
          {bellBtn("bg-white/[.07] text-white/80 hover:bg-white/[.11] hover:text-white")}
        </div>
        {canAdd && (
          <div className="px-3 pb-4">
            <button type="button" onClick={() => setAdd(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-[14.5px] font-semibold text-[var(--color-deep)] shadow-lg shadow-black/20 transition hover:bg-white/90 active:scale-[.98]"><Plus size={16} /> Add {w.lower("firstTimer")}</button>
          </div>
        )}
        {nav}
        {footer}
      </aside>

      {/* Phone and tablet top bar in the church's colour */}
      <header className="sticky top-0 z-30 flex items-center gap-1 px-3 py-2 text-white shadow-md shadow-black/10 lg:hidden" style={{ background: "linear-gradient(135deg, var(--color-deep), color-mix(in srgb, var(--color-deep) 70%, var(--color-brand)))" }}>
        <button type="button" onClick={() => setDrawer(true)} className="rounded-xl p-2.5 hover:bg-white/10" aria-label="Open menu"><Menu size={20} /></button>
        <Link href="/today" className="flex min-h-11 min-w-0 items-center gap-2" aria-label={`${state.church.name}, home`}>
          <ChurchMark church={state.church} size={30} className="ring-2 ring-white/20" />
          <span className="truncate font-display text-[16.5px]">{state.church.name}</span>
        </Link>
        <span className="ml-auto" />
        <button type="button" onClick={() => setPalette(true)} className="rounded-xl p-2.5 hover:bg-white/10" aria-label="Search or ask"><Search size={19} /></button>
        {bellBtn("hover:bg-white/10")}
      </header>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" className="fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <aside className="side slide-in relative flex h-full w-[296px] max-w-[85vw] flex-col shadow-2xl">
            <div className="flex items-center justify-between pr-3"><ChurchHeader active={home} /><button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="rounded-lg p-2.5 text-white/70 hover:bg-white/10"><X size={18} /></button></div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 pb-32 pt-5 md:px-8 md:pt-8 lg:pb-14">
        {sub && (
          <div className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 scrollbar-none lg:hidden" aria-label={activeHub?.label}>
            {sub.map((it) => (
              <Link key={it.href} href={it.href} aria-current={isIn(it.href) ? "page" : undefined}
                className={cx("flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] ring-1 transition", isIn(it.href) ? "bg-deep font-medium text-white ring-deep" : "bg-surface text-ink-soft ring-line")}>
                {it.label}{!!it.badge && <span className="rounded-full bg-alert px-1.5 text-[12px] font-semibold leading-5 text-white">{it.badge}</span>}
              </Link>
            ))}
          </div>
        )}
        {activeHub?.key === "settings" && path !== "/settings" && <Link href="/settings" className="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-brand"><ChevronLeft size={16} /> Settings</Link>}
        {mode === "demo" && path === "/today" && <InstallPrompt />}
        {children}
      </main>

      {/* Phone and tablet bottom bar */}
      <nav className={cx("fixed inset-x-0 bottom-0 z-30 grid border-t border-line/70 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden", canAdd ? "grid-cols-5" : ["grid-cols-1", "grid-cols-2", "grid-cols-2", "grid-cols-3", "grid-cols-4", "grid-cols-5"][barItems.length])} aria-label="Quick">
        {barItems.flatMap((i, idx) => {
          const Icon = i.icon; const on = i.href === "/today" ? home : hubs.find((h) => h.items[0].href === i.href)?.key === activeHub?.key;
          const tab = (
            <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined} aria-label={i.label} className={cx("relative flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-[12px]", on ? "font-semibold text-brand" : "text-ink-soft")}>
              {on && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-brand" />}
              <Icon size={21} strokeWidth={on ? 2.3 : 1.8} />{i.label}
            </Link>
          );
          return canAdd && idx === 2 ? [
            <div key="add" className="flex items-center justify-center">
              <button type="button" onClick={() => setAdd(true)} aria-label={`Add ${w.lower("firstTimer")}`} className="-mt-6 flex size-14 items-center justify-center rounded-2xl text-white shadow-lg shadow-brand/40 ring-4 ring-surface transition active:scale-95" style={{ background: "linear-gradient(135deg, var(--color-brand), var(--color-deep))" }}>
                <Plus size={24} />
              </button>
            </div>, tab] : [tab];
        })}
      </nav>

      {syncError && (
        <div role="alert" className="fade fixed inset-x-3 top-3 z-[70] mx-auto flex max-w-lg items-start gap-3 rounded-2xl bg-alert px-4 py-3 text-sm text-white shadow-xl md:left-auto md:right-6 md:top-6">
          <span className="flex-1">{syncError}</span>
          <button type="button" onClick={reload} className="shrink-0 rounded-lg bg-white/20 px-2.5 py-1 font-medium hover:bg-white/30">Reload</button>
        </div>
      )}
      {mode === "live" && saving && !syncError && (
        <div aria-live="polite" className="fade fixed bottom-24 left-1/2 z-[65] -translate-x-1/2 rounded-full bg-deep px-3.5 py-1.5 text-xs font-medium text-white shadow-lg lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0">Saving…</div>
      )}
      <ContactPrompt />
      <Toasts />
      <Asker />
      <FirstSignIn />
      <Palette open={paletteOpen} onClose={() => setPalette(false)} />
      <AddFirstTimer open={addOpen} onClose={() => setAdd(false)} />
      <Notifications open={bell} onClose={() => setBell(false)} notes={notes} seen={seen} />
      <FeedbackSheet open={feedback} onClose={() => setFeedback(false)} />
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-screen lg:pl-[264px]">
      <aside className="side fixed inset-y-0 left-0 hidden w-[264px] lg:block" />
      <div className="mx-auto max-w-6xl space-y-4 px-4 pt-8 md:px-8">
        <div className="skeleton h-40 rounded-[28px]" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-3xl" />)}</div>
        <div className="skeleton h-64 rounded-3xl" />
      </div>
    </div>
  );
}

/** The church's logo and name: tapping it takes you home. */
function ChurchHeader({ active }: { active: boolean }) {
  const { state } = useStore();
  return (
    <Link href="/today" aria-label={`${state.church.name}, home`} aria-current={active ? "page" : undefined}
      className={cx("m-2 mb-3 flex items-center gap-3 rounded-2xl px-3 py-3 transition", active ? "bg-white/[.08]" : "hover:bg-white/[.06]")}>
      <ChurchMark church={state.church} size={42} className="shadow-lg shadow-black/30 ring-2 ring-white/15" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-display text-[16px] text-white">{state.church.name}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[12px] text-white/65"><LogoMark size={12} /> Powered by Traqi</span>
      </span>
    </Link>
  );
}

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cx("group relative flex items-center gap-3 rounded-xl px-3 py-[7px] text-[14.5px] transition-colors",
        active ? "bg-white/[.12] font-semibold text-white" : "text-white/65 hover:bg-white/[.06] hover:text-white")}
    >
      {active && <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-accent" />}
      <Icon size={18} strokeWidth={active ? 2.3 : 1.8} className={cx(active ? "text-accent" : "text-white/65 group-hover:text-white/80")} />
      <span className="flex-1">{item.label}</span>
      {!!item.badge && <span className="min-w-5 rounded-full bg-alert px-1.5 text-center text-[12px] font-semibold leading-5 text-white">{item.badge}</span>}
    </Link>
  );
}

/** Which notifications this person has opened, kept on this device. */
function useSeen(id?: string) {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!id) return;
    const read = () => { try { setSeen(new Set(JSON.parse(localStorage.getItem(`traqi-seen-${id}`) || "[]"))); } catch { /* storage unavailable */ } };
    read();
    window.addEventListener("traqi-seen", read);
    return () => window.removeEventListener("traqi-seen", read);
  }, [id]);
  return seen;
}
function markSeen(id: string, keys: string[]) {
  try { localStorage.setItem(`traqi-seen-${id}`, JSON.stringify(keys.slice(-300))); window.dispatchEvent(new Event("traqi-seen")); } catch { /* storage unavailable */ }
}

function Notifications({ open, onClose, notes, seen }: { open: boolean; onClose: () => void; notes: Note[]; seen: Set<string> }) {
  const { me } = useStore();
  const tone = { alert: "bg-alert-soft text-alert", glow: "bg-glow-soft text-glow-ink", brand: "bg-brand-soft text-brand", good: "bg-good-soft text-good" };
  const icon = { alert: AlertCircle, glow: Clock, brand: Bell, good: Sparkles };
  return (
    <Sheet open={open} onClose={() => { if (me) markSeen(me.id, [...seen, ...notes.map((n) => n.key)]); onClose(); }} title="Notifications">
      {notes.length === 0 ? (
        <div className="py-10 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-good-soft text-good"><Check size={26} /></div>
          <p className="font-display text-lg font-semibold">You're all caught up</p>
          <p className="mt-1 text-sm text-muted">Anything that needs you will show up here.</p>
        </div>
      ) : (
        <ul className="-mx-2 space-y-1">
          {notes.map((n) => {
            const I = icon[n.tone];
            return (
              <li key={n.key}>
                <Link href={n.href} onClick={() => me && markSeen(me.id, [...seen, n.key])} className="flex items-start gap-3 rounded-2xl p-3 transition hover:bg-page">
                  <span className={cx("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", tone[n.tone])}><I size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium">{n.title}{!seen.has(n.key) && <span className="size-2 rounded-full bg-brand" />}</span>
                    <span className="block truncate text-[13px] text-muted">{n.body}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-muted">{ago(n.at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 rounded-xl bg-page px-3 py-2.5 text-[12.5px] text-muted">A daily summary also goes to your email at 7:00 AM.</p>
    </Sheet>
  );
}

function FeedbackSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { put, newId, me } = useStore();
  const path = usePathname();
  const [text, setText] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title="Tell us what you think">
      <p className="mb-3 text-sm text-ink-soft">Something confusing, missing or lovely? It goes straight to the Traqi team.</p>
      <textarea className={cx(inputCls, "min-h-32")} value={text} onChange={(e) => setText(e.target.value)} placeholder="I wish I could…" />
      <Button variant="primary" className="mt-3 w-full" disabled={!text.trim()} onClick={() => {
        put("appFeedback", { id: newId("fb"), byId: me!.id, screen: path, text: text.trim(), at: new Date().toISOString() });
        setText(""); onClose(); toast("Thank you. We read every note.");
      }}>Send feedback</Button>
    </Sheet>
  );
}

/** A short welcome the first time each person signs in, written for their role. */
function FirstSignIn() {
  const { me, access, state } = useStore();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!me) return;
    try { if (!localStorage.getItem(`traqi-hello-${me.id}`)) setShow(true); } catch { /* storage unavailable */ }
  }, [me]);
  if (!show || !me || !access) return null;
  const close = () => { try { localStorage.setItem(`traqi-hello-${me.id}`, "1"); } catch { /* storage unavailable */ } setShow(false); };
  const tips = access.isLead ? ["Home shows the church at a glance each morning.", "Welfare requests above the limit come to you.", "Approve count corrections in Offerings."]
    : access.isPastoral ? ["Home shows the people and departments you oversee.", "Approve events and welfare requests from the bell.", "Open anyone's profile to see their journey."]
    : access.isMemberOnly ? ["Check in on Sundays with the church link.", "See your classes and register for events.", "Ask for welfare support privately."]
    : access.leads.size ? ["Your department's people are in People.", "Send birthday wishes from Messages.", "The bell tells you what needs you today."]
    : ["Your follow-up calls are on Home.", "Tap WhatsApp to send a ready-made message.", "Log each call so nobody is missed."];
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 md:items-center" role="dialog" aria-modal aria-label="Welcome">
      <button type="button" aria-label="Close" className="fade absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <div className="rise relative w-full max-w-md overflow-hidden rounded-[28px] bg-surface shadow-2xl">
        <div className="hero rounded-none px-6 pb-6 pt-7">
          <ChurchMark church={state.church} size={44} />
          <p className="mt-4 font-display text-2xl font-semibold">Welcome to Traqi, {me.firstName}</p>
          <p className="mt-1 text-sm text-white/70">{state.church.name} uses Traqi so no one slips through the cracks.</p>
        </div>
        <ul className="space-y-3 p-6">
          {tips.map((t, i) => (
            <li key={t} className="flex items-start gap-3 text-[14.5px]"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{i + 1}</span>{t}</li>
          ))}
        </ul>
        <div className="px-6 pb-6"><Button variant="primary" className="w-full py-3" onClick={close}>Let's go</Button></div>
      </div>
    </div>
  );
}

/** "Add Traqi to your home screen": one tap on Android, a picture guide on iPhone. */
export function InstallPrompt() {
  const [evt, setEvt] = useState<Event & { prompt?: () => void } | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [guide, setGuide] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem("traqi-install-dismissed")) return; } catch { /* storage unavailable */ }
    if (window.matchMedia?.("(display-mode: standalone)").matches) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    if (isIos) setHidden(false);
    const h = (e: Event) => { e.preventDefault(); setEvt(e as never); setHidden(false); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (hidden) return null;
  const dismiss = () => { try { localStorage.setItem("traqi-install-dismissed", "1"); } catch { /* storage unavailable */ } setHidden(true); };
  return (
    <div className="rise mb-4 flex items-center gap-3 rounded-2xl bg-surface p-3 pr-2 shadow-sm ring-1 ring-line md:hidden">
      <LogoMark size={36} />
      <span className="flex-1 text-[13.5px] leading-tight"><b className="font-semibold">Add Traqi to your home screen</b><br /><span className="text-muted">Open it like an app, with notifications.</span></span>
      <Button variant="primary" className="px-3 py-2 text-[13px]" onClick={() => (ios ? setGuide(true) : (evt?.prompt?.(), dismiss()))}>Add</Button>
      <button type="button" onClick={dismiss} className="p-1.5 text-muted" aria-label="Not now"><X size={16} /></button>
      <Sheet open={guide} onClose={() => { setGuide(false); dismiss(); }} title="Add to your home screen">
        <ol className="space-y-4">
          {[["Tap the Share button", "The square with an arrow, at the bottom of Safari.", Share], ["Choose “Add to Home Screen”", "Scroll down the list if you don't see it.", Plus], ["Tap “Add”", "Traqi now opens from your home screen.", Check]].map(([t, b, I], i) => {
            const Icon = I as typeof Share;
            return <li key={i} className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Icon size={19} /></span><span><b className="block font-semibold">{t as string}</b><span className="text-sm text-muted">{b as string}</span></span></li>;
          })}
        </ol>
      </Sheet>
    </div>
  );
}

/** One box for everything: find a person, or ask Traqi a question. */
function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { access, state } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const [asked, setAsked] = useState<Answer | null>(null);
  const [list, setList] = useState(false);
  useEffect(() => { if (!open) { setQ(""); setI(0); setAsked(null); setList(false); } }, [open]);
  if (!open || !access) return null;
  const { people, answer } = q.trim() ? searchAll(state, access, q) : { people: [], answer: null };
  const shown = asked ?? answer;
  const chips = allowed(access).filter((c) => ["attendance", "firsttimers", "birthdays", "quiet", "events", "classes"].includes(c.key)).slice(0, 4);
  const go = (href: string) => { onClose(); router.push(href); };
  const total = access.isMemberOnly ? 0 : access.visiblePeople().length;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[8vh] sm:px-4 sm:pt-[12vh]" role="dialog" aria-modal aria-label="Search or ask">
      <button type="button" aria-label="Close" className="fade absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="rise relative w-full max-w-lg overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-line">
        <form className="flex items-center gap-3 border-b border-line px-4" onSubmit={(e) => { e.preventDefault(); if (people[i] && !answer) go(`/people/${people[i].id}`); else if (q.trim()) setAsked(ask(state, access, q)); }}>
          <Search size={18} className="shrink-0 text-muted" />
          <input
            autoFocus value={q} placeholder={access.isMemberOnly ? "Ask about events, classes…" : "Find a person, or ask a question"}
            onChange={(e) => { setQ(e.target.value); setI(0); setAsked(null); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setI((x) => Math.min(x + 1, people.length - 1));
              if (e.key === "ArrowUp") setI((x) => Math.max(x - 1, 0));
            }}
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
          />
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-page" aria-label="Close"><X size={17} /></button>
        </form>
        <div className="max-h-[65vh] overflow-y-auto p-2">
          {shown && (
            <div className="pop m-1 mb-2 rounded-2xl bg-brand-soft/50 p-4">
              <div className="flex items-start gap-3">
                {shown.number ? <span className="num shrink-0 text-[32px] font-semibold leading-none text-brand">{shown.number}</span> : <Sparkles size={18} className="mt-0.5 shrink-0 text-brand" />}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[16px] font-semibold">{shown.title}</p>
                  <p className="mt-0.5 text-[14px] text-ink-soft">{shown.text}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[13.5px] font-medium">
                    {shown.people && shown.people.length > 0 && <button type="button" className="min-h-9 text-brand" onClick={() => setList(!list)}>{list ? "Hide" : `See the ${shown.people.length} ${shown.people.length === 1 ? "person" : "people"}`}</button>}
                    {shown.href && <button type="button" className="min-h-9 text-brand" onClick={() => go(shown.href!)}>Open</button>}
                  </div>
                </div>
              </div>
              {list && shown.people && <ul className="mt-2 space-y-0.5">{shown.people.map((p) => (
                <li key={p.id}><button type="button" onClick={() => go(`/people/${p.id}`)} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface"><Avatar person={p} size={28} /><span className="truncate text-[14px] font-medium">{fullName(p)}</span></button></li>
              ))}</ul>}
            </div>
          )}
          {people.length > 0 && (
            <>
              {shown && <p className="px-3 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wide text-muted">People</p>}
              <ul>{people.map((p, idx) => (
                <li key={p.id}>
                  <button type="button" onClick={() => go(`/people/${p.id}`)} onMouseEnter={() => setI(idx)} className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left", idx === i && "bg-brand-soft")}>
                    <Avatar person={p} size={34} />
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{fullName(p)}</span><span className="block truncate text-[12.5px] text-muted">{[stageInfo(p.stage).label, p.location].filter(Boolean).join(" · ")}</span></span>
                  </button>
                </li>
              ))}</ul>
            </>
          )}
          {q.trim() && !people.length && !shown && (
            <div className="px-3 py-5 text-center text-sm text-muted">
              No one matches “{q}”.
              <button type="button" onClick={() => setAsked(ask(state, access, q))} className="mt-2 block w-full font-medium text-brand">Ask Traqi instead</button>
            </div>
          )}
          {!q.trim() && (
            <div className="p-2">
              {!access.isMemberOnly && <p className="mb-3 px-1 text-[13.5px] text-muted">Type a name or phone number to find any of the {total} people you can see, or ask a question:</p>}
              <div className="flex flex-wrap gap-2">{chips.map((c) => (
                <button type="button" key={c.key} onClick={() => { setQ(c.label); setAsked(ask(state, access, c.label)); }} className="min-h-9 rounded-full bg-page px-3 text-[13px] text-ink-soft ring-1 ring-line hover:ring-brand/40">{c.label}</button>
              ))}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AddFirstTimer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addFirstTimer, person, state } = useStore();
  const router = useRouter();
  const [f, setF] = useState({ firstName: "", lastName: "", gender: "" as "" | "M" | "F", phone: "", location: "", heard: "" });
  const [err, setErr] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); setErr(null); };
  const close = () => { onClose(); setDone(null); setAgreed(false); setF({ firstName: "", lastName: "", gender: "", phone: "", location: "", heard: "" }); };
  const submit = () => {
    if (!f.firstName.trim() || !f.lastName.trim()) return setErr("Enter their first and last name.");
    if (!f.gender) return setErr("Choose a gender.");
    if (f.phone.replace(/\D/g, "").length < 10) return setErr("Enter a phone number with at least 10 digits.");
    if (!agreed) return setErr("Ask them if it's okay for the church to keep their details and contact them, then tick the box.");
    const id = addFirstTimer({ firstName: f.firstName.trim(), lastName: f.lastName.trim(), gender: f.gender, phone: f.phone.trim(), location: f.location || undefined, heardFrom: f.heard || undefined, consent: { at: new Date().toISOString(), via: "staff" } });
    setDone(id);
  };
  const added = done ? person(done) : undefined;
  return (
    <Sheet open={open} onClose={close} title={done ? "First-timer added" : "Add a first-timer"}>
      {done ? (
        <div className="rise text-center">
          <Confetti show />
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-j1 font-display text-2xl font-semibold">{f.firstName[0]}{f.lastName[0]}</div>
          <p className="font-display text-xl font-semibold">Welcome, {f.firstName}</p>
          <p className="mt-2 text-sm text-ink-soft">{added ? `${f.firstName} is on the follow-up board, waiting for the follow-up head to choose who calls. The 48-hour clock has started.` : ""}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => { setDone(null); setF({ firstName: "", lastName: "", gender: "", phone: "", location: "", heard: "" }); }}>Add another</Button>
            <Button variant="primary" onClick={() => { close(); router.push("/first-timers"); }}>Open follow-up board</Button>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name"><input className={inputCls} value={f.firstName} onChange={set("firstName")} placeholder="Adaeze" /></Field>
            <Field label="Last name"><input className={inputCls} value={f.lastName} onChange={set("lastName")} placeholder="Okeke" /></Field>
          </div>
          <Field label="Gender">
            <div className="grid grid-cols-2 gap-2">
              {(["F", "M"] as const).map((g) => (
                <button type="button" key={g} onClick={() => { setF({ ...f, gender: g }); setErr(null); }}
                  className={cx("rounded-xl py-2.5 text-sm ring-1", f.gender === g ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>
                  {g === "F" ? "Female" : "Male"}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Phone number" hint="Used for WhatsApp too, unless they give another number later."><input className={inputCls} value={f.phone} onChange={set("phone")} placeholder="0803 123 4567" inputMode="tel" /></Field>
          <Field label="Area they live in"><input className={inputCls} value={f.location} onChange={set("location")} placeholder="Surulere" /></Field>
          <Field label={`How did they hear about ${state.church.name}?`}>
            <select className={inputCls} value={f.heard} onChange={set("heard")}>
              <option value="">Choose one</option><option>Invited by a member</option><option>Social media</option><option>Walked in</option><option>Outreach</option><option>Online church</option>
            </select>
          </Field>
          <label className="flex gap-3 rounded-xl bg-page p-3 text-[13.5px] text-ink-soft ring-1 ring-line">
            <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); setErr(null); }} className="mt-0.5 size-5 shrink-0 accent-brand" />
            They agreed that {state.church.name} may keep their details and contact them.
          </label>
          {err && <p className="text-sm text-alert" role="alert">{err}</p>}
          <Button variant="primary" type="submit" className="w-full py-3">Add first-timer</Button>
        </form>
      )}
    </Sheet>
  );
}

export function MemberIcon() { return <UserRound size={16} />; }

/** Someone in more than one church switches between them here. Each church sees only its own record of them. */
function ChurchSwitcher() {
  const { mode, reload } = useStore();
  const [list, setList] = useState<{ id: string; name: string; logo?: string; color?: string }[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (mode === "live") myChurches().then(setList).catch(() => setList([])); }, [mode]);
  if (list.length < 2) return null;
  const current = currentChurchId();
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 rounded-xl bg-white/[.06] px-3 py-2 text-left text-[12.5px] text-white/70 hover:bg-white/[.1]" aria-expanded={open}>
        <Building2 size={14} /> <span className="flex-1">Switch church ({list.length})</span>
      </button>
      {open && (
        <ul className="absolute bottom-full left-0 right-0 mb-1 space-y-0.5 rounded-xl bg-[var(--color-deep-2)] p-1.5 shadow-2xl ring-1 ring-white/10">
          {list.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => { try { localStorage.setItem("traqi-church", c.id); } catch { /* storage unavailable */ } setOpen(false); reload(); }}
                className={cx("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px]", c.id === current ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/[.06]")}>
                <ChurchMark church={{ name: c.name, profile: { logo: c.logo, color: c.color } as never }} size={22} /> <span className="truncate">{c.name}</span>
                {c.id === current && <Check size={13} className="ml-auto" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
