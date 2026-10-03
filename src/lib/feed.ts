import type { VisitPost } from "@/lib/domain";

export type FeedFilter = "all" | "photos" | "pending";

export function filterPosts(posts: VisitPost[], filter: FeedFilter): VisitPost[] {
  if (filter === "pending") return posts.filter((post) => post.reviews.length < 2);
  if (filter === "photos") return posts.filter((post) => Boolean(post.photos?.length));
  return posts;
}

/** A pending review needs action, so it outranks a favorite. */
export function postStatusLabel(
  post: Pick<VisitPost, "reviews"> & { place: Pick<VisitPost["place"], "favorite"> },
): "Pending" | "Favorite" | "Visited" {
  if (post.reviews.length < 2) return "Pending";
  return post.place.favorite ? "Favorite" : "Visited";
}
