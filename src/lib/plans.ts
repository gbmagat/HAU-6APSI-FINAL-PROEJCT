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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function whenPhrase(date: string, today: string): string {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `on ${formatPlanDate(date)}`;
}

export type ReminderEmailInput = {
  memberName: string;
  place: { name: string; address: string; city: string; slug: string };
  plan: { date: string; time?: string; note?: string };
  appUrl?: string;
  today: string;
};

/** The reminder email for one member, as plain text and simple HTML. */
export function reminderEmail({ memberName, place, plan, appUrl, today }: ReminderEmailInput) {
  const when = whenPhrase(plan.date, today);
  const at = plan.time ? ` at ${formatPlanTime(plan.time)}` : "";
  const where = [place.address, place.city].filter(Boolean).join(", ");
  const link = appUrl ? `${appUrl.replace(/\/+$/, "")}/places/${encodeURIComponent(place.slug)}` : "";
  const subject = `Reminder: ${place.name} ${when}${at}`;
  const text = [
    `Hi ${memberName},`,
    "",
    `You planned to visit ${place.name} ${when}${at} (${formatPlanDate(plan.date, plan.time)}).`,
    ...(where ? [`Where: ${where}`] : []),
    ...(plan.note ? [`Note: ${plan.note}`] : []),
    ...(link ? ["", `Open the place: ${link}`] : []),
    "",
    "You get this because plan reminders are on in Our Places. You can turn them off in Profile.",
  ].join("\n");
  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#1e3054;line-height:1.5;max-width:520px">`,
    `<p>Hi ${escapeHtml(memberName)},</p>`,
    `<p>You planned to visit <strong>${escapeHtml(place.name)}</strong> ${escapeHtml(when + at)}.</p>`,
    `<p style="margin:0">${escapeHtml(formatPlanDate(plan.date, plan.time))}</p>`,
    where ? `<p style="margin:0;color:#5b6472">${escapeHtml(where)}</p>` : "",
    plan.note ? `<p><em>${escapeHtml(plan.note)}</em></p>` : "",
    link ? `<p><a href="${escapeHtml(link)}" style="color:#315641">Open the place</a></p>` : "",
    `<p style="color:#5b6472;font-size:12px">You get this because plan reminders are on in Our Places. You can turn them off in Profile.</p>`,
    `</div>`,
  ].join("");
  return { subject, text, html };
}
