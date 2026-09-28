import type { Review, ReviewProgress, ReviewRatings, VisitPost } from "@/lib/domain";

const MIN_RATING = 1;
const MAX_RATING = 5;

export function isRating(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_RATING && value <= MAX_RATING;
}

export function averageRatings(ratings: ReviewRatings): number {
  const values = Object.values(ratings);

  if (values.length === 0 || values.some((value) => !isRating(value))) {
    throw new RangeError("Every rating must be an integer from 1 to 5.");
  }

  return roundToOneDecimal(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}

export function combinedOverallScore(reviews: Review[]): number | null {
  if (reviews.length !== 2) {
    return null;
  }

  const [first, second] = reviews;

  if (!isRating(first.ratings.overall) || !isRating(second.ratings.overall)) {
    throw new RangeError("Overall ratings must be integers from 1 to 5.");
  }

  return roundToOneDecimal(
    (first.ratings.overall + second.ratings.overall) / 2,
  );
}

export function reviewRevealState(reviewCount: number):
  | "none"
  | "waiting"
  | "ready" {
  if (reviewCount <= 0) return "none";
  if (reviewCount === 1) return "waiting";
  return "ready";
}

/** Your own review is always visible to you; your partner's stays hidden until both exist. */
export function visibleReviews(reviews: Review[], viewerId: string): Review[] {
  return reviews.length >= 2 ? reviews : reviews.filter((review) => review.author.id === viewerId);
}

/** Mirrors the server: progress follows the latest visit, seen from the viewer's side. */
export function reviewProgressFor(post: Pick<VisitPost, "reviews"> | undefined, viewerId: string): ReviewProgress {
  if (!post) return "not-started";
  if (post.reviews.length >= 2) return "ready";
  return post.reviews.some((review) => review.author.id === viewerId) ? "partner-review-needed" : "your-review-needed";
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
