import type { Metadata } from "next";
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
  title: "Questforge",
  description: "Turn every day into an adventure",
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
