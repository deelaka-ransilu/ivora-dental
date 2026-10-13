import { Suspense } from "react";
import { demoSignIn } from "./demo-actions";

const DEMO_BUTTONS = [
  {
    who: "owner",
    label: "Sign in as Owner",
    hint: "All branches, staff and settings",
  },
  {
    who: "reception",
    label: "Sign in as Receptionist (Negombo)",
    hint: "Bookings for the Negombo branch only",
  },
  {
    who: "dentist",
    label: "Sign in as Dr. Fernando",
    hint: "Read-only view of his own bookings",
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
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Staff sign in</h1>
      <p className="mt-2 text-sm opacity-80">
        This is a demo with fictional data. Pick a role to look around.
      </p>

      <Suspense fallback={null}>
        <LoginError searchParams={searchParams} />
      </Suspense>

      <div className="mt-6 space-y-4">
        {DEMO_BUTTONS.map((b) => (
          <form key={b.who} action={demoSignIn}>
            <input type="hidden" name="who" value={b.who} />
            <button
              type="submit"
              className="min-h-11 w-full rounded-md bg-primary px-4 py-2 text-base font-medium text-primary-foreground hover:bg-primary-hover"
            >
              {b.label}
            </button>
            <p className="mt-1 text-sm opacity-70">{b.hint}</p>
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
      className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
    >
      {message}
    </p>
  );
}