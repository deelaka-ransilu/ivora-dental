"use server";

import { redirect } from "next/navigation";
import { clearSession } from "@/lib/auth";

// Used by the "Sign out" button on every staff page.
export async function signOut() {
  await clearSession();
  redirect("/login");
}