/** A stage key from the church's own journey, e.g. "first_timer", "member", "certified". */
export type Stage = string;

export type Person = {
  id: string;
  firstName: string;
  lastName: string;
  gender: "M" | "F";
  phone: string;
  whatsapp?: string;
  email?: string;
  birthday?: string; // YYYY-MM-DD
  location?: string;
  occupation?: string;
  stage: Stage;
  householdId?: string;
  isChild?: boolean;
  firstVisit: string; // YYYY-MM-DD
  lastSeen?: string; // YYYY-MM-DD
  missedInARow: number;
  /** True when we actually record this person's attendance (workers, and anyone who checks in). */
  tracked?: boolean;
  heardFrom?: string;
  consent?: { at: string; via: "welcome-form" | "update-link" | "staff" | "import" };
  photo?: string;
  inactive?: { reason: "moved" | "other church" | "deceased" | "other"; note?: string; at: string };
  isLeader?: boolean; // marked a leader by the pastorate (welfare routing)
  anniversary?: string; // wedding anniversary YYYY-MM-DD
  feedback?: Feedback[];
  /** Their own choices: announcements off, nudge email time. */
  prefs?: { noAnnouncements?: boolean; noNudgeEmail?: boolean; noReportEmails?: boolean; noEmails?: boolean };
  /** Answers to the church's extra fields, by field id. */
  custom?: Record<string, string>;
  /** People who joined through Traqi search are "not yet confirmed" until the admin confirms them. */
  joinedVia?: "search" | "invite" | "welcome" | "staff" | "import";
  confirmedAt?: string;
  /** An existing record with the same phone, for the admin to merge. Never shown to the person. */
  possibleMatchId?: string;
  /** Follow-up members can mark themselves away so nobody new is assigned to them. */
  unavailable?: boolean;
  /** A worker serving before finishing the class, or a new worker being observed. */
  probation?: { until: string; startedAt: string; groupId?: string; reason?: "new_worker" | "no_class"; notes?: { byId: string; text: string; at: string }[] };
  /** Finished the class for this stage; a leader still needs to confirm. */
  awaitingStage?: string;
  /** Branch this person belongs to, for churches with branches. */
  branchId?: string;
};

export type Church = {
  id?: string;
  /** Given by the Traqi owner after checking the church is real. */
  verified?: boolean;
  name: string; slug: string; currency: string; country: string; timeZone: string;
  attendanceGoal?: number; trialEndsAt: string; template: "pentecostal" | "blank";
  profile?: ChurchProfile;
};

export type Placement = { id: string; personId: string; groupId: string; note?: string; status: "open" | "accepted" | "declined"; at: string };

export type PendingContact = { personId: string; method: "call" | "whatsapp"; at: string };

export type Household = { id: string; name: string; address?: string };

export type Group = {
  id: string;
  name: string;
  kind: "department" | "unit";
  parentId?: string;
  supervisorId?: string; // another department supervising this one
  purpose: string;
  leaderIds: string[];
  memberIds: string[];
  overseerId?: string; // pastor
  tags?: GroupTag[];
  /** The department's own WhatsApp group. */
  whatsapp?: string;
  /** Assistants the head appoints, each with a title and what they may do. */
  assistants?: Assistant[];
  /** Optional: only people at this stage (or later) can join. */
  requiresStage?: string;
  /** Optional: only people who finished this class can join. */
  requiresClassId?: string;
  /** Follow-up only: assignment settings. */
  followup?: { auto: boolean; limit: number; sameGender: boolean };
  branchId?: string;
};

export type AssistantPerm = "people.edit" | "people.manage" | "rollcall" | "message" | "followup.assign" | "followup.reports";
export type Assistant = { personId: string; title: string; perms: AssistantPerm[] };

export type GroupTag = "followup" | "membership" | "training" | "ushering" | "media" | "welfare" | "children" | "family";

export type PermissionKey =
  | "people.view"
  | "people.edit"
  | "people.contacts"
  | "care.view"
  | "followup.assign"
  | "followup.log"
  | "groups.manage"
  | "attendance.record"
  | "checkin.code"
  | "finance.count"
  | "finance.approve"
  | "finance.transfers"
  | "finance.view"
  | "classes.manage"
  | "events.manage"
  | "messages.bulk"
  | "roles.manage"
  | "sheets.connect"
  | "activity.view"
  | "billing.manage";

export type RoleKey = "lead" | "pastor" | "admin" | "dept" | "followup" | "care" | "usher" | "media" | "worker" | "member" | "custom";

export type Role = {
  id: string;
  key: RoleKey;
  name: string;
  level: number;
  description: string;
  permissions: PermissionKey[];
  isDefault: boolean;
};

export type Scope = { type: "church" } | { type: "groups"; groupIds: string[] } | { type: "self" } | { type: "branch"; branchId: string } | { type: "region"; regionId: string };

export type RoleAssignment = {
  personId: string; roleId: string; scope: Scope;
  /** A temporary role ends on this date. */
  until?: string;
  /** Changes made by an admin wait for the pastor's approval. */
  pending?: { byId: string; at: string; action: "give" | "remove" };
};

export type FollowStage = "new" | "contacted" | "visited" | "returned" | "in_class" | "member" | "unreachable";

export type Contact = { at: string; byId: string; method: "call" | "whatsapp" | "visit"; outcome: string; reached?: boolean };

export type FollowCase = {
  id: string;
  personId: string;
  assigneeId?: string;
  stage: FollowStage;
  createdAt: string; // ISO
  contacts: Contact[];
};

export type CareNote = {
  id: string;
  personId: string;
  level: "care" | "confidential";
  body: string;
  authorId: string;
  at: string;
  sharedWith: string[];
};

export type Activity = { id: string; at: string; actorId: string; text: string };

export type ServiceWeek = { date: string; first: number; second: number; children: number; firstTimers: number };

// ---------- Added for v1 features (11 Nov 2026 design) ----------

export type Mode = "physical" | "virtual" | "hybrid";

/** A regular service in the church's weekly schedule, e.g. "1st service, Sundays 7:30 AM". */
export type ServiceSlot = { id: string; name: string; weekdays: number[]; start: string; end: string; kind: "sunday" | "midweek" | "prayer"; mode: Mode; checkin: boolean; link?: string };

/** One actual gathering on one date. */
export type Meeting = {
  id: string; name: string; kind: "sunday" | "midweek" | "prayer" | "special" | "class" | "event";
  date: string; start: string; end: string; // ISO date-times
  mode: Mode; venue?: string; link?: string;
  checkin: boolean; code?: string; slotId?: string; refId?: string; // class session or event id
};

export type Headcount = { meetingId: string; men: number; women: number; children: number; firstTimers: number; online?: number; byId: string; at: string };

export type AttendanceMethod = "qr" | "link" | "usher" | "family" | "rollcall" | "online" | "recording" | "ticket" | "welcome";
export type Attendance = { id: string; meetingId: string; personId: string; method: AttendanceMethod; status?: "present" | "late" | "absent" | "excused"; at: string };

export type Away = { id: string; personId: string; from: string; to: string; note?: string };

export type Feedback = { enjoyed: string[]; comment?: string; wantsVisit?: boolean; prayer?: string; meetingId?: string; at: string };

export type WelfareStage = "dept" | "welfare" | "pastorate" | "lead" | "approved" | "declined" | "delivering" | "given" | "closed";
export type WelfareMinute = { byId: string; role: string; text: string; suggested?: string; amount?: number; at: string };
export type WelfareRequest = {
  id: string; personId: string; raisedById: string; kind: string; details: string; urgent: boolean; private: boolean;
  route: ("dept" | "welfare" | "pastorate" | "lead")[]; deptGroupId?: string; stage: WelfareStage;
  minutes: WelfareMinute[]; decision?: { byId: string; approved: boolean; amount?: number; support?: string; reason?: string; at: string };
  involveWelfare?: boolean; assigneeId?: string; givenNote?: string; givenAt?: string; createdAt: string;
};

export type Programme = {
  id: string; name: string; description: string; modules: { id: string; title: string }[];
  run: "batch" | "rolling"; mode: Mode; venue?: string; link?: string; weekday: number; time: string; minutes: number;
  completeAfter: number; prerequisiteId?: string; recordingsCount: boolean; signatories: string[]; stageOnComplete?: Stage; startDate: string; color: number;
};
export type ClassSession = { id: string; programmeId: string; moduleId: string; date: string; start: string; venue?: string; link?: string; recording?: string; cancelled?: boolean; teacherId?: string };
export type Enrolment = { id: string; programmeId: string; personId: string; status: "active" | "completed"; enrolledAt: string; completedAt?: string; certNo?: string };

export type QuestionType = "text" | "long" | "choice" | "multi" | "yesno" | "number" | "date" | "phone" | "email";
export type EventQuestion = { id: string; label: string; type: QuestionType; options?: string[]; required?: boolean; help?: string; /** Ask once per person when registering others too */ perPerson?: boolean };

/** One day of an event, with its own times and optional sessions. */
export type EventDay = { date: string; start: string; end: string; title?: string; sessions?: EventSession[] };
export type EventSession = { id: string; start: string; end?: string; title: string; venueId?: string; personIds?: string[]; checkin?: boolean };
/** Speakers, music ministers, hosts, special guests, or the church's own labels. */
export type EventPerson = { id: string; name: string; label: string; photo?: string; bio?: string; from?: string };
export type EventVenue = { id: string; name: string; address?: string; directions?: string; mapUrl?: string; overflow?: boolean; note?: string };
export type EventTemplate = "flyer" | "bold" | "elegant";
export type RegType = "individual" | "group" | "online";
export type ChurchEvent = {
  id: string; slug: string; title: string;
  /** Kept for older events; the theme replaces it. */
  tagline: string;
  description: string; cover: number;
  start: string; end: string; days: string[]; mode: Mode; venue?: string; link?: string;
  speakers: { name: string; role: string }[]; schedule: { time: string; item: string }[];
  capacity?: number; closesAt?: string; groupReg: boolean; needsApproval: boolean; followup: boolean;
  questions: EventQuestion[]; status: "draft" | "pending" | "published"; createdById: string; approvedById?: string;
  coOrganisers: { groupId: string; status: "requested" | "approved" }[]; createdAt: string;
  // ---- Round 2 ----
  theme?: string;
  verse?: { text: string; ref: string };
  dayPlan?: EventDay[];
  flyer?: string;
  template?: EventTemplate;
  people?: EventPerson[];
  venues?: EventVenue[];
  regTypes?: RegType[];
  faq?: { q: string; a: string }[];
  gallery?: string[];
  partners?: { name: string; logo?: string }[];
  showPartners?: boolean;
  stay?: { name: string; note?: string; url?: string; phone?: string }[];
  give?: { label?: string; url?: string; bank?: string; account?: string; accountName?: string };
  contact?: { name?: string; phone?: string; whatsapp?: string; email?: string };
  sessionCheckin?: boolean;
  feedback?: { on: boolean; questions: EventQuestion[] };
  reminders?: { email: boolean; whatsapp: boolean; daysBefore: number[] };
  /** Branch hosting it, for churches with branches. */
  branchId?: string;
};
export type Registration = {
  id: string; eventId: string; personId?: string; name: string; phone: string; email?: string; guests: number;
  days: string[]; answers: Record<string, string>; ticket: string; status: "confirmed" | "waitlist" | "pending"; checkins: string[]; at: string;
  /** Individual, group or online. */
  type?: RegType;
  /** When someone registers others, each person gets their own registration and ticket; this points to the one who registered them. */
  byRegId?: string;
  /** Sessions this person checked into. */
  sessions?: string[];
  feedback?: { answers: Record<string, string>; at: string };
};

export type CountLine = { category: string; amount: number; currency: string };
export type ServiceCount = {
  id: string; meetingId: string; lines: CountLine[]; byId: string; witnessId?: string; at: string;
  correction?: { lines: CountLine[]; reason: string; byId: string; at: string; status: "pending" | "approved" | "declined" };
};
export type Lodgement = { id: string; countIds: string[]; amount: number; currency: string; method: "transfer" | "deposit" | "pos"; reference?: string; proof?: string; byId: string; date: string };
export type Transfer = { id: string; date: string; category: string; amount: number; reference?: string; byId: string };

export type TemplateCategory = "welcome" | "returning" | "birthday" | "anniversary" | "absence" | "welfare" | "event_invite" | "event_reminder" | "class_reminder" | "thanks" | "general";
export type MessageTemplate = { id: string; category: TemplateCategory; name: string; body: string; isDefault?: boolean; ownerId?: string };
export type Announcement = { id: string; title: string; body: string; audience: { type: "all" | "group" | "stage" | "programme" | "event"; id?: string }; channels: ("email" | "whatsapp" | "app")[]; byId: string; at: string; scheduledFor?: string };
export type Wish = { personId: string; kind: "birthday" | "anniversary"; year: number; byId: string; at: string };
export type Invite = { token: string; personId: string; roleId?: string; byId: string; at: string; usedAt?: string };
/** A prayer request. Only the people the lead pastor chose can read it; it's never downloaded. */
export type PrayerRequest = { id: string; personId: string; body: string; at: string; anonymous?: boolean; answered?: string; prayed: { byId: string; at: string }[] };
/** Every download is written down: who, what, when. */
export type DownloadLog = { id: string; byId: string; what: string; rows: number; at: string };
export type AppFeedback = { id: string; byId: string; screen: string; text: string; at: string };

export type ChurchProfile = {
  logo?: string; color?: string; email?: string; phone?: string; address?: string; welcome?: string;
  socials?: { instagram?: string; facebook?: string; youtube?: string; x?: string };
  liveStream?: string; services: ServiceSlot[]; approvalLimit: number; witness: boolean;
  categories: string[]; currencies: string[];
  /** Optional second colour; Traqi picks one when blank. */
  accent?: string;
  heading?: "modern" | "classic" | "bold";
  /** The church's own words for Traqi's terms, e.g. { firstTimer: "Guest" }. */
  terms?: Partial<Record<TermKey, string>>;
  /** Extra details the church records about people. */
  customFields?: CustomField[];
  /** How the church is set up. */
  level?: ChurchLevel;
  journey?: import("./journey").Journey;
  city?: string; state?: string;
  /** Written directions, e.g. "Opposite First Bank, white gate". */
  directions?: string;
  pin?: { lat: number; lng: number };
  buildingPhoto?: string;
  /** The church-wide WhatsApp community, and whether people not yet confirmed can see it. */
  whatsapp?: string; whatsappForUnconfirmed?: boolean;
  resources?: Resource[];
  /** A sermon the admin pins for everyone; otherwise the latest from the YouTube channel. */
  pinnedMessage?: { title: string; url: string; thumb?: string };
  /** People (besides pastors and Membership Ministry) who see prayer requests. */
  prayerViewers?: string[];
  /** For churches with branches: whether offerings are recorded per branch or at headquarters. */
  offeringsAt?: "branch" | "hq";
  regions?: { id: string; name: string; overseerId?: string }[];
  branches?: Branch[];
};

export type ChurchLevel = "close" | "growing" | "branches" | "network";
export type Resource = { id: string; title: string; url: string; kind: "youtube" | "telegram" | "drive" | "podcast" | "website" | "instagram" | "facebook" | "other" };
export type Branch = { id: string; name: string; slug: string; regionId?: string; pastorId?: string; address?: string; directions?: string; city?: string; logo?: string; services?: ServiceSlot[] };

export type TermKey = "firstTimer" | "firstTimers" | "followUp" | "department" | "departments" | "welfare" | "worker" | "workers" | "member" | "members";
export type CustomField = { id: string; label: string; type: "text" | "date" | "choice" | "yesno" | "number"; options?: string[]; onWelcome?: boolean; hidden?: boolean };
