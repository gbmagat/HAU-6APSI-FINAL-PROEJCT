import "server-only";

import { sendPlanReminders } from "@/lib/plan-reminders";
import { sendReviewReminders } from "@/lib/review-reminders";

const INTERVAL_MS = 2 * 60 * 1000;
const FIRST_RUN_MS = 15 * 1000;

const state = globalThis as typeof globalThis & { __ourPlacesReminderTimer?: ReturnType<typeof setInterval> };

/** Check for due plan and review reminders every two minutes while the server runs. */
export function startReminderSchedule() {
  if (state.__ourPlacesReminderTimer) return;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const plans = await sendPlanReminders();
      if (plans.sent || plans.failed) console.info(`Plan reminders: ${plans.sent} sent, ${plans.failed} failed.`);
      const reviews = await sendReviewReminders();
      if (reviews.sent || reviews.failed) console.info(`Review reminders: ${reviews.sent} sent, ${reviews.failed} failed.`);
    } catch (error) {
      console.error("Reminders could not run:", error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  };
  state.__ourPlacesReminderTimer = setInterval(() => void run(), INTERVAL_MS);
  state.__ourPlacesReminderTimer.unref?.();
  setTimeout(() => void run(), FIRST_RUN_MS).unref?.();
}
