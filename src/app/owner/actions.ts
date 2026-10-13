"use server";

// Owner block actions (O3). Every action checks the role first.

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { addBlock, parseBlockInput, removeBlock } from "@/db/owner-blocks";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// Back to the owner week view, with extra query values (error or status).
function go(params: Record<string, string>): never {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== "")
  );
  redirect(`/owner?${q.toString()}`);
}

export async function saveBlock(formData: FormData) {
  const user = await requireRole(["owner"]);

  const week = field(formData, "week");
  const branch = field(formData, "branch");
  const raw: Record<string, string> = {
    target: field(formData, "target"),
    startDate: field(formData, "startDate"),
    startTime: field(formData, "startTime"),
    endDate: field(formData, "endDate"),
    endTime: field(formData, "endTime"),
    wholeDay: field(formData, "wholeDay"),
    reason: field(formData, "reason"),
  };

  // Keep the form filled in, and show the preview again, if something is wrong.
  const parsed = parseBlockInput(raw);
  if (!parsed.ok) {
    go({ week, branch, ...raw, preview: "1" });
  }

  const ok = await addBlock(user, parsed.value);
  if (!ok) go({ week, branch, ...raw, preview: "1", error: "server" });

  go({ week, branch, blocked: "1" });
}

export async function deleteBlock(formData: FormData) {
  const user = await requireRole(["owner"]);

  const week = field(formData, "week");
  const branch = field(formData, "branch");
  const id = field(formData, "id");
  if (!UUID.test(id)) go({ week, branch, error: "server" });

  const removed = await removeBlock(user, id);
  if (!removed) go({ week, branch, error: "server" });

  go({ week, branch, removed: "1" });
}
