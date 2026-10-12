"use server";

import { redirect } from "next/navigation";
import { signInWithPassword, setSession } from "@/lib/auth";

// DEMO ONLY: powers the three login buttons on /login.
// A real client site would not have this file.
const DEMO_ACCOUNTS = {
  owner: { email: "owner@ivora-demo.test", next: "/owner" },
  reception: { email: "reception.negombo@ivora-demo.test", next: "/reception" },
  dentist: { email: "fernando@ivora-demo.test", next: "/dentist" },
} as const;

type DemoKey = keyof typeof DEMO_ACCOUNTS;

function isDemoKey(value: unknown): value is DemoKey {
  return typeof value === "string" && Object.hasOwn(DEMO_ACCOUNTS, value);
}

export async function demoSignIn(formData: FormData) {
  const who = formData.get("who");
  if (!isDemoKey(who)) {
    redirect("/login?error=1");
  }

  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    redirect("/login?error=setup");
  }

  const account = DEMO_ACCOUNTS[who];
  const result = await signInWithPassword(account.email, password);
  if (!result.ok) {
    redirect("/login?error=1");
  }

  await setSession(result.accessToken, result.expiresIn);
  redirect(account.next);
}