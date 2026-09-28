import {
  Bookmark,
  CalendarDays,
  Check,
  Clock3,
  Heart,
  Pencil,
} from "lucide-react";

import type { Place, ReviewProgress, VisitStatus } from "@/lib/domain";

const statusLabels: Record<VisitStatus, string> = {
  "want-to-visit": "Want to Visit",
  planned: "Planned",
  visited: "Visited",
};

const statusIcons = {
  "want-to-visit": Bookmark,
  planned: CalendarDays,
  visited: Check,
};

const reviewLabels: Record<ReviewProgress, string | null> = {
  "not-started": null,
  "your-review-needed": "Your review is needed",
  "partner-review-needed": "Waiting for partner",
  ready: "Both reviews are ready",
};

export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  const Icon = statusIcons[status];

  return (
    <span className={`status-badge status-badge--${status}`}>
      <Icon size={14} aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}

export function PlaceBadges({ place }: { place: Place }) {
  const reviewLabel = reviewLabels[place.reviewProgress];
  const ReviewIcon =
    place.reviewProgress === "your-review-needed" ? Pencil : Clock3;

  return (
    <div className="badge-row">
      <VisitStatusBadge status={place.status} />
      {place.favorite && (
        <span className="status-badge status-badge--favorite">
          <Heart size={14} fill="currentColor" aria-hidden="true" />
          Favorite
        </span>
      )}
      {reviewLabel && place.reviewProgress !== "ready" && (
        <span className="status-badge status-badge--review">
          <ReviewIcon size={14} aria-hidden="true" />
          {reviewLabel}
        </span>
      )}
    </div>
  );
}
