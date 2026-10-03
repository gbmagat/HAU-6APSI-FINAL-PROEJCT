import { describe, expect, it } from "vitest";

import type { Review, VisitPost } from "@/lib/domain";
import { filterPosts, postStatusLabel } from "@/lib/feed";

const one = [{}] as Review[];
const two = [{}, {}] as Review[];
const post = (id: string, reviews: Review[], extra: Partial<VisitPost> = {}) =>
  ({ id, reviews, place: { favorite: false }, ...extra }) as VisitPost;

describe("filterPosts", () => {
  const posts = [post("pending", one), post("revealed", two), post("photo", two, { photos: [{ url: "data:image/jpeg;base64,AA" }] }), post("no-photos", two, { photos: [] })];

  it("keeps every post for all stories", () => {
    expect(filterPosts(posts, "all")).toHaveLength(4);
  });

  it("finds posts still waiting for a review", () => {
    expect(filterPosts(posts, "pending").map((item) => item.id)).toEqual(["pending"]);
  });

  it("counts only posts that actually have a photo, not an empty photo list", () => {
    expect(filterPosts(posts, "photos").map((item) => item.id)).toEqual(["photo"]);
  });
});

describe("postStatusLabel", () => {
  it("shows Pending before Favorite so an unfinished review is never hidden", () => {
    expect(postStatusLabel({ reviews: one, place: { favorite: true } })).toBe("Pending");
    expect(postStatusLabel({ reviews: two, place: { favorite: true } })).toBe("Favorite");
    expect(postStatusLabel({ reviews: two, place: { favorite: false } })).toBe("Visited");
  });
});
