// Runs once when the Next.js server starts.
export async function register() {
  // Plan reminder emails run inside the Node.js server: not in the edge runtime, during builds, or without a database.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.DATABASE_URL || process.env.PLAN_REMINDERS === "off") return;
  const { startReminderSchedule } = await import("@/lib/reminder-schedule");
  startReminderSchedule();
}
