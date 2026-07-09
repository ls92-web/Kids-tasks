import type { Metadata, Viewport } from "next";
import { Nunito, Chakra_Petch, Cinzel, Orbitron } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const chakra = Chakra_Petch({
  variable: "--font-ninja",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const cinzel = Cinzel({
  variable: "--font-samurai",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const orbitron = Orbitron({
  variable: "--font-speed",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "WonderNest",
  description: "Turn every day into an adventure",
  applicationName: "WonderNest",
  appleWebApp: {
    capable: true,
    title: "WonderNest",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "WonderNest",
    description: "Turn every day into an adventure",
    siteName: "WonderNest",
    type: "website",
    images: [{ url: "/brand/login-hero.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#060a18",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="ninja"
      data-anim="full"
      className={`${nunito.variable} ${chakra.variable} ${cinzel.variable} ${orbitron.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
