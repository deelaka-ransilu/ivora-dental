import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import StaffHeader from "@/components/StaffHeader";
import ComingSoon from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Reception" };

export default function ReceptionPage() {
  return (
    <Suspense fallback={<p className="p-4">Loading...</p>}>
      <ReceptionContent />
    </Suspense>
  );
}

async function ReceptionContent() {
  const user = await requireRole(["receptionist"]);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <StaffHeader user={user} />
      <ComingSoon
        title="Reception dashboard"
        items={[
          "List bookings by date for your own branch",
          "Add, move or cancel bookings",
          "Delete a patient's data on request",
        ]}
      />
    </main>
  );
}