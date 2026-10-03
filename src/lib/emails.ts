import { formatPlanDate, formatPlanTime } from "@/lib/plans";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function whenPhrase(date: string, today: string): string {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `on ${formatPlanDate(date)}`;
}

export type PlanReminderEmailInput = {
  memberName: string;
  place: { name: string; address: string; city: string; slug: string };
  plan: { date: string; time?: string; note?: string };
  appUrl?: string;
  today: string;
};

/** The plan reminder email for one member, as plain text and simple HTML. */
export function planReminderEmail({ memberName, place, plan, appUrl, today }: PlanReminderEmailInput) {
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

export type ReviewReminderEmailInput = {
  memberName: string;
  authorName: string;
  place: { name: string; slug: string };
  visitedOn: string;
  appUrl?: string;
};

/**
 * Tells a member that their partner logged a visit they have not reviewed yet. It says nothing about
 * the partner's rating or reflection, which stay hidden until both reviews exist.
 */
export function reviewReminderEmail({ memberName, authorName, place, visitedOn, appUrl }: ReviewReminderEmailInput) {
  const link = appUrl ? `${appUrl.replace(/\/+$/, "")}/places/${encodeURIComponent(place.slug)}` : "";
  const subject = `${authorName} logged ${place.name}: your review is waiting`;
  const footer = "You get this because review reminders are on in Our Places. You can turn them off in Profile.";
  const text = [
    `Hi ${memberName},`,
    "",
    `${authorName} logged your visit to ${place.name} on ${formatPlanDate(visitedOn)}.`,
    `Add your private review to see both scores. ${authorName}'s review stays hidden until you do.`,
    ...(link ? ["", `Add your review: ${link}`] : []),
    "",
    footer,
  ].join("\n");
  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#1e3054;line-height:1.5;max-width:520px">`,
    `<p>Hi ${escapeHtml(memberName)},</p>`,
    `<p>${escapeHtml(authorName)} logged your visit to <strong>${escapeHtml(place.name)}</strong> on ${escapeHtml(formatPlanDate(visitedOn))}.</p>`,
    `<p>Add your private review to see both scores. ${escapeHtml(authorName)}&#39;s review stays hidden until you do.</p>`,
    link ? `<p><a href="${escapeHtml(link)}" style="color:#315641">Add your review</a></p>` : "",
    `<p style="color:#5b6472;font-size:12px">${escapeHtml(footer)}</p>`,
    `</div>`,
  ].join("");
  return { subject, text, html };
}
