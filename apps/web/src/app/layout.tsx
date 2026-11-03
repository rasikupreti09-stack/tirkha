import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { MarketplaceProvider } from "@/components/marketplace-provider";
import { LanguageProvider } from "@/components/language-provider";
import { LaunchSplash } from "@/components/launch-splash";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import type { Viewport } from "next";
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#17382f" };
export const metadata: Metadata = {
  title: { default: "Tirkha | तिर्खा — Good help, closer to home", template: "%s | Tirkha | तिर्खा" },
  description: "Nepal’s premier home services marketplace. Browse clear prices for trusted everyday help across Kathmandu Valley, Pokhara, Hetauda and Simara.",
  applicationName: "Tirkha | तिर्खा",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Tirkha | तिर्खा" },
  formatDetection: { telephone: false },
  icons: { icon: "/tirkha-mark.svg?v=2", apple: "/apple-touch-icon.png?v=2" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthProvider><LanguageProvider><MarketplaceProvider><ServiceWorkerRegistration /><LaunchSplash />{children}</MarketplaceProvider></LanguageProvider></AuthProvider></body></html>;
}
