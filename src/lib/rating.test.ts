import { describe, expect, it } from "vitest";

import type { Review, ReviewRatings } from "@/lib/domain";
import {
  averageRatings,
  combinedOverallScore,
  isRating,
  reviewProgressFor,
  reviewRevealState,
  visibleReviews,
} from "@/lib/rating";

const ratings: ReviewRatings = {
  collection: 5,
  curation: 4,
  atmosphere: 5,
  visitorExperience: 4,
  accessibility: 3,
  value: 4,
  overall: 5,
};

const makeReview = (overall: number, id: string): Review => ({
  id,
  author: {
    id: `member-${id}`,
    displayName: `Member ${id}`,
    initials: id.toUpperCase(),
    role: id === "a" ? "owner" : "partner",
  },
  ratings: { ...ratings, overall },
  wouldVisitAgain: "yes",
  body: "A thoughtful review.",
  submittedAt: "2026-07-30T10:00:00.000Z",
});

describe("rating rules", () => {
  it("accepts only whole values from one through five", () => {
    expect(isRating(1)).toBe(true);
    expect(isRating(5)).toBe(true);
    expect(isRating(3.5)).toBe(false);
    expect(isRating(0)).toBe(false);
    expect(isRating(6)).toBe(false);
  });

  it("averages the complete museum rubric to one decimal place", () => {
    expect(averageRatings(ratings)).toBe(4.3);
  });

  it("keeps the combined score hidden until both reviews exist", () => {
    expect(combinedOverallScore([])).toBeNull();
    expect(combinedOverallScore([makeReview(5, "a")])).toBeNull();
    expect(
      combinedOverallScore([makeReview(5, "a"), makeReview(4, "b")]),
    ).toBe(4.5);
  });

  it("reports the correct reveal lifecycle", () => {
    expect(reviewRevealState(0)).toBe("none");
    expect(reviewRevealState(1)).toBe("waiting");
    expect(reviewRevealState(2)).toBe("ready");
  });

  it("rejects an invalid rubric value", () => {
    expect(() =>
      averageRatings({ ...ratings, accessibility: 0 }),
    ).toThrowError(RangeError);
  });
});

describe("blind review visibility", () => {
  const mine = makeReview(4, "a");
  const partners = makeReview(5, "b");

  it("hides the partner's review until both members have submitted", () => {
    expect(visibleReviews([partners], mine.author.id)).toEqual([]);
    expect(visibleReviews([mine], mine.author.id)).toEqual([mine]);
    expect(visibleReviews([mine, partners], mine.author.id)).toEqual([mine, partners]);
  });

  it("reports review progress from the viewer's side", () => {
    expect(reviewProgressFor(undefined, mine.author.id)).toBe("not-started");
    expect(reviewProgressFor({ reviews: [mine] }, mine.author.id)).toBe("partner-review-needed");
    expect(reviewProgressFor({ reviews: [mine] }, partners.author.id)).toBe("your-review-needed");
    expect(reviewProgressFor({ reviews: [mine, partners] }, partners.author.id)).toBe("ready");
  });
});
