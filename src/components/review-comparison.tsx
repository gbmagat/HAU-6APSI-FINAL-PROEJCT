import { LockKeyhole, RotateCcw, Star } from "lucide-react";

import type { Review } from "@/lib/domain";
import { combinedOverallScore } from "@/lib/rating";

const revisitLabels = { yes: "Yes", maybe: "Maybe", no: "No" };

function RatingStars({ value }: { value: number }) {
  return (
    <span className="rating-stars" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={16}
          fill={index < value ? "currentColor" : "none"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function ReviewComparison({ reviews }: { reviews: Review[] }) {
  const combinedScore = combinedOverallScore(reviews);

  if (reviews.length < 2) {
    return (
      <section className="review-waiting" aria-labelledby="review-status-title">
        <LockKeyhole size={28} aria-hidden="true" />
        <div>
          <p className="eyebrow">Blind rating reveal</p>
          <h3 id="review-status-title">Waiting for both reviews</h3>
          <p>
            One review is safely submitted. Its scores remain hidden until the
            second member responds.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="review-comparison" aria-labelledby="comparison-title">
      <header className="review-comparison__header">
        <div>
          <p className="eyebrow">Both reviews are ready</p>
          <h3 id="comparison-title">Two perspectives, one shared result</h3>
        </div>
        <div className="shared-score" aria-label={`Combined score ${combinedScore}`}>
          <span>{combinedScore}</span>
          <small>Shared score</small>
        </div>
      </header>

      <div className="review-comparison__grid">
        {reviews.map((review) => (
          <article key={review.id} className="personal-review">
            <header>
              <span className="avatar">{review.author.initials}</span>
              <div>
                <h4>{review.author.displayName}&apos;s review</h4>
                <RatingStars value={review.ratings.overall} />
              </div>
            </header>
            <p>{review.body}</p>
            <footer>
              Would visit again:{" "}
              <strong>{revisitLabels[review.wouldVisitAgain]}</strong>
            </footer>
          </article>
        ))}
      </div>

      <p className="review-comparison__note">
        <RotateCcw size={14} aria-hidden="true" />
        The shared score recalculates if either member edits a revealed review.
      </p>
    </section>
  );
}
