import type { Group, GroupTag } from "./types";

type DeptTemplate = { key: string; name: string; purpose: string; tags?: GroupTag[]; units?: { name: string; purpose: string }[]; supervisor?: string };

/** The starter set for Pentecostal and charismatic churches, built from Heirs Church's structure. */
export const PENTECOSTAL: DeptTemplate[] = [
  { key: "training", name: "Faculty of Training", purpose: "Foundation school, discipleship and every training course", tags: ["training"] },
  { key: "children", name: "Children", purpose: "Children's church", tags: ["children"], supervisor: "training" },
  { key: "outreach", name: "Mission and Outreach / Follow-up", purpose: "Outreach and first-timer follow-up", tags: ["followup"] },
  { key: "membership", name: "Membership Ministry", purpose: "Settles new members and links them to the right department", tags: ["membership", "followup"] },
  { key: "media", name: "Media", purpose: "Everything media in the church", tags: ["media"], units: [
    { name: "Camera", purpose: "Videography and photography" },
    { name: "Projection", purpose: "Screens and slides during service" },
    { name: "Light", purpose: "Stage and auditorium lighting" },
    { name: "Online church and live streaming", purpose: "The online church and every live stream" },
    { name: "Content and social media", purpose: "Content, design and social media pages" },
  ] },
  { key: "choir", name: "Choir", purpose: "Worship and music" },
  { key: "technical", name: "Technical", purpose: "Sound" },
  { key: "welfare", name: "Welfare", purpose: "The welfare arm of the church", tags: ["welfare"] },
  { key: "ushering", name: "Ushering", purpose: "Ushers, headcounts and offering counts", tags: ["ushering"] },
  { key: "protocol", name: "Protocol", purpose: "Protocol duties" },
  { key: "setup", name: "Setup and Facility Management", purpose: "Setting up and caring for the venue" },
];

export function groupsFromTemplate(t: DeptTemplate[]): Group[] {
  const out: Group[] = [];
  for (const d of t) {
    const id = `g-${d.key}`;
    out.push({ id, name: d.name, kind: "department", purpose: d.purpose, tags: d.tags, leaderIds: [], memberIds: [], supervisorId: d.supervisor ? `g-${d.supervisor}` : undefined });
    d.units?.forEach((u, i) => out.push({ id: `${id}-u${i}`, name: u.name, kind: "unit", parentId: id, purpose: u.purpose, leaderIds: [], memberIds: [] }));
  }
  return out;
}

export const COUNTRIES: { name: string; currency: string; timeZone: string; dial: string }[] = [
  { name: "Nigeria", currency: "NGN", timeZone: "Africa/Lagos", dial: "234" },
  { name: "Ghana", currency: "GHS", timeZone: "Africa/Accra", dial: "233" },
  { name: "Kenya", currency: "KES", timeZone: "Africa/Nairobi", dial: "254" },
  { name: "South Africa", currency: "ZAR", timeZone: "Africa/Johannesburg", dial: "27" },
  { name: "Uganda", currency: "UGX", timeZone: "Africa/Kampala", dial: "256" },
  { name: "United Kingdom", currency: "GBP", timeZone: "Europe/London", dial: "44" },
  { name: "United States", currency: "USD", timeZone: "America/New_York", dial: "1" },
  { name: "Canada", currency: "CAD", timeZone: "America/Toronto", dial: "1" },
];

import type { MessageTemplate } from "./types";

/** Ready-written messages every new church starts with. {first_name}, {church_name}, {my_name}, {event_name}, {event_link}, {service_time} are filled in when sending. */
export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  { id: "t-welcome-1", category: "welcome", name: "Warm", isDefault: true, body: "Hello {first_name}! It was such a joy to have you at {church_name} on Sunday. Thank you for worshipping with us. We'd love to see you again this Sunday at {service_time}. God bless you! — {my_name}" },
  { id: "t-welcome-2", category: "welcome", name: "Short", body: "Hi {first_name}, thank you for visiting {church_name}! We're glad you came. See you Sunday? — {my_name}" },
  { id: "t-welcome-3", category: "welcome", name: "Formal", body: "Dear {first_name}, on behalf of the pastors and members of {church_name}, thank you for worshipping with us. If there's any way we can pray with you or help you settle in, please reply to this message. Warm regards, {my_name}." },
  { id: "t-returning-1", category: "returning", name: "Warm", isDefault: true, body: "Welcome back, {first_name}! It was lovely to see you again at {church_name}. Our Foundation School is a great next step. Would you like me to save you a seat? — {my_name}" },
  { id: "t-birthday-1", category: "birthday", name: "Blessing", isDefault: true, body: "Happy birthday, {first_name}! 🎉 Everyone at {church_name} celebrates you today. May this new year bring you joy, good health and God's favour in all you do. — {my_name}" },
  { id: "t-birthday-2", category: "birthday", name: "Short", body: "Happy birthday, {first_name}! Wishing you a blessed year ahead. — {my_name}, {church_name}" },
  { id: "t-birthday-3", category: "birthday", name: "Scripture", body: "Happy birthday, {first_name}! \"The Lord bless you and keep you; the Lord make His face shine on you.\" (Numbers 6:24–25). We love you at {church_name}. — {my_name}" },
  { id: "t-anniversary-1", category: "anniversary", name: "Warm", isDefault: true, body: "Happy wedding anniversary, {first_name}! 💐 Thank God for another year of love and grace in your home. Your {church_name} family celebrates with you. — {my_name}" },
  { id: "t-absence-1", category: "absence", name: "Gentle", isDefault: true, body: "Hi {first_name}, we've missed you at {church_name} these past few Sundays. I hope you're well. Is there anything we can pray about or help with? — {my_name}" },
  { id: "t-absence-2", category: "absence", name: "Short", body: "Hello {first_name}, just checking in. We miss you at church! Hope all is well. — {my_name}" },
  { id: "t-welfare-1", category: "welfare", name: "Update", isDefault: true, body: "Hello {first_name}, this is {my_name} from {church_name}. I'm reaching out about your request. Could we talk today? We're praying with you." },
  { id: "t-event-1", category: "event_invite", name: "Invitation", isDefault: true, body: "Hi {first_name}! You're invited to {event_name} at {church_name}. Register here: {event_link} — it would be great to have you there. — {my_name}" },
  { id: "t-event-2", category: "event_reminder", name: "Reminder", isDefault: true, body: "Reminder, {first_name}: {event_name} is coming up soon. Your ticket and details are here: {event_link}. See you there! — {church_name}" },
  { id: "t-class-1", category: "class_reminder", name: "Reminder", isDefault: true, body: "Hi {first_name}, your class at {church_name} is tomorrow. Looking forward to seeing you! — {my_name}" },
  { id: "t-thanks-1", category: "thanks", name: "Thank you", isDefault: true, body: "Thank you for coming, {first_name}! We hope you were blessed. See you again soon at {church_name}. — {my_name}" },
  { id: "t-general-1", category: "general", name: "Blank", isDefault: true, body: "Hello {first_name}, " },
];

export const TEMPLATE_LABEL: Record<MessageTemplate["category"], string> = {
  welcome: "First-timer welcome", returning: "Returning visitor", birthday: "Birthday", anniversary: "Wedding anniversary",
  absence: "We've missed you", welfare: "Welfare update", event_invite: "Event invitation", event_reminder: "Event reminder",
  class_reminder: "Class reminder", thanks: "Thank you", general: "General",
};
