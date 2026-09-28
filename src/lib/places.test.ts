import { describe, expect, it } from "vitest";

import type { Member, Place, Review, VisitPost, VisitStatus } from "@/lib/domain";
import {
  archiveTimeline,
  matchesPlaceQuery,
  pickNextPlace,
  placesBounds,
  sharedScoreLabel,
  togglePlannedStatus,
  withDerivedReviewState,
} from "@/lib/places";

const place = (slug: string, status: VisitStatus, extra: Partial<Place> = {}) =>
  ({ id: slug, slug, status, visitCount: 0, combinedScore: null, reviewProgress: "not-started", ...extra }) as Place;

const gab = { id: "gab" } as Member;
const partner = { id: "m" } as Member;
const review = (author: Member, overall: number) => ({ author, ratings: { overall } }) as Review;
const post = (placeId: string, createdAt: string, reviews: Review[], visitedOn = createdAt.slice(0, 10)) =>
  ({ place: { id: placeId }, createdAt, visitedOn, reviews }) as VisitPost;

describe("pickNextPlace", () => {
  it("prefers a planned place over one we only want to visit", () => {
    const places = [place("visited", "visited"), place("someday", "want-to-visit"), place("booked", "planned")];
    expect(pickNextPlace(places)?.slug).toBe("booked");
  });

  it("falls back to a want-to-visit place", () => {
    expect(pickNextPlace([place("visited", "visited"), place("someday", "want-to-visit")])?.slug).toBe("someday");
  });

  it("never offers a place we already visited", () => {
    expect(pickNextPlace([place("visited", "visited")])).toBeUndefined();
  });
});

describe("togglePlannedStatus", () => {
  it("plans any place that is not planned yet", () => {
    expect(togglePlannedStatus(place("a", "want-to-visit"))).toBe("planned");
    expect(togglePlannedStatus(place("b", "visited", { visitCount: 2 }))).toBe("planned");
  });

  it("returns a place with visits to visited when un-planned, not want-to-visit", () => {
    expect(togglePlannedStatus(place("a", "planned", { visitCount: 2 }))).toBe("visited");
    expect(togglePlannedStatus(place("b", "planned", { visitCount: 0 }))).toBe("want-to-visit");
  });
});

describe("sharedScoreLabel", () => {
  it("shows the score, a waiting state, or nothing to wait for", () => {
    expect(sharedScoreLabel({ combinedScore: 4.5, visitCount: 1 })).toBe("4.5");
    expect(sharedScoreLabel({ combinedScore: 5, visitCount: 1 })).toBe("5.0");
    expect(sharedScoreLabel({ combinedScore: null, visitCount: 1 })).toBe("Waiting");
    expect(sharedScoreLabel({ combinedScore: null, visitCount: 0 })).toBe("No reviews yet");
  });
});

describe("matchesPlaceQuery", () => {
  const luna = { name: "Luna Café", city: "Makati", category: "Cafe" } as const;

  it("matches name, city, or category regardless of case and accents", () => {
    expect(matchesPlaceQuery(luna, "cafe")).toBe(true);
    expect(matchesPlaceQuery(luna, "CAFÉ")).toBe(true);
    expect(matchesPlaceQuery(luna, "  makati ")).toBe(true);
    expect(matchesPlaceQuery(luna, "")).toBe(true);
    expect(matchesPlaceQuery(luna, "museum")).toBe(false);
  });
});

describe("withDerivedReviewState", () => {
  const places = [place("cafe", "visited"), place("park", "planned")];

  it("derives score and progress from the latest visit for the current viewer", () => {
    const posts = [post("cafe", "2026-07-01T10:00:00Z", [review(gab, 4), review(partner, 5)]), post("cafe", "2026-08-01T10:00:00Z", [review(gab, 3)])];
    const forGab = withDerivedReviewState(places, posts, gab.id);
    const forPartner = withDerivedReviewState(places, posts, partner.id);

    expect(forGab[0]).toMatchObject({ combinedScore: null, reviewProgress: "partner-review-needed" });
    expect(forPartner[0]).toMatchObject({ combinedScore: null, reviewProgress: "your-review-needed" });
    expect(forGab[1]).toMatchObject({ combinedScore: null, reviewProgress: "not-started" });
  });

  it("reveals the combined score once both reviews on the latest visit exist", () => {
    const posts = [post("cafe", "2026-08-01T10:00:00Z", [review(gab, 4), review(partner, 5)])];
    expect(withDerivedReviewState(places, posts, gab.id)[0]).toMatchObject({ combinedScore: 4.5, reviewProgress: "ready" });
  });

  it("clears the score when the last visit is deleted", () => {
    const stale = place("cafe", "visited", { combinedScore: 5, reviewProgress: "ready" });
    expect(withDerivedReviewState([stale], [], gab.id)[0]).toMatchObject({ combinedScore: null, reviewProgress: "not-started" });
  });
});

describe("archiveTimeline", () => {
  it("lists only visited places, most recent visit first, up to the limit", () => {
    const places = [place("old", "visited"), place("planned", "planned"), place("recent", "visited"), place("marked", "visited"), place("middle", "visited")];
    const posts = [post("old", "2026-01-05T00:00:00Z", []), post("recent", "2026-09-01T00:00:00Z", []), post("middle", "2026-05-01T00:00:00Z", [])];

    expect(archiveTimeline(places, posts).map((item) => item.slug)).toEqual(["recent", "middle", "old"]);
    expect(archiveTimeline(places, posts, 10).map((item) => item.slug)).toEqual(["recent", "middle", "old", "marked"]);
  });
});

describe("placesBounds", () => {
  it("wraps every place so the map can show them all", () => {
    const manila = { latitude: 14.5869, longitude: 120.9816 };
    const antipolo = { latitude: 14.5812, longitude: 121.1669 };
    const escolta = { latitude: 14.5967, longitude: 120.9782 };
    expect(placesBounds([manila, antipolo, escolta])).toEqual([[14.5812, 120.9782], [14.5967, 121.1669]]);
  });

  it("ignores missing or impossible coordinates and returns null when nothing is left", () => {
    expect(placesBounds([])).toBeNull();
    expect(placesBounds([{ latitude: Number.NaN, longitude: 121 }, { latitude: 95, longitude: 121 }])).toBeNull();
    expect(placesBounds([{ latitude: 14.5, longitude: 121 }, { latitude: Number.NaN, longitude: 0 }])).toEqual([[14.5, 121], [14.5, 121]]);
  });
});
