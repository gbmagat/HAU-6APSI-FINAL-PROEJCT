import { describe, expect, it } from "vitest";

import { planReminderEmail, reviewReminderEmail } from "@/lib/emails";
import { byUpcomingPlan, formatPlanDate, planInputSchema, reminderTime } from "@/lib/plans";
import { todayInManila } from "@/lib/visit-form";

function daysFrom(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe("reminder times (Philippine time, UTC+8)", () => {
  it("sends the evening before, the morning of, or a week ahead", () => {
    expect(reminderTime("2026-10-11", undefined, "day-before")?.toISOString()).toBe("2026-10-10T10:00:00.000Z"); // Oct 10, 6 PM
    expect(reminderTime("2026-10-11", "15:00", "morning")?.toISOString()).toBe("2026-10-11T00:00:00.000Z"); // Oct 11, 8 AM
    expect(reminderTime("2026-10-11", undefined, "week-before")?.toISOString()).toBe("2026-10-04T01:00:00.000Z"); // Oct 4, 9 AM
    expect(reminderTime("2026-10-11", "15:00", "none")).toBeNull();
  });

  it("moves the morning reminder two hours ahead of an early start", () => {
    expect(reminderTime("2026-10-11", "07:30", "morning")?.toISOString()).toBe("2026-10-10T21:30:00.000Z"); // 5:30 AM
    expect(reminderTime("2026-10-11", "01:00", "morning")?.toISOString()).toBe("2026-10-10T16:00:00.000Z"); // midnight
  });

  it("crosses month and year boundaries", () => {
    expect(reminderTime("2027-01-01", undefined, "day-before")?.toISOString()).toBe("2026-12-31T10:00:00.000Z");
    expect(reminderTime("2026-03-03", undefined, "week-before")?.toISOString()).toBe("2026-02-24T01:00:00.000Z");
  });
});

describe("plan input", () => {
  const today = todayInManila();

  it("accepts today or later, with or without a time", () => {
    expect(planInputSchema.safeParse({ date: today, time: "", note: "", reminder: "morning" }).success).toBe(true);
    expect(planInputSchema.safeParse({ date: daysFrom(today, 30), time: "18:45", note: "Book ahead", reminder: "week-before" }).success).toBe(true);
  });

  it("refuses past dates, made-up times, and long notes", () => {
    expect(planInputSchema.safeParse({ date: daysFrom(today, -1), time: "", note: "", reminder: "none" }).success).toBe(false);
    expect(planInputSchema.safeParse({ date: today, time: "25:00", note: "", reminder: "none" }).success).toBe(false);
    expect(planInputSchema.safeParse({ date: today, time: "", note: "x".repeat(201), reminder: "none" }).success).toBe(false);
    expect(planInputSchema.safeParse({ date: today, time: "", note: "", reminder: "hourly" }).success).toBe(false);
  });
});

describe("plan display", () => {
  it("formats the date and a 12-hour time", () => {
    expect(formatPlanDate("2026-10-11")).toBe("Sun, Oct 11");
    expect(formatPlanDate("2026-10-11", "15:05")).toBe("Sun, Oct 11 · 3:05 PM");
    expect(formatPlanDate("2026-10-11", "00:30")).toBe("Sun, Oct 11 · 12:30 AM");
  });

  it("lists upcoming plans first, soonest first, and leaves past plans with the rest", () => {
    const places = [
      { id: "none" },
      { id: "later", plan: { date: "2026-10-20", reminder: "none" as const } },
      { id: "past", plan: { date: "2026-09-01", reminder: "none" as const } },
      { id: "sooner-evening", plan: { date: "2026-10-05", time: "19:00", reminder: "none" as const } },
      { id: "sooner-morning", plan: { date: "2026-10-05", time: "09:00", reminder: "none" as const } },
    ];
    expect(byUpcomingPlan(places, "2026-10-03").map((place) => place.id)).toEqual(["sooner-morning", "sooner-evening", "later", "none", "past"]);
  });
});

describe("plan reminder email", () => {
  const input = {
    memberName: "Gab",
    place: { name: "Luna <Café>", address: "12 Rizal St", city: "Makati", slug: "luna-cafe" },
    plan: { date: "2026-10-11", time: "15:00", note: "Ask for the \"window\" table" },
    appUrl: "https://ourplaces.example/",
    today: "2026-10-10",
  };

  it("says when and where, with a link back to the place", () => {
    const email = planReminderEmail(input);
    expect(email.subject).toBe("Reminder: Luna <Café> tomorrow at 3:00 PM");
    expect(email.text).toContain("Hi Gab,");
    expect(email.text).toContain("Where: 12 Rizal St, Makati");
    expect(email.text).toContain("Open the place: https://ourplaces.example/places/luna-cafe");
    expect(email.text).toContain("turn them off in Profile");
  });

  it("escapes names and notes in the HTML version", () => {
    const { html } = planReminderEmail(input);
    expect(html).toContain("Luna &lt;Café&gt;");
    expect(html).toContain("&quot;window&quot;");
    expect(html).not.toContain("<Café>");
  });

  it("uses today or the date when the plan is not tomorrow, and leaves the link out without an app address", () => {
    expect(planReminderEmail({ ...input, today: "2026-10-11" }).subject).toBe("Reminder: Luna <Café> today at 3:00 PM");
    const weekAhead = planReminderEmail({ ...input, today: "2026-10-04", appUrl: undefined, plan: { date: "2026-10-11" } });
    expect(weekAhead.subject).toBe("Reminder: Luna <Café> on Sun, Oct 11");
    expect(weekAhead.text).not.toContain("Open the place");
  });
});

describe("review reminder email", () => {
  it("names the visit and links to it, escaping names in the HTML version", () => {
    const email = reviewReminderEmail({
      memberName: "M", authorName: "Gab <3", place: { name: "Luna & Co", slug: "luna-co" }, visitedOn: "2026-09-20", appUrl: "https://ourplaces.example",
    });
    expect(email.subject).toBe("Gab <3 logged Luna & Co: your review is waiting");
    expect(email.text).toContain("Add your review: https://ourplaces.example/places/luna-co");
    expect(email.html).toContain("Gab &lt;3");
    expect(email.html).toContain("Luna &amp; Co");
  });
});
