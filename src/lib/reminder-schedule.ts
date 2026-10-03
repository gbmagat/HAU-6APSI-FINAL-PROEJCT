import "server-only";

import { sendDueReminders } from "@/lib/plan-reminders";

const INTERVAL_MS = 2 * 60 * 1000;
const FIRST_RUN_MS = 15 * 1000;

const state = globalThis as typeof globalThis & { __ourPlacesReminderTimer?: ReturnType<typeof setInterval> };

/** Check for due plan reminders every two minutes while the server runs. */
export function startReminderSchedule() {
  if (state.__ourPlacesReminderTimer) return;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const { sent, failed } = await sendDueReminders();
      if (sent || failed) console.info(`Plan reminders: ${sent} sent, ${failed} failed.`);
    } catch (error) {
      console.error("Plan reminders could not run:", error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  };
  state.__ourPlacesReminderTimer = setInterval(() => void run(), INTERVAL_MS);
  state.__ourPlacesReminderTimer.unref?.();
  setTimeout(() => void run(), FIRST_RUN_MS).unref?.();
}
