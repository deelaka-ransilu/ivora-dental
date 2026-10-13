import Link from "next/link";
import { Suspense } from "react";
import { demoSignIn } from "./demo-actions";

const DEMO_BUTTONS = [
  {
    who: "owner",
    role: "Owner",
    label: "Sign in as Owner",
    hint: "All branches, staff and settings",
    tint: "bg-tint-sky",
  },
  {
    who: "reception",
    role: "Receptionist",
    label: "Sign in as Receptionist (Negombo)",
    hint: "Bookings for the Negombo branch only",
    tint: "bg-tint-sage",
  },
  {
    who: "dentist",
    role: "Dr. Fernando",
    label: "Sign in as Dr. Fernando",
    hint: "Read-only view of his own bookings",
    tint: "bg-tint-lilac",
  },
];

type SearchParams = Promise<{ error?: string | string[] }>;

// The page itself is not async. The request-time part (searchParams)
// is read inside the Suspense boundary, as Cache Components requires.
export default function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Back to home
      </Link>

      <h1 className="mt-6 text-3xl font-medium tracking-tight sm:text-4xl">
        Staff sign in
      </h1>
      <p className="mt-2 max-w-md text-base text-muted">
        This is a demo with fictional data. Pick a role to look around.
      </p>

      <Suspense fallback={null}>
        <LoginError searchParams={searchParams} />
      </Suspense>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {DEMO_BUTTONS.map((b) => (
          <form
            key={b.who}
            action={demoSignIn}
            className={`${b.tint} flex min-h-52 flex-col justify-between rounded-card p-6`}
          >
            <input type="hidden" name="who" value={b.who} />
            <div>
              <h2 className="text-xl font-medium">{b.role}</h2>
              <p className="mt-2 text-sm text-muted">{b.hint}</p>
            </div>
            <button
              type="submit"
              aria-label={b.label}
              className="btn btn-dark mt-6 min-h-11 w-full"
            >
              Sign in <span aria-hidden>→</span>
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}

async function LoginError({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  if (!error) return null;

  const message =
    error === "setup"
      ? "The demo is not set up yet: the server is missing its demo password. Please tell the site owner."
      : "Sign in did not work. Please click the button again. If it keeps failing, try again in a minute.";

  return (
    <p
      role="alert"
      className="mt-6 rounded-card border border-red-300 bg-red-50 p-4 text-sm text-red-800"
    >
      {message}
    </p>
  );
}
