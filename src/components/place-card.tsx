import { ArrowRight, CalendarDays } from "lucide-react";
import Link from "next/link";

import { VisitStatusBadge } from "@/components/status-badge";
import type { Place } from "@/lib/domain";
import { placeLocation } from "@/lib/places";
import { formatPlanDate } from "@/lib/plans";
import { todayInManila } from "@/lib/visit-form";

export function PlaceCard({ place }: { place: Place }) {
  const href = `/places/${place.slug}`;

  return (
    <article className="place-card">
      <div className="place-card__main">
        <div className="place-thumbnail" aria-hidden="true">{place.initials}</div>
        <div className="place-card__identity">
          <Link href={href} className="place-card__title" aria-label={`View ${place.name}`}>{place.name}</Link>
          <small>{placeLocation(place)} · {place.category}</small>
          {place.plan && place.plan.date >= todayInManila() && (
            <small className="place-card__plan"><CalendarDays size={13} aria-hidden="true" /> {formatPlanDate(place.plan.date, place.plan.time)}</small>
          )}
        </div>
      </div>
      <div className="place-card__footer">
        <VisitStatusBadge status={place.status} />
        <Link href={href} className="button button--compact">
          View <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
