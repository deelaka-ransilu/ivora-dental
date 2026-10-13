import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Demo with fictional data. Please don&apos;t enter real details.
        </div>
        {children}
      </body>
    </html>
  );
}
