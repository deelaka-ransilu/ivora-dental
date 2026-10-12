import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import StaffHeader from "@/components/StaffHeader";
import ComingSoon from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Dentist" };

export default function DentistPage() {
  return (
    <Suspense fallback={<p className="p-4">Loading...</p>}>
      <DentistContent />
    </Suspense>
  );
}

async function DentistContent() {
  const user = await requireRole(["dentist"]);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <StaffHeader user={user} />
      <ComingSoon
        title="My bookings"
        items={[
          "See your own bookings across all your branches",
          "Name, time, service and branch only (no phone numbers)",
        ]}
      />
    </main>
  );
}