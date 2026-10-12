import type { Metadata } from "next";
import ComingSoon from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Book an appointment" };

export default function BookPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Book an appointment</h1>
      <ComingSoon
        title="Online booking"
        items={[
          "Pick a branch, a service and, if you like, a dentist",
          "See available times (at least 2 hours from now)",
          "Book with just your name and phone number",
          "Tick one consent box and get a simulated SMS confirmation",
        ]}
      />
    </main>
  );
}