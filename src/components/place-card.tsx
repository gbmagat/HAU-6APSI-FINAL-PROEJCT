import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { VisitStatusBadge } from "@/components/status-badge";
import type { Place } from "@/lib/domain";

export function PlaceCard({ place }: { place: Place }) {
  const href = `/places/${place.slug}`;

  return (
    <article className="place-card">
      <div className="place-card__main">
        <div className="place-thumbnail" aria-hidden="true">{place.initials}</div>
        <div className="place-card__identity">
          <Link href={href} className="place-card__title" aria-label={`View ${place.name}`}>{place.name}</Link>
          <small>{place.city} · {place.category}</small>
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
