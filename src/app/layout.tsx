import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ChurchTheme, EARLY_THEME_SCRIPT } from "@/components/theme";

export const metadata: Metadata = {
  title: "Traqi for Churches",
  description: "Know every person in your church, from first visit to leadership.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Traqi", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#1e1b4b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: EARLY_THEME_SCRIPT }} /></head>
      <body><StoreProvider><ChurchTheme>{children}</ChurchTheme></StoreProvider><script dangerouslySetInnerHTML={{ __html: `if("serviceWorker" in navigator&&location.hostname!=="localhost")addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}))` }} /></body>
    </html>
  );
}
