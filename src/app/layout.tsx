import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ChurchTheme, EARLY_THEME_SCRIPT } from "@/components/theme";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Traqi for Churches",
  description: "Every soul known. Every visitor followed up. The church management app built for how churches in Africa run.",
  // The picture WhatsApp, Facebook and others show when someone shares the link
  openGraph: { title: "Traqi for Churches", description: "Every soul known. Every visitor followed up.", images: [{ url: "/landing/og.jpg", width: 1200, height: 630 }], type: "website" },
  twitter: { card: "summary_large_image", images: ["/landing/og.jpg"] },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Traqi", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#1e1b4b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: EARLY_THEME_SCRIPT }} /></head>
      <body><StoreProvider><ChurchTheme>{children}</ChurchTheme></StoreProvider><script dangerouslySetInnerHTML={{ __html: `if("serviceWorker" in navigator&&location.hostname!=="localhost")addEventListener("load",()=>navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}).then(r=>r.update()).catch(()=>{}))` }} /></body>
    </html>
  );
}
