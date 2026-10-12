import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import StaffHeader from "@/components/StaffHeader";
import ComingSoon from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Owner" };

// The page is not async. The cookie read (inside requireRole) happens
// in the child component, behind Suspense, as Cache Components requires.
export default function OwnerPage() {
  return (
    <Suspense fallback={<p className="p-4">Loading...</p>}>
      <OwnerContent />
    </Suspense>
  );
}

async function OwnerContent() {
  const user = await requireRole(["owner"]);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <StaffHeader user={user} />
      <ComingSoon
        title="Owner screens"
        items={[
          "See one schedule across all branches",
          "Set up branches, dentists, services and opening hours",
          "Block a branch or a dentist for a day",
          "Create and remove staff logins",
        ]}
      />
    </main>
  );
}