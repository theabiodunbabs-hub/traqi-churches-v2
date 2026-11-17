import { Building2, CreditCard, FileText, History, Mail, Palette, Route, ShieldCheck } from "lucide-react";
import type { Access } from "./access";

/** Every settings page, in the order they appear on the one Settings page. */
export const settingsPages: { href: string; title: string; body: string; icon: typeof Mail; show: (a: Access) => boolean; feature?: "branches" }[] = [
  { href: "/settings/church", title: "Church profile", body: "Name, logo, colours, address and service times", icon: Palette, show: (a) => a.can("roles.manage") || a.isLead },
  { href: "/settings/journey", title: "Journey", body: "How people grow from first visit to leading", icon: Route, show: (a) => a.isPastoral || a.can("roles.manage") },
  { href: "/settings/roles", title: "Roles", body: "Who can do what, and where", icon: ShieldCheck, show: (a) => a.isPastoral || a.can("roles.manage") },
  { href: "/settings/templates", title: "Message templates", body: "Ready-made WhatsApp messages", icon: FileText, show: (a) => !a.isMemberOnly },
  { href: "/settings/email", title: "Email", body: "What Traqi emails, to whom and when", icon: Mail, show: (a) => a.isLead || a.can("roles.manage") },
  { href: "/settings/branches", title: "Branches", body: "Branches, regions and church size", icon: Building2, show: (a) => a.isPastoral || a.can("roles.manage"), feature: "branches" },
  { href: "/activity", title: "Activity log", body: "Every change anyone has made", icon: History, show: (a) => a.can("activity.view") },
  { href: "/settings/billing", title: "Plan", body: "Free during early access", icon: CreditCard, show: (a) => a.isLead },
];
