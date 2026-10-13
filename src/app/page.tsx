import Link from "next/link";
import LandingSettle from "@/components/LandingSettle";

const proofs = [
  {
    tint: "bg-tint-sky",
    title: "No double-booking",
    text: "A dentist can't be booked in two places at once. The database itself refuses the clash.",
  },
  {
    tint: "bg-tint-sage",
    title: "Three roles",
    text: "Owner, receptionist and dentist each see only what their job needs.",
  },
  {
    tint: "bg-tint-lilac",
    title: "Booking on a phone",
    text: "Patients pick a branch and a time in a few taps, from any screen size.",
  },
];

const steps = [
  { title: "Choose a branch", text: "Colombo 7, Nugegoda or Negombo." },
  { title: "Pick a time", text: "Only free slots are shown, so nothing clashes." },
  { title: "Confirm your details", text: "You get a confirmation straight away." },
];

const branches = [
  { name: "Colombo 7", tint: "bg-tint-sky" },
  { name: "Nugegoda", tint: "bg-tint-sage" },
  { name: "Negombo", tint: "bg-tint-sand" },
];

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <span className="text-lg font-semibold">Ivora Dental</span>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn btn-light !px-4 !py-2 text-sm">
            Staff demo sign in
          </Link>
          <Link href="/book" className="btn btn-dark !px-4 !py-2 text-sm">
            Book now
          </Link>
        </nav>
      </header>

      <section className="card grid gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h1 className="text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
            Dental care at three branches,{" "}
            <span className="text-accent">booked in minutes.</span>
          </h1>
          <p className="mt-4 max-w-md text-base text-muted">
            Colombo 7, Nugegoda and Negombo, with one shared schedule. Choose a
            branch, pick a time, and you&apos;re done.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/book" className="btn btn-dark">
              Book now <span aria-hidden>→</span>
            </Link>
            <Link href="/login" className="btn btn-light">
              Staff demo sign in
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted">
            Concept project with fictional data. It shows an online booking page
            and staff screens for a three-branch clinic.
          </p>
        </div>
        <div className="rounded-card bg-tint-sky p-6 sm:p-8">
          <LandingSettle />
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {proofs.map((p) => (
          <div key={p.title} className={`${p.tint} rounded-card p-6 sm:p-8`}>
            <h2 className="text-xl font-medium">{p.title}</h2>
            <p className="mt-2 text-sm text-muted">{p.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="text-3xl font-medium tracking-tight">
          How booking works
        </h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="card p-6">
              <span className="chip">Step {i + 1}</span>
              <h3 className="mt-4 text-lg font-medium">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16">
        <h2 className="text-3xl font-medium tracking-tight">Our branches</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {branches.map((b) => (
            <Link
              key={b.name}
              href="/book"
              className={`${b.tint} flex min-h-40 flex-col justify-between rounded-card p-6 transition-opacity hover:opacity-80`}
            >
              <span className="text-xl font-medium">{b.name}</span>
              <span className="text-sm text-muted">Book at this branch →</span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-16 border-t border-line pt-6 text-sm text-muted">
        Ivora Dental is a concept project. All clinic, staff and patient data is
        fictional.
      </footer>
    </main>
  );
}
