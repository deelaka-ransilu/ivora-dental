import { signOut } from "@/app/actions";
import type { CurrentUser, Role } from "@/lib/auth";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  receptionist: "Receptionist",
  dentist: "Dentist",
};

export default function StaffHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div>
        <p className="text-sm text-muted">Signed in as</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-lg font-medium">
          {user.fullName}
          <span className="chip bg-accent-soft text-sm">
            {ROLE_LABEL[user.role]}
          </span>
        </p>
      </div>
      <form action={signOut}>
        <button type="submit" className="btn btn-light min-h-11">
          Sign out
        </button>
      </form>
    </header>
  );
}
