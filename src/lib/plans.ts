import { z } from "zod";

import { planReminders, type PlacePlan, type PlanReminder } from "@/lib/domain";
import { todayInManila } from "@/lib/visit-form";

export const reminderOptions: { value: PlanReminder; label: string }[] = [
  { value: "day-before", label: "The day before, 6 PM" },
  { value: "morning", label: "On the day, 8 AM" },
  { value: "week-before", label: "A week before, 9 AM" },
  { value: "none", label: "No reminder" },
];

export const planInputSchema = z.strictObject({
  date: z.iso.date("Choose a date.").refine((value) => value >= todayInManila(), "Choose today or a later date."),
  time: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 15:30.")]),
  note: z.string().trim().max(200),
  reminder: z.enum(planReminders),
});

export type PlanInput = z.infer<typeof planInputSchema>;

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000; // Philippine time is UTC+8 all year.

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** A wall-clock time in Manila on a given date, shifted by whole days, as an instant. */
function manilaInstant(date: string, minutes: number, dayOffset = 0): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + dayOffset, 0, minutes) - MANILA_OFFSET_MS);
}

/** When the reminder email for a plan goes out, or null when no reminder was asked for. */
export function reminderTime(date: string, time: string | undefined, reminder: PlanReminder): Date | null {
  switch (reminder) {
    case "none":
      return null;
    case "week-before":
      return manilaInstant(date, 9 * 60, -7);
    case "day-before":
      return manilaInstant(date, 18 * 60, -1);
    case "morning": {
      // 8 AM on the day, or two hours ahead of a start earlier than 10 AM.
      const start = time ? minutesOf(time) : 10 * 60;
      return manilaInstant(date, Math.max(0, Math.min(8 * 60, start - 120)));
    }
  }
}

export function formatPlanTime(time: string): string {
  const minutes = minutesOf(time);
  const hours = Math.floor(minutes / 60);
  return `${hours % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

/** "Sat, Oct 11" or "Sat, Oct 11 · 3:00 PM". */
export function formatPlanDate(date: string, time?: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const label = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
  return time ? `${label} · ${formatPlanTime(time)}` : label;
}

export function reminderLabel(reminder: PlanReminder): string {
  return reminderOptions.find((option) => option.value === reminder)?.label ?? "No reminder";
}

/** Upcoming plans first, soonest first; everything else keeps its order. */
export function byUpcomingPlan<T extends { plan?: PlacePlan }>(places: T[], today = todayInManila()): T[] {
  const upcoming = (place: T) => Boolean(place.plan && place.plan.date >= today);
  return [...places].sort((a, b) => {
    if (upcoming(a) !== upcoming(b)) return upcoming(a) ? -1 : 1;
    if (!upcoming(a)) return 0;
    return `${a.plan!.date} ${a.plan!.time ?? ""}`.localeCompare(`${b.plan!.date} ${b.plan!.time ?? ""}`);
  });
}
