import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import StaffHeader from "@/components/StaffHeader";
import { getStaffLogins } from "@/db/owner-staff";

export const metadata: Metadata = { title: "Staff logins" };

const ROLE_LABEL = {
  owner: "Owner",
  receptionist: "Receptionist",
  dentist: "Dentist",
} as const;

// The page is not async. The cookie is read in the child, behind Suspense,
// as Cache Components requires.
export default function StaffPage() {
  return (
    <Suspense fallback={<p className="p-4">Loading...</p>}>
      <StaffContent />
    </Suspense>
  );
}

async function StaffContent() {
  const user = await requireRole(["owner"]);
  const staff = await getStaffLogins(user);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <StaffHeader user={user} />

      <h1 className="mt-6 text-2xl font-bold">Staff logins</h1>
      <p className="mt-1 text-sm opacity-80">
        Read only. Who can sign in, and what each login can see. Creating and
        removing logins from the browser is not built in this demo.
      </p>
      <a href="/owner" className="mt-2 inline-flex min-h-11 items-center underline">
        Back to schedule
      </a>

      <ul className="mt-4 space-y-3">
        {staff.map((s) => (
          <li key={s.id} className="rounded-md border border-neutral-500/60 p-4">
            <p className="font-semibold">{s.fullName}</p>
            <p className="text-sm">
              {ROLE_LABEL[s.role]}: {s.isActive ? "Active" : "Inactive"}
            </p>
            <p className="text-sm opacity-80">Login: {s.email || "unknown"}</p>
            <p className="text-sm opacity-80">
              {s.role === "owner" && "Sees all branches and all bookings."}
              {s.role === "receptionist" &&
                `Sees only the ${s.branchName || "assigned"} branch.`}
              {s.role === "dentist" &&
                `Sees only their own bookings (${s.dentistName || "linked dentist"}), no phone numbers.`}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
