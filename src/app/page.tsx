import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Ivora Dental</h1>
      <p className="mt-3 text-base">
        Dental care at three branches: Colombo 7, Nugegoda and Negombo.
      </p>
      <p className="mt-2 text-sm opacity-70">
        This is a concept project with fictional data. It shows an online
        booking page and staff screens for a three-branch clinic.
      </p>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <Link
          href="/book"
          className="flex min-h-11 items-center justify-center rounded-md bg-blue-700 px-6 py-2 text-base font-medium text-white hover:bg-blue-800"
        >
          Book now
        </Link>
        <Link
          href="/login"
          className="flex min-h-11 items-center justify-center rounded-md border border-neutral-500/60 px-6 py-2 text-base font-medium hover:bg-neutral-500/20"
        >
          Staff demo sign in
        </Link>
      </div>
    </main>
  );
}