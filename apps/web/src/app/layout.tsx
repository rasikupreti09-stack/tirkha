import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { MarketplaceProvider } from "@/components/marketplace-provider";
export const metadata: Metadata = {
  title: { default: "Tirkha | तिर्खा — Good help, closer to home", template: "%s | Tirkha | तिर्खा" },
  description: "Nepal’s premier home services marketplace. Browse clear prices for trusted everyday help across Kathmandu Valley and Pokhara.",
  applicationName: "Tirkha | तिर्खा",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Tirkha | तिर्खा" },
  formatDetection: { telephone: false },
  icons: { icon: "/tirkha-mark.svg", apple: "/apple-touch-icon.png" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthProvider><MarketplaceProvider>{children}</MarketplaceProvider></AuthProvider></body></html>;
}
