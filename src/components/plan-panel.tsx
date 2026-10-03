"use client";

import { Bell, BellOff, CalendarPlus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { usePassport } from "@/components/passport-provider";
import type { Place, PlanReminder } from "@/lib/domain";
import { togglePlannedStatus } from "@/lib/places";
import { formatPlanDate, planInputSchema, reminderLabel, reminderOptions } from "@/lib/plans";
import { todayInManila } from "@/lib/visit-form";

/** Plan a visit on a date, with an email reminder to both members. */
export function PlanPanel({ place }: { place: Place }) {
  const passport = usePassport();
  const plan = place.plan;
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(plan?.date ?? "");
  const [time, setTime] = useState(plan?.time ?? "");
  const [reminder, setReminder] = useState<PlanReminder>(plan?.reminder ?? "day-before");
  const [note, setNote] = useState(plan?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const today = todayInManila();

  function startEditing() {
    setDate(plan && plan.date >= today ? plan.date : "");
    setTime(plan?.time ?? "");
    setReminder(plan?.reminder ?? "day-before");
    setNote(plan?.note ?? "");
    setError("");
    setEditing(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = planInputSchema.safeParse({ date, time, note, reminder });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the plan.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await passport.savePlan(place.id, parsed.data);
      setEditing(false);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The plan could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function removePlan() {
    setSaving(true);
    setError("");
    try {
      // A place we have been to goes back to visited, otherwise to want-to-visit.
      await passport.setPlaceStatus(place.id, togglePlannedStatus(place));
      setEditing(false);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The plan could not be removed.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form className="plan-form" onSubmit={(event) => void save(event)} aria-label={`Plan a visit to ${place.name}`}>
        <div className="plan-form__row">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} min={today} required onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="field">
            <span>Time <small>(optional)</small></span>
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Email reminder</span>
          <select value={reminder} onChange={(event) => setReminder(event.target.value as PlanReminder)}>
            {reminderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {reminder !== "none" && (
            <small className="field-hint">
              {!passport.serverMode
                ? "Emails go out once the app is connected to its database."
                : passport.settings.planReminders ? "Sent to both of you." : "Sent to your partner. Yours are off in Profile."}
            </small>
          )}
        </label>
        <label className="field">
          <span>Note <small>(optional)</small></span>
          <input value={note} maxLength={200} placeholder="Book a table, bring an umbrella" onChange={(event) => setNote(event.target.value)} />
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="plan-form__actions">
          <button type="submit" className="button button--primary" disabled={saving}>{saving ? "Saving…" : "Save plan"}</button>
          <button type="button" className="button button--secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
        </div>
      </form>
    );
  }

  if (place.status !== "planned") {
    return (
      <button type="button" className="detail-toggle" onClick={startEditing}>
        <CalendarPlus size={19} aria-hidden="true" /> Plan a visit
      </button>
    );
  }

  const passed = Boolean(plan && plan.date < today);
  return (
    <div className="plan-summary">
      <p className="plan-summary__when">
        <CalendarPlus size={18} aria-hidden="true" />
        <span>{plan ? <>{formatPlanDate(plan.date, plan.time)}{passed && <small> · passed</small>}</> : "Planned, no date yet"}</span>
      </p>
      {plan && (
        <p className="plan-summary__reminder">
          {plan.reminder === "none" ? <BellOff size={15} aria-hidden="true" /> : <Bell size={15} aria-hidden="true" />}
          {plan.reminder === "none" ? "No reminder" : `Email ${reminderLabel(plan.reminder).replace(/^./, (first) => first.toLowerCase())}${plan.reminderSent ? " · sent" : ""}`}
        </p>
      )}
      {plan?.note && <p className="plan-summary__note">{plan.note}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="plan-summary__actions">
        <button type="button" className="text-button" onClick={startEditing} disabled={saving}>{plan && !passed ? "Change" : "Pick a date"}</button>
        <button type="button" className="text-button" onClick={() => void removePlan()} disabled={saving}>Remove plan</button>
      </div>
    </div>
  );
}
