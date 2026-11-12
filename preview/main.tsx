import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../src/app/globals.css";
import { StoreProvider } from "@/lib/store";
import { ChurchTheme } from "@/components/theme";
import { AppShell } from "@/components/shell";
import { match, usePath } from "./shims/router";
import Home from "../src/app/page";
import Login from "../src/app/login/page";
import Today from "../src/app/(app)/today/page";
import People from "../src/app/(app)/people/page";
import Profile from "../src/app/(app)/people/[id]/page";
import FirstTimers from "../src/app/(app)/first-timers/page";
import Departments from "../src/app/(app)/departments/page";
import Department from "../src/app/(app)/departments/[id]/page";
import Roles from "../src/app/(app)/settings/roles/page";
import Activity from "../src/app/(app)/activity/page";
import Signup from "../src/app/signup/page";
import Welcome from "../src/app/welcome/page";
import UpdateDetails from "../src/app/update/page";
import WelcomeDisplay from "../src/app/display/welcome/page";
import Import from "../src/app/(app)/people/import/page";
import Billing from "../src/app/(app)/settings/billing/page";
import Attendance from "../src/app/(app)/attendance/page";
import Welfare from "../src/app/(app)/welfare/page";
import Classes from "../src/app/(app)/classes/page";
import Programme from "../src/app/(app)/classes/[id]/page";
import Certificate from "../src/app/(app)/classes/certificate/[id]/page";
import Events from "../src/app/(app)/events/page";
import EventDetail from "../src/app/(app)/events/[id]/page";
import Finance from "../src/app/(app)/finance/page";
import Messages from "../src/app/(app)/messages/page";
import Templates from "../src/app/(app)/settings/templates/page";
import ChurchSettings from "../src/app/(app)/settings/church/page";
import Owner from "../src/app/(app)/owner/page";
import Checkin from "../src/app/checkin/[church]/page";
import CheckinDisplay from "../src/app/display/checkin/page";
import PublicEvent from "../src/app/e/[church]/[event]/page";
import ChurchHome from "../src/app/c/[church]/page";
import Invite from "../src/app/invite/[token]/page";
import Start from "../src/app/start/page";
import Join from "../src/app/join/page";
import Prayer from "../src/app/(app)/prayer/page";
import Meeting from "../src/app/meeting/page";
import Journey from "../src/app/(app)/settings/journey/page";
import Branches from "../src/app/(app)/settings/branches/page";
import EmailSettings from "../src/app/(app)/settings/email/page";
import ShortEvent from "../src/app/[church]/[event]/page";

function App() {
  const { route, params } = match(usePath());
  if (route === "/") return <Home />;
  if (route === "/login") return <Login />;
  if (route === "/signup") return <Signup />;
  if (route === "/welcome") return <Welcome />;
  if (route === "/update") return <UpdateDetails />;
  if (route === "/display/welcome") return <WelcomeDisplay />;
  if (route === "/display/checkin") return <CheckinDisplay />;
  if (route === "/checkin/:church") return <Checkin key={params.church} />;
  if (route === "/e/:church/:event") return <PublicEvent key={params.event} />;
  if (route === "/:church/:event") return <ShortEvent key={params.event} />;
  if (route === "/start") return <Start />;
  if (route === "/join") return <Join />;
  if (route === "/meeting") return <Meeting />;
  if (route === "/c/:church") return <ChurchHome />;
  if (route === "/invite/:token") return <Invite key={params.token} />;
  const page = {
    "/today": <Today />, "/people": <People />, "/people/:id": <Profile key={params.id} />, "/people/import": <Import />, "/settings/billing": <Billing />, "/first-timers": <FirstTimers />,
    "/departments": <Departments />, "/departments/:id": <Department key={params.id} />, "/settings/roles": <Roles />,
    "/activity": <Activity />, "/attendance": <Attendance />, "/welfare": <Welfare />, "/classes": <Classes />, "/classes/:id": <Programme key={params.id} />,
    "/classes/certificate/:id": <Certificate key={params.id} />, "/events": <Events />, "/events/:id": <EventDetail key={params.id} />, "/finance": <Finance />,
    "/messages": <Messages />, "/settings/templates": <Templates />, "/settings/church": <ChurchSettings />, "/owner": <Owner />,
    "/prayer": <Prayer />, "/settings/journey": <Journey />, "/settings/branches": <Branches />, "/settings/email": <EmailSettings />,
  }[route];
  return <AppShell>{page}</AppShell>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><StoreProvider><ChurchTheme><App /></ChurchTheme></StoreProvider></StrictMode>);
