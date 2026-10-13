import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <div className="bg-foreground px-4 py-2 text-center text-xs text-background/80">
          Demo with fictional data. Please don&apos;t enter real details.
        </div>
        {children}
      </body>
    </html>
  );
}
