/**
 * Demo data for attendance, welfare, classes, events, finance and messages.
 * Built from the core demo people so everything links up.
 */
import { defaultJourney } from "./journey";
import { DEFAULT_TEMPLATES } from "./templates";
import type {
  Announcement, Attendance, Away, ChurchEvent, ChurchProfile, ClassSession, Enrolment, FollowCase, Group, Headcount, Invite, Lodgement,
  Meeting, MessageTemplate, Person, Programme, Registration, ServiceCount, Transfer, WelfareRequest, Wish, AppFeedback, PrayerRequest, DownloadLog, Outreach, OutreachContact, Challenge, ChurchInvite, FundRequest, CounselRequest, EventNote, Rsvp } from "./types";

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Input = {
  people: Person[]; groups: Group[]; cases: FollowCase[];
  P: Record<"lead" | "resident" | "associate" | "admin" | "outreach" | "membership" | "training" | "media" | "usher" | "welfare" | "worker" | "member" | "choir" | "technical" | "bursar" | "protocol" | "family", Person>;
  dayISO: (d: number) => string; stampISO: (h: number) => string;
};

/** A date at a Lagos local time, as an ISO string. Lagos is UTC+1 all year. */
export const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+01:00`).toISOString();

export function lastSunday(from = new Date()) {
  const d = new Date(from.getTime() + 36e5); // Lagos time
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export function buildMore({ people, groups, P, cases, dayISO, stampISO }: Input) {
  const r = rng(1111);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  let n = 0;
  const id = (p: string) => `${p}${++n}`;

  const profile: ChurchProfile = {
    color: "#4f46e5",
    about: "A family of believers in Lagos, raising people who love God, love each other and serve the city.",
    welcome: "Welcome home. Whether it's your first Sunday or your five hundredth, there's a place for you at Heirs Church.",
    address: "14 Church Street, Ogba", city: "Ikeja", state: "Lagos",
    directions: "Off Ogba Road, opposite the filling station. Look for the white gate with the blue Heirs Church sign.",
    level: "growing", journey: defaultJourney("class_first"),
    whatsapp: "https://chat.whatsapp.com/heirs-community", whatsappForUnconfirmed: false,
    resources: [
      { id: "r1", title: "Sermons on YouTube", url: "https://youtube.com/@heirschurch", kind: "youtube" },
      { id: "r2", title: "Messages on Telegram", url: "https://t.me/heirschurch", kind: "telegram" },
      { id: "r3", title: "Foundation School notes", url: "https://drive.google.com/heirs-foundation", kind: "drive" },
    ],
    pinnedMessage: { title: "Walking in Purpose (Sunday service)", url: "https://youtube.com/watch?v=heirs-purpose" },
    socials: { instagram: "https://instagram.com/heirschurch", youtube: "https://youtube.com/@heirschurch" },
    liveStream: "https://youtube.com/@heirschurch/live",
    services: [
      { id: "s1", name: "1st service", weekdays: [0], start: "07:30", end: "09:30", kind: "sunday", mode: "hybrid", checkin: true },
      { id: "s2", name: "2nd service", weekdays: [0], start: "09:45", end: "12:00", kind: "sunday", mode: "hybrid", checkin: true },
      { id: "s3", name: "Midweek service", weekdays: [3], start: "18:00", end: "19:30", kind: "midweek", mode: "hybrid", checkin: false },
      { id: "s4", name: "Online prayer", weekdays: [1, 2, 3, 4, 5, 6], start: "07:00", end: "08:00", kind: "prayer", mode: "virtual", checkin: false, link: "https://meet.google.com/heirs-prayer" },
    ],
    approvalLimit: 100000, witness: false,
    categories: ["Offering", "Tithe", "Thanksgiving", "Seed"], currencies: ["NGN", "USD", "GBP"],
  };

  // ---------- Services, headcounts and check-ins: the last 8 Sundays ----------
  const meetings: Meeting[] = [];
  const headcounts: Headcount[] = [];
  const attendance: Attendance[] = [];
  const sun = lastSunday();
  const sundays = Array.from({ length: 8 }, (_, i) => addDays(sun, -7 * (7 - i)));
  const adults = people.filter((p) => !p.isChild && !p.inactive);
  const tracked = adults.filter((p) => p.tracked && p.stage !== "first_timer");

  sundays.forEach((date, wi) => {
    const weeksAgo = 7 - wi;
    [profile.services[0], profile.services[1]].forEach((slot, si) => {
      const m: Meeting = {
        id: `m-${date}-${slot.id}`, name: slot.name, kind: "sunday", date, start: at(date, slot.start), end: at(date, slot.end),
        mode: "hybrid", checkin: true, code: String(1000 + Math.floor(r() * 9000)), slotId: slot.id,
      };
      meetings.push(m);
      const base = si === 0 ? 112 + wi * 4 : 168 + wi * 5;
      const men = Math.round(base * 0.42 + r() * 8), women = Math.round(base * 0.58 + r() * 8);
      headcounts.push({ meetingId: m.id, men, women, children: si === 0 ? 0 : 36 + Math.round(r() * 8), firstTimers: 2 + Math.round(r() * 4), online: 40 + Math.round(r() * 30), byId: P.usher.id, at: m.end });
    });
    tracked.forEach((p, i) => {
      if (p.missedInARow && weeksAgo < p.missedInARow) return;
      if (!p.missedInARow && r() < 0.13) return;
      const slot = i % 3 === 0 ? "s1" : "s2";
      const mid = `m-${date}-${slot}`;
      attendance.push({ id: id("at"), meetingId: mid, personId: p.id, method: pick(["qr", "qr", "link", "usher", "family"] as const), at: at(date, slot === "s1" ? "07:52" : "10:04") });
    });
  });
  // Midweek services (headcount only)
  sundays.slice(-4).forEach((date) => {
    const w = addDays(date, 3);
    if (Date.parse(`${w}T19:30:00+01:00`) > Date.now()) return;
    const m: Meeting = { id: `m-${w}-s3`, name: "Midweek service", kind: "midweek", date: w, start: at(w, "18:00"), end: at(w, "19:30"), mode: "hybrid", checkin: false, slotId: "s3" };
    meetings.push(m);
    headcounts.push({ meetingId: m.id, men: 38 + Math.round(r() * 8), women: 56 + Math.round(r() * 10), children: 0, firstTimers: Math.round(r() * 2), online: 25 + Math.round(r() * 15), byId: P.usher.id, at: m.end });
  });
  // This coming Sunday, ready for check-in
  const next = addDays(sun, 7);
  profile.services.slice(0, 2).forEach((slot) => meetings.push({
    id: `m-${next}-${slot.id}`, name: slot.name, kind: "sunday", date: next, start: at(next, slot.start), end: at(next, slot.end),
    mode: "hybrid", checkin: true, code: slot.id === "s1" ? "4827" : "6153", slotId: slot.id,
  }));

  // ---------- Welfare requests ----------
  const choir = groups.find((g) => g.id === "g-choir")!;
  const welfareTeam = groups.find((g) => g.id === "g-welfare")!.memberIds.filter((x) => x !== P.welfare.id);
  const members = adults.filter((p) => p.stage === "member");
  const workerInChoir = people.find((p) => choir.memberIds.includes(p.id) && p.stage === "worker") ?? P.worker;
  const welfare: WelfareRequest[] = [
    { id: "w1", personId: members[3].id, raisedById: members[3].id, kind: "Rent", details: "Landlord has given notice for two months of unpaid rent after I lost my job in September.", urgent: false, private: false,
      route: ["welfare", "pastorate"], stage: "welfare", minutes: [], createdAt: stampISO(-30) },
    { id: "w2", personId: workerInChoir.id, raisedById: workerInChoir.id, kind: "School fees", details: "Help with my son's second-term school fees (₦85,000). I can contribute ₦25,000.", urgent: false, private: false,
      route: ["dept", "welfare", "pastorate"], deptGroupId: "g-choir", stage: "dept", minutes: [], createdAt: stampISO(-20) },
    { id: "w3", personId: members[7].id, raisedById: P.membership.id, kind: "Medical", details: "Surgery scheduled next week at LUTH. The family needs help with the hospital deposit.", urgent: true, private: false,
      route: ["welfare", "pastorate"], stage: "pastorate", createdAt: stampISO(-50),
      minutes: [{ byId: P.welfare.id, role: "Welfare head", text: "Visited the family on Monday. The need is genuine and urgent; the deposit is ₦250,000. Recommend we support with ₦150,000 and keep visiting.", suggested: "Money and visits", amount: 150000, at: stampISO(-26) }] },
    { id: "w4", personId: members[11].id, raisedById: members[11].id, kind: "Food", details: "Things have been very hard this month. Any help with foodstuff for my family of five.", urgent: false, private: false,
      route: ["welfare", "pastorate"], stage: "delivering", assigneeId: welfareTeam[0], involveWelfare: true, createdAt: stampISO(-140),
      minutes: [{ byId: P.welfare.id, role: "Welfare head", text: "Spoke with her. A food pack and ₦20,000 would help this month.", suggested: "Food pack and cash", amount: 20000, at: stampISO(-120) }],
      decision: { byId: P.resident.id, approved: true, amount: 20000, support: "Food pack and ₦20,000", at: stampISO(-96) } },
    { id: "w5", personId: members[15].id, raisedById: members[15].id, kind: "Bereavement", details: "My father passed away. Support for the burial in Ogun State.", urgent: false, private: false,
      route: ["welfare", "pastorate"], stage: "given", involveWelfare: true, assigneeId: welfareTeam[1] ?? welfareTeam[0], createdAt: stampISO(-400), givenAt: stampISO(-200), givenNote: "Delivered ₦50,000 and the welfare team attended the service of songs.",
      minutes: [{ byId: P.welfare.id, role: "Welfare head", text: "Genuine. Recommend ₦50,000 and attendance at the burial.", amount: 50000, at: stampISO(-380) }],
      decision: { byId: P.associate.id, approved: true, amount: 50000, support: "₦50,000 and presence at the burial", at: stampISO(-350) } },
    { id: "w6", personId: members[19].id, raisedById: members[19].id, kind: "Other", details: "A private family matter I'd like to discuss with the pastors.", urgent: false, private: true,
      route: ["welfare", "pastorate"], stage: "welfare", minutes: [], createdAt: stampISO(-8) },
    { id: "w7", personId: P.protocol.id, raisedById: P.protocol.id, kind: "Medical", details: "My wife's antenatal bills have been heavier than expected.", urgent: false, private: false,
      route: ["pastorate"], stage: "pastorate", minutes: [], createdAt: stampISO(-12) },
  ];

  // ---------- Classes ----------
  const programmes: Programme[] = [
    { id: "pr-foundation", name: "Foundation School", description: "Six classes that ground new believers and new members in the faith and in the life of Heirs Church.",
      modules: ["Salvation and the new birth", "The Holy Spirit", "Water baptism", "Prayer and the Word", "Giving and stewardship", "Belonging to Heirs Church"].map((t, i) => ({ id: `fm${i + 1}`, title: t })),
      run: "rolling", mode: "physical", venue: "Room B, main building", weekday: 0, time: "12:15", minutes: 60, completeAfter: 6, recordingsCount: true,
      signatories: ["Lead Pastor", "Head, Faculty of Training"], startDate: addDays(sun, -42), color: 0,
      signers: [{ name: `${P.lead.firstName} ${P.lead.lastName}`, title: "Lead Pastor", personId: P.lead.id }, { name: `${P.training.firstName} ${P.training.lastName}`, title: "Head, Faculty of Training", personId: P.training.id }] },
    { id: "pr-workers", name: "Workers' Training", description: "For members who want to serve in a department: service, character and excellence.",
      modules: ["The heart of a servant", "Excellence in service", "Working as a team", "Our church, our standards"].map((t, i) => ({ id: `wm${i + 1}`, title: t })),
      run: "batch", mode: "hybrid", venue: "Main auditorium", link: "https://zoom.us/j/heirs-workers", weekday: 6, time: "10:00", minutes: 90, completeAfter: 4, prerequisiteId: "pr-foundation",
      recordingsCount: true, signatories: ["Lead pastor", "Head, Faculty of Training"], startDate: addDays(sun, -15), color: 1 },
    { id: "pr-stewardship", name: "Stewardship Training", description: "Managing time, money and gifts as God's stewards.",
      modules: ["Stewardship of time", "Stewardship of money", "Stewardship of gifts"].map((t, i) => ({ id: `sm${i + 1}`, title: t })),
      run: "batch", mode: "virtual", link: "https://meet.google.com/heirs-stewardship", weekday: 4, time: "19:00", minutes: 60, completeAfter: 3,
      recordingsCount: true, signatories: ["Head, Faculty of Training"], startDate: addDays(sun, 11), color: 2 },
  ];
  const sessions: ClassSession[] = [];
  for (let w = -6; w <= 2; w++) {
    const d = addDays(sun, 7 * w);
    const mod = programmes[0].modules[((w % 6) + 6) % 6];
    sessions.push({ id: `cs-f-${w + 6}`, programmeId: "pr-foundation", moduleId: mod.id, date: d, start: at(d, "12:15"), venue: "Room B, main building", teacherId: P.training.id });
  }
  programmes[1].modules.forEach((mod, i) => {
    const d = addDays(sun, -15 + i * 7);
    sessions.push({ id: `cs-w-${i}`, programmeId: "pr-workers", moduleId: mod.id, date: d, start: at(d, "10:00"), venue: "Main auditorium", link: programmes[1].link,
      recording: Date.parse(at(d, "11:30")) < Date.now() ? "https://youtube.com/watch?v=heirs-workers-" + i : undefined, teacherId: P.training.id });
  });
  programmes[2].modules.forEach((mod, i) => {
    const d = addDays(sun, 11 + i * 7);
    sessions.push({ id: `cs-s-${i}`, programmeId: "pr-stewardship", moduleId: mod.id, date: d, start: at(d, "19:00"), link: programmes[2].link, teacherId: P.resident.id });
  });
  const enrolments: Enrolment[] = [];
  const classAttendance: Attendance[] = [];
  const disc = people.filter((p) => p.stage === "discipleship");
  const pastF = sessions.filter((s) => s.programmeId === "pr-foundation" && Date.parse(s.start) < Date.now());
  disc.forEach((p, i) => {
    enrolments.push({ id: id("en"), programmeId: "pr-foundation", personId: p.id, status: "active", enrolledAt: stampISO(-24 * (10 + i * 3)) });
    const attended = Math.min(pastF.length, 1 + (i % 6));
    pastF.slice(-attended).forEach((s) => classAttendance.push({ id: id("at"), meetingId: s.id, personId: p.id, method: "qr", at: s.start }));
  });
  members.slice(0, 5).forEach((p, i) => enrolments.push({ id: id("en"), programmeId: "pr-foundation", personId: p.id, status: "completed", enrolledAt: stampISO(-24 * 120), completedAt: stampISO(-24 * (40 + i)), certNo: `HC-FS-2026-0${41 + i}` }));
  const workers = adults.filter((p) => p.stage === "worker").slice(0, 9);
  const pastW = sessions.filter((s) => s.programmeId === "pr-workers" && Date.parse(s.start) < Date.now());
  workers.forEach((p, i) => {
    enrolments.push({ id: id("en"), programmeId: "pr-workers", personId: p.id, status: "active", enrolledAt: stampISO(-24 * 20) });
    pastW.forEach((s, j) => { if ((i + j) % 4 !== 0) classAttendance.push({ id: id("at"), meetingId: s.id, personId: p.id, method: j % 2 ? "online" : "qr", at: s.start }); });
    if (i === 2 && pastW[0]) classAttendance.push({ id: id("at"), meetingId: pastW[0].id, personId: p.id, method: "recording", at: addDays(pastW[0].date, 2) });
  });
  members.slice(5, 11).forEach((p) => enrolments.push({ id: id("en"), programmeId: "pr-stewardship", personId: p.id, status: "active", enrolledAt: stampISO(-24 * 3) }));

  // ---------- Family Life: marital status, couples, and the department's own courses ----------
  const grown = people.filter((p) => !p.isChild && !p.inactive && p.stage !== "first_timer");
  const men = grown.filter((p) => p.gender === "M" && !p.householdId), women = grown.filter((p) => p.gender === "F" && !p.householdId);
  // The households already in the demo are married couples
  people.filter((p) => !p.isChild && (p.householdId === "h1" || p.householdId === "h2")).forEach((p) => { p.custom = { ...(p.custom ?? {}), marital: "married" }; });
  // Six more married couples sharing a home and an anniversary
  for (let i = 0; i < 6 && men[i] && women[i]; i++) {
    const hid = `hf${i + 1}`, ann = `${2008 + i * 2}${dayISO(3 + i * 9).slice(4)}`;
    [men[i], women[i]].forEach((p) => { p.householdId = hid; p.anniversary = ann; p.custom = { ...(p.custom ?? {}), marital: "married" }; });
  }
  // Engaged couples taking the marriage course, a few widowed, and plenty of singles
  const engaged: [Person, Person][] = [[men[6], women[6]], [men[7], women[7]], [men[8], women[8]]].filter(([m, w]) => m && w) as [Person, Person][];
  engaged.flat().forEach((p) => { p.custom = { ...(p.custom ?? {}), marital: "other", maritalOther: "Engaged, wedding planned this year" }; });
  [women[9], men[9]].filter(Boolean).forEach((p) => { p.custom = { ...(p.custom ?? {}), marital: "other", maritalOther: "Widowed" }; });
  grown.forEach((p, i) => { if (!p.custom?.marital && i % 5 !== 4) p.custom = { ...(p.custom ?? {}), marital: p.anniversary ? "married" : "single" }; });
  const famHead = `${P.family.firstName} ${P.family.lastName}`;
  programmes.push(
    { id: "pr-marriage", name: "Marriage Preparation", description: "Premarital counselling for engaged couples: communication, money, intimacy, family and faith. Couples attend together and receive one certificate.",
      modules: ["God's design for marriage", "Communication and conflict", "Money and the home", "Families and in-laws", "Intimacy and purity", "Building a Christ-centred home"].map((t, i) => ({ id: `mm${i + 1}`, title: t })),
      run: "batch", mode: "physical", venue: "Family Life room", weekday: 6, time: "15:00", minutes: 90, completeAfter: 6, recordingsCount: false,
      signatories: ["Lead Pastor", "Head, Family Life"], startDate: addDays(sun, -20), color: 3, owner: "family", couples: true,
      signers: [{ name: `${P.lead.firstName} ${P.lead.lastName}`, title: "Lead Pastor", personId: P.lead.id }, { name: famHead, title: "Head, Family Life", personId: P.family.id }] },
    { id: "pr-parenting", name: "Parenting with Purpose", description: "Four evenings for parents: raising children in the faith, discipline with love, the teenage years and screens.",
      modules: ["Parenting God's way", "Discipline with love", "The teenage years", "Screens, friends and safety"].map((t, i) => ({ id: `pp${i + 1}`, title: t })),
      run: "batch", mode: "hybrid", venue: "Family Life room", link: "https://meet.google.com/heirs-parenting", weekday: 3, time: "19:00", minutes: 75, completeAfter: 3, recordingsCount: true,
      signatories: ["Head, Family Life"], startDate: addDays(sun, 10), color: 2, owner: "family" },
  );
  programmes.at(-2)!.modules.forEach((mod, i) => {
    const d = addDays(sun, -20 + i * 7);
    sessions.push({ id: `cs-m-${i}`, programmeId: "pr-marriage", moduleId: mod.id, date: d, start: at(d, "15:00"), venue: "Family Life room", teacherId: P.family.id });
  });
  programmes.at(-1)!.modules.forEach((mod, i) => {
    const d = addDays(sun, 10 + i * 7);
    sessions.push({ id: `cs-p-${i}`, programmeId: "pr-parenting", moduleId: mod.id, date: d, start: at(d, "19:00"), venue: "Family Life room", link: "https://meet.google.com/heirs-parenting", teacherId: P.family.id });
  });
  const pastM = sessions.filter((s) => s.programmeId === "pr-marriage" && Date.parse(s.start) < Date.now());
  engaged.forEach(([m, w], i) => [m, w].forEach((p, k) => {
    enrolments.push({ id: id("en"), programmeId: "pr-marriage", personId: p.id, partnerId: (k ? m : w).id, status: "active", enrolledAt: stampISO(-24 * 25) });
    pastM.forEach((s, j) => { if ((i + j) % 4 !== 3) classAttendance.push({ id: id("at"), meetingId: s.id, personId: p.id, method: "qr", at: s.start }); });
  }));
  // Last year's couples finished and received their certificate
  [[men[10], women[10]], [men[11], women[11]]].filter(([m, w]) => m && w).forEach(([m, w], i) => [m, w].forEach((p, k) => enrolments.push({ id: id("en"), programmeId: "pr-marriage", personId: p.id, partnerId: (k ? m : w).id,
    status: "completed", enrolledAt: stampISO(-24 * 300), completedAt: stampISO(-24 * (200 + i)), certNo: `HC-MP-2026-0${12 + i}` })));
  grown.filter((p) => p.householdId?.startsWith("hf")).slice(0, 6).forEach((p) => enrolments.push({ id: id("en"), programmeId: "pr-parenting", personId: p.id, status: "active", enrolledAt: stampISO(-24 * 2) }));

  // ---------- Events ----------
  const yc = addDays(sun, 26);
  const events: ChurchEvent[] = [
    { id: "ev-youth", slug: "rise-2026", title: "Rise: Youth Conference 2026", tagline: "Three days of worship, the Word and fire for a new generation.", cover: 0,
      theme: "Arise and Shine", verse: { text: "Arise, shine; for your light has come! And the glory of the Lord is risen upon you.", ref: "Isaiah 60:1" },
      template: "bold",
      // Round 8: the new page sections, ticket types, accommodation link and check-in at the venue
      page: {
        colors: { bg: "#120d2e", section: "#1d1648", button: "#f5b544", icon: "#a78bfa" },
        experience: [{ title: "Worship that lifts you", body: "Three nights of the presence of God, with the Heirs choir and friends." }, { title: "Teaching you can use", body: "Purpose, career and relationships: real talk for real life." }, { title: "Friends for the journey", body: "Meet young people who will pray with you long after Rise." }],
        testimonials: [{ quote: "I came for my friend and left with a purpose. Rise changed my year.", name: "Tobi A.", role: "Rise 2025" }, { quote: "The prayer night was the best part. I'm bringing my whole class this time.", name: "Chioma E.", role: "Rise 2025" }],
        invite: { title: "Arise and shine with us", body: "Three days. One generation. Bring a friend and come expecting." },
      },
      categories: [{ id: "tc-delegate", name: "Delegate", live: true }, { id: "tc-volunteer", name: "Volunteer", color: "#34d399", limit: 60, live: true }, { id: "tc-minister", name: "Minister", color: "#f472b6", private: true, token: "ministers26", live: true }],
      accommodationUrl: "https://heirschurch.org/rise/stay",
      venueCheckin: { on: true, printed: true, screen: true, secret: "rise2026demosecret" },
      description: "Rise is our yearly gathering for young people: powerful worship, practical teaching on purpose, career and relationships, and time to pray together. Bring a friend!",
      start: at(yc, "10:00"), end: at(addDays(yc, 2), "16:00"), days: [yc, addDays(yc, 1), addDays(yc, 2)], mode: "hybrid", venue: "Heirs Church main auditorium, Lagos", link: "https://youtube.com/@heirschurch/live",
      dayPlan: [
        { date: yc, start: "17:00", end: "21:00", title: "Opening night", sessions: [
          { id: "s1", start: "17:00", end: "18:00", title: "Praise and worship", personIds: ["pp3"] },
          { id: "s2", start: "18:00", end: "19:30", title: "Opening message: Arise", personIds: ["pp1"] },
          { id: "s3", start: "19:30", end: "21:00", title: "Night of prayer", personIds: ["pp1", "pp3"] },
        ] },
        { date: addDays(yc, 1), start: "10:00", end: "16:00", title: "Purpose and career", sessions: [
          { id: "s4", start: "10:00", end: "11:00", title: "Worship" },
          { id: "s5", start: "11:00", end: "12:30", title: "Finding your purpose", personIds: ["pp2"] },
          { id: "s6", start: "13:30", end: "15:00", title: "Workshops: career, tech, business", venueId: "v2" },
          { id: "s7", start: "15:00", end: "16:00", title: "Panel: faith at work", personIds: ["pp2", "pp4"] },
        ] },
        { date: addDays(yc, 2), start: "10:00", end: "14:00", title: "Shine", sessions: [
          { id: "s8", start: "10:00", end: "11:30", title: "Worship and the Word", personIds: ["pp1", "pp3"] },
          { id: "s9", start: "11:30", end: "14:00", title: "Commissioning and celebration" },
        ] },
      ],
      people: [
        { id: "pp1", name: "Pastor Samuel Kayode", label: "Speaker", bio: "Associate pastor at Heirs Church and convener of Rise. Passionate about raising young people who carry God's presence into every field.", from: "Heirs Church" },
        { id: "pp2", name: "Abiodun Babatunde", label: "Speaker", bio: "Head of the Faculty of Training, coach and author on purpose and careers.", from: "BABS with the BABS" },
        { id: "pp3", name: "Edify Worship", label: "Music minister", bio: "The Heirs Church choir, leading worship across all three days." },
        { id: "pp4", name: "Tolu Adeyemi", label: "Special guest", bio: "Founder of a Lagos fintech start-up, on building with integrity.", from: "Lagos" },
        { id: "pp5", name: "Kayode Oluwanifemi", label: "Host" },
      ],
      venues: [
        { id: "v1", name: "Main auditorium", address: "14 Church Street, Ogba, Ikeja, Lagos", directions: "Enter through Gate B on Church Street. Parking in the school field opposite.", mapUrl: "https://maps.google.com/?q=Ogba+Ikeja+Lagos" },
        { id: "v2", name: "Youth hall (workshops)", address: "Same compound, behind the main auditorium", overflow: false },
        { id: "v3", name: "Overflow: church car park tent", note: "With a big screen when the auditorium is full", overflow: true },
      ],
      regTypes: ["individual", "group", "online"],
      faq: [
        { q: "Is Rise free?", a: "Yes. Registration is free, and lunch is provided on Saturday." },
        { q: "Who can come?", a: "Rise is for young people from 13 to 35, from any church. Parents are welcome on the opening night." },
        { q: "Can I register my friends?", a: "Yes. Choose Group when you register and add each friend. Everyone gets their own ticket." },
        { q: "Will it be streamed?", a: "Yes, on our YouTube channel. Register as Online to get the link and reminders." },
      ],
      stay: [{ name: "Ikeja guest houses near the church", note: "Ask guest services for a list of nearby options" }],
      give: { label: "Support Rise", bank: "Zenith Bank", account: "1012345678", accountName: "Heirs Church Youth" },
      contact: { name: "Rise guest services", phone: "+234 803 555 0142", whatsapp: "+234 803 555 0142", email: "rise@heirschurch.org" },
      sessionCheckin: true, feedback: { on: true, questions: [{ id: "f1", label: "How would you rate Rise this year?", type: "choice", options: ["Excellent", "Good", "Okay", "Poor"] }, { id: "f2", label: "What blessed you most?", type: "long" }] },
      reminders: { email: true, whatsapp: true, daysBefore: [7, 1] },
      speakers: [{ name: "Pastor Samuel Kayode", role: "Associate pastor" }, { name: "Abiodun Babatunde", role: "Head, Faculty of Training" }, { name: "Edify Worship", role: "Worship" }],
      schedule: [{ time: "10:00 AM", item: "Worship" }, { time: "11:00 AM", item: "Main session" }, { time: "1:00 PM", item: "Lunch and connect" }, { time: "2:00 PM", item: "Workshops" }],
      capacity: 400, closesAt: at(addDays(yc, -1), "23:59"), groupReg: true, needsApproval: false, followup: true,
      questions: [{ id: "q1", label: "T-shirt size", type: "choice", options: ["S", "M", "L", "XL", "XXL"], perPerson: true, display: "dropdown" }, { id: "q2", label: "Do you need accommodation?", type: "yesno" }, { id: "q3", label: "School or workplace", type: "text" },
        { id: "gender", label: "Gender", type: "choice", options: ["Male", "Female"], perPerson: true }, { id: "location", label: "Where are you coming from?", type: "text", help: "Your area or city" }],
      goals: "Gather 500 young people for three days, see first-timers connected to a department, and launch the campus fellowship.",
      objectives: ["500 registrations, at least 150 from outside the church", "Every first-timer called within 48 hours", "30 young people signed up to serve"],
      targetBudget: 2500000, regTarget: 500, ticketPrefix: "RI26",
      status: "published", createdById: P.media.id, approvedById: P.associate.id, coOrganisers: [{ groupId: "g-protocol", status: "approved" }, { groupId: "g-ushering", status: "requested" }], createdAt: stampISO(-24 * 20) },
    { id: "ev-carol", slug: "carol-night-2026", title: "Carols by Candlelight", tagline: "An evening of carols, candles and the Christmas story.", cover: 2,
      theme: "Emmanuel: God with us", verse: { text: "For unto us a Child is born, unto us a Son is given.", ref: "Isaiah 9:6" }, template: "elegant",
      description: "Bring your family and friends for our Christmas carol service, with Edify Worship and a special children's nativity.",
      start: at(addDays(sun, 41), "17:00"), end: at(addDays(sun, 41), "20:00"), days: [addDays(sun, 41)], mode: "physical", venue: "Heirs Church main auditorium, Lagos",
      dayPlan: [{ date: addDays(sun, 41), start: "17:00", end: "20:00", sessions: [{ id: "c1", start: "17:00", title: "Carols and candles" }, { id: "c2", start: "18:30", title: "The nativity, by the children" }, { id: "c3", start: "19:15", title: "The Christmas message", personIds: ["cp1"] }] }],
      people: [{ id: "cp1", name: "Pastor Femi Oyelaran", label: "Minister", bio: "Lead pastor, Heirs Church" }, { id: "cp2", name: "Edify Worship", label: "Music minister" }],
      speakers: [{ name: "Edify Worship", role: "Choir" }], schedule: [{ time: "5:00 PM", item: "Carols" }, { time: "6:30 PM", item: "Nativity and the Christmas message" }],
      groupReg: true, needsApproval: false, followup: true, questions: [], status: "pending", createdById: P.media.id, coOrganisers: [], createdAt: stampISO(-30) },
    { id: "ev-couples", slug: "couples-dinner-2027", title: "Couples' Dinner 2027", tagline: "A night out for married couples.", cover: 1,
      theme: "Two are better than one", verse: { text: "Two are better than one, because they have a good reward for their labour.", ref: "Ecclesiastes 4:9" }, template: "flyer",
      description: "Dinner, laughter and a short talk on building a home that lasts.", start: at(addDays(sun, 96), "18:00"), end: at(addDays(sun, 96), "21:30"), days: [addDays(sun, 96)],
      mode: "physical", venue: "To be confirmed", speakers: [{ name: "Omotayo Babatunde", role: "Head, Family Life" }], schedule: [],
      people: [{ id: "fp1", name: "Omotayo Babatunde", label: "Speaker", bio: "Family counsellor and head of Family Life" }],
      capacity: 60, groupReg: true, needsApproval: true, followup: false, questions: [{ id: "q1", label: "Spouse's name", type: "text", required: true }],
      status: "draft", createdById: P.family.id, coOrganisers: [], createdAt: stampISO(-5) },
  ];
  const registrations: Registration[] = [];
  const guestsOut = ["Kelechi Umeh", "Shola Bankole", "Grace Effiong", "Ahmed Yusuf", "Tomi Ojo", "Ebun Ade", "Chika Obi", "Feranmi Lawson"];
  adults.slice(20, 78).forEach((p, i) => {
    const days = i % 5 === 0 ? [events[0].days[0]] : i % 3 === 0 ? events[0].days.slice(0, 2) : events[0].days;
    registrations.push({ id: id("rg"), eventId: "ev-youth", personId: p.id, name: `${p.firstName} ${p.lastName}`, phone: p.phone, email: p.email, guests: 0, type: i % 7 === 0 ? "online" : "individual",
      days, answers: { q1: pick(["M", "L", "XL", "M", "S"]), q2: i % 6 === 0 ? "Yes" : "No", q3: pick(["UNILAG", "YabaTech", "LASU", "Self-employed", "Access Bank", ""]), gender: p.gender === "M" ? "Male" : "Female", location: pick(["Ikeja", "Ogba", "Yaba", "Surulere", "Ikorodu", "Lekki", "Ikeja", "Ogba"]) },
      ticket: `RI26-${String(i + 1).padStart(5, "0")}`, status: "confirmed", checkins: [], at: stampISO(-24 * (18 - (i % 15))) });
  });
  guestsOut.forEach((name, i) => registrations.push({ id: id("rg"), eventId: "ev-youth", name, phone: `+234 81${i} 555 ${String(1000 + i * 111).slice(0, 4)}`, guests: 0, days: events[0].days,
    answers: { q1: "L", q2: i % 3 === 0 ? "Yes" : "No", q3: "", gender: i % 2 ? "Female" : "Male", location: ["Ibadan", "Abeokuta", "Yaba", "Ikeja"][i % 4] }, ticket: `RI26-${String(59 + i).padStart(5, "0")}`, email: i % 2 ? undefined : `${name.split(" ")[0].toLowerCase()}@example.com`, status: "confirmed", checkins: [], at: stampISO(-24 * (6 - (i % 5))) }));

  // ---------- Finance ----------
  const counts: ServiceCount[] = [];
  const lodgements: Lodgement[] = [];
  const transfers: Transfer[] = [];
  meetings.filter((m) => m.kind === "sunday" && Date.parse(m.end) < Date.now()).forEach((m, i) => {
    const big = m.slotId === "s2" ? 1.5 : 1;
    const lines = [
      { category: "Offering", amount: Math.round((180000 + r() * 60000) * big / 500) * 500, currency: "NGN" },
      { category: "Tithe", amount: Math.round((240000 + r() * 90000) * big / 500) * 500, currency: "NGN" },
      { category: "Thanksgiving", amount: Math.round((40000 + r() * 50000) * big / 500) * 500, currency: "NGN" },
      { category: "Seed", amount: Math.round((15000 + r() * 30000) * big / 500) * 500, currency: "NGN" },
    ];
    if (i % 5 === 3) lines.push({ category: "Offering", amount: 50, currency: "USD" });
    const c: ServiceCount = { id: `cnt-${m.id}`, meetingId: m.id, lines, byId: P.usher.id, at: m.end };
    counts.push(c);
    const total = lines.filter((l) => l.currency === "NGN").reduce((a, b) => a + b.amount, 0);
    if (m.date !== sun) lodgements.push({ id: `ld-${m.id}`, countIds: [c.id], amount: i === 5 ? total - 5000 : total, currency: "NGN", method: i % 4 === 0 ? "deposit" : "transfer",
      reference: `TRF${(4471200 + i * 913).toString()}`, byId: P.usher.id, date: addDays(m.date, 1) });
  });
  const lastSecond = counts.find((c) => c.meetingId === `m-${sun}-s2`);
  if (lastSecond) lastSecond.correction = { lines: lastSecond.lines.map((l) => (l.category === "Thanksgiving" ? { ...l, amount: l.amount + 12000 } : l)), reason: "An envelope with ₦12,000 for thanksgiving was found in the counting room after we submitted.", byId: P.usher.id, at: stampISO(-40), status: "pending" };
  sundays.forEach((d, i) => {
    transfers.push({ id: id("tr"), date: d, category: "Tithe", amount: Math.round((310000 + r() * 120000) / 1000) * 1000, reference: `NIP/${d}/T`, byId: P.lead.id });
    transfers.push({ id: id("tr"), date: d, category: "Offering", amount: Math.round((60000 + r() * 40000) / 1000) * 1000, reference: `NIP/${d}/O`, byId: P.lead.id });
    if (i % 3 === 0) transfers.push({ id: id("tr"), date: d, category: "Seed", amount: 100000, reference: `NIP/${d}/S`, byId: P.lead.id });
  });

  // ---------- Messages ----------
  const templates: MessageTemplate[] = DEFAULT_TEMPLATES.map((t) => ({ ...t }));
  const announcements: Announcement[] = [
    { id: "an1", title: "Rise 2026 registration is open", body: "Registration for Rise: Youth Conference 2026 is now open. Register early, as spaces are limited!", audience: { type: "all" }, channels: ["email", "app"], byId: P.associate.id, at: stampISO(-24 * 14) },
    { id: "an2", title: "Workers' meeting this Saturday", body: "All workers: our monthly workers' meeting holds this Saturday at 10:00 AM in the main auditorium.", audience: { type: "stage", id: "worker" }, channels: ["email", "whatsapp", "app"], byId: P.admin.id, at: stampISO(-24 * 4) },
  ];
  const wishes: Wish[] = [];
  const invites: Invite[] = [{ token: "demo-invite-segun", personId: P.resident.id, byId: P.admin.id, at: stampISO(-48) }];
  const away: Away[] = [{ id: "aw1", personId: members[2].id, from: dayISO(-10), to: dayISO(12), note: "Travelling to the UK for work" }];
  const prayers: PrayerRequest[] = [
    { id: "pry1", personId: P.member.id, body: "Please pray for my mother's surgery next week, that it goes well and she recovers quickly.", at: stampISO(-30), prayed: [{ byId: P.lead.id, at: stampISO(-20) }] },
    { id: "pry2", personId: members[5].id, body: "Praying for a new job. My contract ends this month.", at: stampISO(-8), prayed: [] },
    { id: "pry3", personId: members[9].id, body: "Thanksgiving and prayer for our new baby, and for strength for my wife.", at: stampISO(-50), prayed: [{ byId: P.membership.id, at: stampISO(-44) }, { byId: P.resident.id, at: stampISO(-40) }] },
  ];
  const downloads: DownloadLog[] = [];
  // An outreach last Saturday, and people members met on their own
  const outreaches: Outreach[] = [{ id: "or1", name: "Ojota Market Evangelism", date: dayISO(-4), area: "Ojota", createdById: P.outreach.id, at: stampISO(-8 * 24) }];
  const met = [["Chukwuemeka Obi", "0803 555 0101", "Ojota"], ["Halimat Yusuf", "0805 555 0102", "Ojota"], ["Tunde Adebayo", "0807 555 0103", "Ketu"], ["Grace Nwosu", "0809 555 0104", "Ojota"], ["Bayo Ogun", "0802 555 0105", "Mile 12"]];
  const outreachContacts: OutreachContact[] = [
    ...met.map(([name, phone, area], i): OutreachContact => ({ id: `oc${i + 1}`, name, phone, area, outreachId: "or1", byId: [P.outreach.id, P.worker.id, P.membership.id][i % 3], at: stampISO(-4 * 24 + i), consent: true,
      status: i < 2 ? "reached" : "new", assigneeId: i < 3 ? [P.worker.id, P.membership.id, P.worker.id][i] : undefined, note: i === 0 ? "Prayed with him at the bus stop. Wants to visit with his wife." : undefined,
      contacts: i < 2 ? [{ at: stampISO(-3 * 24), byId: P.worker.id, outcome: "Called. Happy to come on Sunday." }] : [] })),
    { id: "oc6", name: "Ifeoma Eze", phone: "0806 555 0106", area: "Yaba", byId: P.member.id, at: stampISO(-30), consent: true, status: "new", note: "My colleague at work. Asked about our youth programme." },
  ];
  // The youth conference has a planning committee and two department budgets waiting on it
  const yev = events.find((e) => e.id === "ev-youth");
  if (yev) yev.committee = {
    members: [{ personId: P.outreach.id, role: "Committee head" }, { personId: P.media.id, role: "Publicity and live stream", perms: ["landing"] }, { personId: P.protocol.id, role: "Guest ministers" },
      { personId: P.usher.id, role: "Seating and crowd", duties: "Seating plan, overflow tent, crowd control at the gates" }, { personId: P.choir.id, role: "Music" },
      { personId: P.bursar.id, role: "Finance Lead", perms: ["budget"], addedById: P.outreach.id, addedAt: stampISO(-40) }],
    headId: P.outreach.id, assistantId: P.media.id, financeLeadId: P.bursar.id,
    meetings: [{ id: "cmt1", date: dayISO(3), time: "18:30", mode: "virtual", link: "https://meet.google.com/rise-planning", agenda: "Budget sign-off, guest ministers' travel, registration push", byId: P.outreach.id, at: stampISO(-24) },
      { id: "cmt0", date: dayISO(-11), time: "13:00", mode: "physical", venue: "Youth hall, after second service", byId: P.outreach.id, at: stampISO(-24 * 14) }],
    messages: [{ id: "cm1", byId: P.lead.id, at: stampISO(-50), to: "heads", text: "Please keep the budget lean this year. Let's prioritise the sound and the guest ministers' hospitality." },
      { id: "cm2", byId: P.outreach.id, at: stampISO(-30), to: "all", text: "Each department should send its budget here by Friday. Meeting after second service on Sunday." }],
  };
  // Media and follow-up check people in; follow-up calls registrants who are new
  if (yev) {
    yev.duties = { checkin: { groupIds: ["g-media"], personIds: [P.worker.id] }, followup: { groupIds: ["g-outreach"], personIds: [] }, registration: { groupIds: [], personIds: [P.membership.id] } };
    yev.regLeadId = P.membership.id; yev.regLeadAdds = true;
  }
  const eventNotes: EventNote[] = [
    { id: "en1", eventId: "ev-youth", byId: P.usher.id, at: stampISO(-30), kind: "suggestion", text: "Let's open Gate C on Saturday so the workshop crowd doesn't block the main entrance.", status: "adopted",
      reply: { byId: P.outreach.id, at: stampISO(-26), text: "Agreed. Ushering will staff Gate C from 9:30." } },
    { id: "en2", eventId: "ev-youth", byId: P.choir.id, at: stampISO(-8), kind: "thought", text: "A short worship rehearsal with the guest band on Thursday evening would help a lot." },
  ];
  const rsvps: Rsvp[] = [];
  // Family Life: the Couples' Dinner is theirs, with a small committee, and the department meets monthly
  const fam = groups.find((g) => g.id === "g-family");
  const famTeam = (fam?.memberIds ?? []).filter((x) => x !== P.family.id).slice(0, 3);
  const cev = events.find((e) => e.id === "ev-couples");
  if (cev) {
    cev.goals = "A warm, unhurried evening that strengthens marriages and draws in couples who don't yet attend.";
    cev.objectives = ["60 couples, with at least 10 visiting couples", "Every couple leaves with the Marriage Enrichment dates"];
    cev.targetBudget = 900000; cev.regTarget = 60;
    cev.questions = [...cev.questions, { id: "gender", label: "Gender", type: "choice", options: ["Male", "Female"], perPerson: true }, { id: "diet", label: "Any food needs or allergies?", type: "text", perPerson: true }];
    cev.committee = {
      members: [{ personId: P.family.id, role: "Committee head" }, ...famTeam.map((personId, i) => ({ personId, role: ["Hospitality and menu", "Decor and seating", "Programme and music"][i], perms: i === 0 ? ["budget" as const] : undefined, addedById: P.lead.id, addedAt: stampISO(-24 * 4) }))],
      headId: P.family.id, assistantId: famTeam[0], financeLeadId: famTeam[0],
      meetings: [{ id: "cmc1", date: dayISO(6), time: "19:30", mode: "virtual", link: "https://meet.google.com/couples-dinner", agenda: "Venue options, menu tasting, ticket price", byId: P.family.id, at: stampISO(-6) }],
      messages: [{ id: "cmc-m1", byId: P.resident.id, at: stampISO(-24 * 3), to: "heads", text: "Let's keep it affordable so young couples can come. Please confirm a venue before you publish." }],
    };
  }
  if (fam) {
    const famMeetDate = (() => { const d = new Date(`${dayISO(0)}T12:00:00Z`); while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
    fam.meetings = [{ id: "dm-fam1", title: "Family Life team meeting", kind: "regular", weekday: 6, every: "month", time: "16:00", mode: "hybrid", venue: "Family Life room", link: "https://meet.google.com/family-life-team",
      notes: "Plan the Couples' Dinner and the next Marriage Preparation class.", updatedAt: stampISO(-20), byId: P.family.id }];
    famTeam.slice(0, 2).forEach((pid, i) => rsvps.push({ id: `dept|dm-fam1|${famMeetDate}|${pid}`, personId: pid, kind: "dept", refId: fam.id, meetingId: "dm-fam1", date: famMeetDate, answer: i ? "no" : "yes", at: stampISO(-10) }));
  }
  // Sermon platforms for "Listen to messages"
  profile.sermonLinks = [{ platform: "YouTube", url: "https://youtube.com/@heirschurch" }, { platform: "Spotify", url: "https://open.spotify.com/show/heirschurch" }, { platform: "Mixlr", url: "https://heirschurch.mixlr.com" }];
  // Fund requests at every step: waiting on finance, waiting on the pastor, paid and awaiting a report, returned, and closed
  const fl = (id: string, item: string, qty: number, unit: number, groupId?: string) => ({ id, item, qty, unit, groupId });
  const h = (hrs: number, byId: string, action: string, note?: string) => ({ at: stampISO(hrs), byId, action, note });
  const funds: FundRequest[] = [
    { id: "fr1", byId: P.media.id, at: stampISO(-30), title: "Two wireless microphones", purpose: "The pulpit mics keep cutting out during the sermon.", groupId: "g-media", category: "Equipment",
      lines: [fl("l1", "Shure BLX24 wireless mic", 2, 285000), fl("l2", "Rechargeable batteries (pack of 8)", 1, 18500)], neededBy: dayISO(10), stage: "finance", history: [h(-30, P.media.id, "Sent")], payments: [] },
    { id: "fr2", byId: P.outreach.id, at: stampISO(-75), title: "Hospital outreach supplies", purpose: "Gift packs for patients at LASUTH on the 2nd Saturday.", groupId: "g-outreach", category: "Outreach",
      lines: [fl("l1", "Gift packs (toiletries, biscuits, drinks)", 120, 3500), fl("l2", "Bus hire", 1, 45000), fl("l3", "Tracts and flyers", 500, 60)], timeline: "Before the second Saturday of the month", stage: "pastor",
      history: [h(-75, P.outreach.id, "Sent"), h(-50, P.bursar.id, "Reviewed by finance and sent to the pastor", "Figures checked. We have the money in the outreach budget.")], payments: [] },
    { id: "fr3", byId: P.choir.id, at: stampISO(-24 * 9), title: "Choir robes repair", purpose: "Mending and dry cleaning 30 robes before the carol service.", groupId: "g-choir", category: "Maintenance",
      lines: [fl("l1", "Tailoring per robe", 30, 2500), fl("l2", "Dry cleaning per robe", 30, 1500)], neededBy: dayISO(-2), stage: "paid",
      history: [h(-24 * 9, P.choir.id, "Sent"), h(-24 * 8, P.bursar.id, "Sent to the pastor"), h(-24 * 7, P.lead.id, "Approved"), h(-24 * 6, P.bursar.id, "Paid ₦70,000 (part payment)"), h(-24 * 3, P.bursar.id, "Paid ₦50,000")],
      payments: [{ id: "py1", at: stampISO(-24 * 6), byId: P.bursar.id, amount: 70000, note: "Part payment" }, { id: "py2", at: stampISO(-24 * 3), byId: P.bursar.id, amount: 50000 }] },
    { id: "fr4", byId: P.technical.id, at: stampISO(-24 * 4), title: "Generator servicing", purpose: "Quarterly service and two new filters.", groupId: "g-technical", category: "Maintenance",
      lines: [fl("l1", "Servicing", 1, 65000), fl("l2", "Oil and fuel filters", 2, 22000)], stage: "returned", returnedFrom: "finance",
      history: [h(-24 * 4, P.technical.id, "Sent"), h(-24 * 3, P.bursar.id, "Sent back", "Please attach the technician's quote and confirm if diesel is included.")], payments: [] },
    { id: "fr5", byId: P.welfare.id, at: stampISO(-24 * 25), title: "Food items for the welfare store", purpose: "Monthly restock for families on support.", groupId: "g-welfare", category: "Welfare",
      lines: [fl("l1", "Bags of rice (50kg)", 4, 78000), fl("l2", "Cartons of noodles", 10, 9800), fl("l3", "Vegetable oil (5L)", 6, 11500)], stage: "closed",
      history: [h(-24 * 25, P.welfare.id, "Sent"), h(-24 * 24, P.lead.id, "Approved"), h(-24 * 23, P.bursar.id, "Paid ₦479,000"), h(-24 * 18, P.welfare.id, "Sent the spending report"), h(-24 * 17, P.bursar.id, "Report accepted")],
      payments: [{ id: "py3", at: stampISO(-24 * 23), byId: P.bursar.id, amount: 479000 }],
      report: { at: stampISO(-24 * 18), lines: [fl("r1", "Bags of rice (50kg)", 4, 76500), fl("r2", "Cartons of noodles", 10, 9800), fl("r3", "Vegetable oil (5L)", 6, 11200)], returned: 6800, note: "Rice was cheaper at Mile 12. Balance returned to the bursar.", reviewedById: P.bursar.id, reviewedAt: stampISO(-24 * 17) } },
    { id: "fr6", byId: P.protocol.id, at: stampISO(-6), title: "Refund: fuel for the guest minister", purpose: "Bought fuel for the guest minister's car on Sunday. The office was closed.", groupId: "g-protocol", category: "Hospitality", refund: true,
      lines: [fl("l1", "Fuel (40 litres)", 40, 1150)], stage: "finance", history: [h(-6, P.protocol.id, "Asked for a refund")], payments: [] },
    { id: "fr7", byId: P.choir.id, at: stampISO(-26), title: "Rise conference: music", purpose: "Band hire and in-ear monitors for three nights.", groupId: "g-choir", eventId: "ev-youth", category: "Events",
      lines: [fl("l1", "Session drummer (3 nights)", 3, 40000), fl("l2", "In-ear monitor rental", 6, 7500)], stage: "committee", history: [h(-26, P.choir.id, "Sent to the Rise: Youth Conference 2026 committee")], payments: [] },
    { id: "fr8", byId: P.protocol.id, at: stampISO(-20), title: "Rise conference: guest ministers", purpose: "Hotel and transport for two guest ministers.", groupId: "g-protocol", eventId: "ev-youth", category: "Events",
      lines: [fl("l1", "Hotel nights", 4, 55000), fl("l2", "Airport pickups and drops", 4, 15000), fl("l3", "Honorarium gifts", 2, 50000)], stage: "committee",
      history: [h(-20, P.protocol.id, "Sent to the Rise: Youth Conference 2026 committee"), h(-10, P.outreach.id, "Acknowledged by the committee")], payments: [] },
  ];
  // Counselling requests: one waiting on the PA, one scheduled, one referred
  const counsel: CounselRequest[] = [
    { id: "cs1", personId: P.member.id, at: stampISO(-20), urgency: "soon", description: "My wife and I keep arguing about money and it's affecting the children. We'd like to talk to a pastor together.", tags: ["Marriage", "Finances"], status: "new", log: [{ at: stampISO(-20), byId: P.member.id, text: "Asked for counselling" }] },
    { id: "cs2", personId: P.worker.id, at: stampISO(-24 * 3), urgency: "convenient", timeline: "Any Saturday in the next month", description: "Pre-marital counselling before our wedding.", tags: ["Pre-marital"], status: "scheduled", handlerId: P.lead.id,
      appt: { date: dayISO(5), time: "11:00", mode: "in-person", venue: "Pastor's office" }, log: [{ at: stampISO(-24 * 3), byId: P.worker.id, text: "Asked for counselling" }, { at: stampISO(-24 * 2), byId: P.admin.id, text: "Booked for the pastor" }] },
    // The pastor referred a marriage case to the Family Life head
    { id: "cs3", personId: members[12]?.id ?? P.member.id, at: stampISO(-24 * 2), urgency: "soon", description: "We've been married three years and we've stopped talking. We want help before it gets worse.", tags: ["Marriage"], status: "referred", handlerId: P.family.id,
      log: [{ at: stampISO(-24 * 2), byId: members[12]?.id ?? P.member.id, text: "Asked for counselling" }, { at: stampISO(-30), byId: P.lead.id, text: `Referred to ${P.family.firstName} ${P.family.lastName} (Family Life)` }] },
  ];
  profile.finance = { route: 2, limit: 50000, categories: ["Equipment", "Outreach", "Welfare", "Maintenance", "Hospitality", "Events", "Utilities", "Other"], budgets: [{ groupId: "g-media", period: "year", amount: 2500000 }, { groupId: "g-outreach", period: "quarter", amount: 900000 }] };
  profile.counselling = { step: 4, done: true, delegates: [{ personId: P.admin.id, title: "Personal assistant", perms: ["manage", "approve", "reply", "reassign"] }, { personId: P.protocol.id, title: "Head of protocol", perms: ["manage"] }], link: "https://meet.google.com/heirs-counsel", venue: "Pastor's office" };
  // A member invited the church to her wedding
  const churchInvites: ChurchInvite[] = [{ id: "ci1", byId: P.worker.id, at: stampISO(-26), kind: "wedding", details: "The wedding of Ifeoma Nwosu and Chidi Okeke. We'd be honoured to have the church celebrate with us.",
    date: dayISO(24), time: "10:00", venue: "Heirs Church main auditorium, then reception at Eko Hotel", audience: "church", wants: ["officiate", "choir"], wantsOther: "Ushers for the reception, if possible", announce: true, status: "new" }];
  // A 40-day soul-winning challenge running now
  const challenges: Challenge[] = [{ id: "ch1", name: "40 Souls in 40 Days", description: "Share the love of Christ and invite someone every week.", start: dayISO(-10), end: dayISO(30), target: 40, targetEach: 5,
    createdById: P.outreach.id, at: stampISO(-10 * 24), participantIds: [P.outreach.id, P.worker.id, P.membership.id, P.member.id, P.media.id], extraFollowers: { leaders: true } }];
  outreachContacts.push(
    { id: "oc7", name: "Damilola Ajayi", phone: "0810 555 0107", area: "Ikeja", challengeId: "ch1", byId: P.worker.id, at: stampISO(-50), consent: true, status: "new" },
    { id: "oc8", name: "Peter Okafor", phone: "0811 555 0108", area: "Ogba", challengeId: "ch1", byId: P.worker.id, at: stampISO(-40), consent: true, status: "reached", contacts: [{ at: stampISO(-20), byId: P.membership.id, outcome: "Reached. Will come next Sunday." }] },
    { id: "oc9", name: "Zainab Musa", phone: "0812 555 0109", area: "Yaba", challengeId: "ch1", byId: P.member.id, at: stampISO(-30), consent: true, status: "new" },
    { id: "oc10", name: "Kunle Adeyemi", phone: "0813 555 0110", area: "Ketu", challengeId: "ch1", byId: P.outreach.id, at: stampISO(-24), consent: true, status: "new" },
    { id: "oc11", name: "Esther Bassey", phone: "0814 555 0111", area: "Ojota", challengeId: "ch1", byId: P.worker.id, at: stampISO(-6), consent: true, status: "new" },
  );
  const appFeedback: AppFeedback[] = [{ id: "fb1", byId: P.usher.id, screen: "Finance", text: "Please let ushers save a count halfway and finish it later.", at: stampISO(-26) }];

  // First-timers' feedback on the welcome form
  const recent = cases.slice(0, 10).map((c) => people.find((p) => p.id === c.personId)!).filter(Boolean);
  recent.forEach((p, i) => {
    p.feedback = [{ enjoyed: [["Worship", "The Word"], ["The welcome"], ["Worship"], ["The Word", "Prayer"], ["The atmosphere", "Worship"]][i % 5], comment: i % 3 === 0 ? "Everyone was so friendly. I'll be back!" : undefined, wantsVisit: i % 4 === 0, at: stampISO(-24 * (i + 1)) }];
    p.heardFrom = p.heardFrom ?? pick(["A friend or family member", "Social media", "I walked in", "Outreach", "Online church"]);
  });
  // Anniversaries for married demo couples
  people.forEach((p, i) => { if (!p.isChild && i % 9 === 0 && p.stage !== "first_timer") p.anniversary = `${2005 + (i % 15)}${dayISO(i % 11).slice(4)}`; });

  return {
    profile,
    collections: {
      meetings, headcounts, attendance: [...attendance, ...classAttendance], away, welfare, programmes, sessions, enrolments, events, registrations,
      counts, lodgements, transfers, templates, announcements, wishes, invites, appFeedback, prayers, downloads, outreaches, outreachContacts, challenges, churchInvites, funds, counsel,
      eventNotes, rsvps,
    },
  };
}

export const DEFAULT_PROFILE = (): ChurchProfile => ({
  color: "#4f46e5",
  services: [
    { id: "s1", name: "Sunday service", weekdays: [0], start: "09:00", end: "11:30", kind: "sunday", mode: "physical", checkin: true },
  ],
  approvalLimit: 100000, witness: false,
  categories: ["Offering", "Tithe", "Thanksgiving", "Seed"], currencies: ["NGN", "USD"],
});

export const emptyCollections = () => ({
  meetings: [] as Meeting[], headcounts: [] as Headcount[], attendance: [] as Attendance[], away: [] as Away[], welfare: [] as WelfareRequest[],
  programmes: [] as Programme[], sessions: [] as ClassSession[], enrolments: [] as Enrolment[], events: [] as ChurchEvent[], registrations: [] as Registration[],
  counts: [] as ServiceCount[], lodgements: [] as Lodgement[], transfers: [] as Transfer[], templates: DEFAULT_TEMPLATES.map((t) => ({ ...t })) as MessageTemplate[],
  announcements: [] as Announcement[], wishes: [] as Wish[], invites: [] as Invite[], appFeedback: [] as AppFeedback[],
  prayers: [] as PrayerRequest[], downloads: [] as DownloadLog[], outreaches: [] as Outreach[], outreachContacts: [] as OutreachContact[], challenges: [] as Challenge[], funds: [] as FundRequest[], counsel: [] as CounselRequest[], churchInvites: [] as ChurchInvite[],
  eventNotes: [] as EventNote[], rsvps: [] as Rsvp[],
});
