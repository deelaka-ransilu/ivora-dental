import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import StaffHeader from "@/components/StaffHeader";
import { getAllBranches } from "@/db/owner";
import {
  DEMO_EMAIL_DOMAIN,
  getFreeDentists,
  getStaffLogins,
} from "@/db/owner-staff";
import { addStaff, toggleStaff } from "./actions";

export const metadata: Metadata = { title: "Staff logins" };

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const ROLE_LABEL = {
  owner: "Owner",
  receptionist: "Receptionist",
  dentist: "Dentist",
} as const;

const ERRORS: Record<string, string> = {
  name: "Please enter a name (2 to 80 characters).",
  email: "Please enter a valid email address.",
  domain: `For this demo the email must end in ${DEMO_EMAIL_DOMAIN}.`,
  password: "The password must be 8 to 72 characters.",
  role: "Please choose a role.",
  branch: "Please choose a branch for a receptionist.",
  dentist: "Please choose a dentist who does not have a login yet.",
  exists: "That email already has a login.",
  limit: "The demo is limited to 15 logins. Deactivate one or run the reseed.",
  self: "You cannot deactivate your own login.",
  owner: "The owner login cannot be deactivated.",
  notfound: "That login was not found.",
  server: "Something went wrong on our side. Please try again.",
};

const buttonClass =
  "btn btn-dark min-h-11";

const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-foreground";

const summaryButton =
  "btn btn-light min-h-11 cursor-pointer";

// The page is not async. The cookie and searchParams are read in the child,
// behind Suspense, as Cache Components requires.
export default function StaffPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <Suspense fallback={<p className="p-4">Loading...</p>}>
      <StaffContent searchParams={searchParams} />
    </Suspense>
  );
}

async function StaffContent({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireRole(["owner"]);
  const p = await searchParams;

  const [staff, branches, freeDentists] = await Promise.all([
    getStaffLogins(user),
    getAllBranches(user),
    getFreeDentists(user),
  ]);

  const created = one(p.created) === "1";
  const updated = one(p.updated) === "1";
  const error = one(p.error);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <StaffHeader user={user} />

      <h1 className="mt-8 text-3xl font-medium tracking-tight">Staff logins</h1>
      <p className="mt-1 text-sm opacity-80">
        Who can sign in, and what each login can see. Logins are never deleted.
        Deactivate one to stop it signing in.
      </p>
      <a href="/owner" className="mt-2 inline-flex min-h-11 items-center underline">
        Back to schedule
      </a>

      {created && (
        <p role="status" className="mt-4 rounded-card border border-green-300 bg-green-50 p-4 text-sm text-green-900">
          Login created.
        </p>
      )}
      {updated && (
        <p role="status" className="mt-4 rounded-card border border-green-300 bg-green-50 p-4 text-sm text-green-900">
          Login updated.
        </p>
      )}
      {error && ERRORS[error] && (
        <p role="alert" className="mt-4 rounded-card border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          Error: {ERRORS[error]}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {staff.map((s) => (
          <li key={s.id} className="card p-5">
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

            {s.role !== "owner" && s.id !== user.id && (
              <details className="mt-2">
                <summary className={summaryButton}>
                  {s.isActive ? "Deactivate login" : "Reactivate login"}
                </summary>
                <form action={toggleStaff} className="mt-2">
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="active" value={s.isActive ? "0" : "1"} />
                  <p className="mb-2 text-sm">
                    {s.isActive
                      ? "This person will not be able to sign in. Their bookings stay."
                      : "This person will be able to sign in again."}
                  </p>
                  <button
                    type="submit"
                    className={
                      s.isActive
                        ? "btn min-h-11 bg-red-700 text-white hover:bg-red-800"
                        : buttonClass
                    }
                  >
                    {s.isActive ? "Yes, deactivate" : "Yes, reactivate"}
                  </button>
                </form>
              </details>
            )}
          </li>
        ))}
      </ul>

      <section className="mt-10 card p-5">
        <h2 className="text-xl font-medium">Add a login</h2>
        <p className="mt-1 text-sm opacity-80">
          Demo only: use a fake email ending in {DEMO_EMAIL_DOMAIN}. The
          password is never shown again.
        </p>

        <form action={addStaff} className="mt-4 space-y-4">
          <label className="block text-sm font-medium">
            Full name
            <input
              type="text"
              name="fullName"
              required
              maxLength={80}
              className={inputClass}
            />
          </label>

          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              name="email"
              required
              placeholder={`name${DEMO_EMAIL_DOMAIN}`}
              className={inputClass}
            />
          </label>

          <label className="block text-sm font-medium">
            Password (at least 8 characters)
            <input
              type="password"
              name="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              className={inputClass}
            />
          </label>

          <label className="block text-sm font-medium">
            Role
            <select name="role" required defaultValue="" className={inputClass}>
              <option value="">Choose one</option>
              <option value="receptionist">Receptionist (one branch)</option>
              <option value="dentist">Dentist (own bookings only)</option>
            </select>
          </label>

          <label className="block text-sm font-medium">
            Branch (receptionists only)
            <select name="branchId" defaultValue="" className={inputClass}>
              <option value="">Not needed for a dentist</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Dentist (dentists only)
            <select name="dentistId" defaultValue="" className={inputClass}>
              <option value="">Not needed for a receptionist</option>
              {freeDentists.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                </option>
              ))}
            </select>
          </label>
          {freeDentists.length === 0 && (
            <p className="text-sm opacity-80">
              Every active dentist already has a login.
            </p>
          )}

          <button type="submit" className={buttonClass}>
            Create login
          </button>
        </form>
      </section>
    </main>
  );
}
