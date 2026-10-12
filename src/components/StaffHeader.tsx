import { signOut } from "@/app/actions";
import type { CurrentUser, Role } from "@/lib/auth";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  receptionist: "Receptionist",
  dentist: "Dentist",
};

export default function StaffHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-500/40 pb-4">
      <div>
        <p className="text-sm opacity-70">Signed in as</p>
        <p className="text-lg font-semibold">
          {user.fullName} ({ROLE_LABEL[user.role]})
        </p>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="min-h-11 rounded-md border border-neutral-500/60 px-4 py-2 text-base font-medium hover:bg-neutral-500/20"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}