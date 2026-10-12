import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Ivora Dental",
    template: "%s | Ivora Dental",
  },
  description:
    "Concept project: online booking and staff tools for a fictional three-branch dental clinic.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Demo with fictional data. Please don&apos;t enter real details.
        </div>
        {children}
      </body>
    </html>
  );
}