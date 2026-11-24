import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";

import { AuthModal } from "@/components/AuthModal";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { AuthProvider } from "@/lib/auth";
import { AuthModalProvider } from "@/lib/auth-modal";

import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EventHive",
  description: "Create, organize, and conduct quiz and survey events.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full scroll-smooth`}>
      <body
        className="flex min-h-full flex-col antialiased"
        style={{ fontFamily: "var(--font-body), sans-serif" }}
      >
        <AuthProvider>
          <AuthModalProvider>
            <Nav />
            <main className="flex-1">{children}</main>
            <Footer />
            <AuthModal />
          </AuthModalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
