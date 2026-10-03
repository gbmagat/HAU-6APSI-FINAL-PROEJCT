export type VisitStatus = "want-to-visit" | "planned" | "visited";

export const planReminders = ["morning", "day-before", "week-before", "none"] as const;

export type PlanReminder = (typeof planReminders)[number];

/** A planned visit; the date and optional time are in Philippine time. */
export type PlacePlan = {
  date: string;
  time?: string;
  note?: string;
  reminder: PlanReminder;
  reminderSent?: boolean;
};

export type ReviewProgress =
  | "not-started"
  | "your-review-needed"
  | "partner-review-needed"
  | "ready";

export const placeCategories = ["Museum", "Cafe", "Restaurant", "Park", "Heritage", "District", "Gallery", "Walk"] as const;

export type PlaceCategory = (typeof placeCategories)[number];

export type Place = {
  id: string;
  slug: string;
  name: string;
  category: PlaceCategory;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  status: VisitStatus;
  favorite: boolean;
  combinedScore: number | null;
  reviewProgress: ReviewProgress;
  visitCount: number;
  plan?: PlacePlan;
  initials: string;
  shortDescription: string;
  openingNote?: string;
};

export type Member = {
  id: string;
  displayName: string;
  initials: string;
  role: "owner" | "partner";
};

export const ratingCriteria = [
  "collection",
  "curation",
  "atmosphere",
  "visitorExperience",
  "accessibility",
  "value",
  "overall",
] as const;

export type RatingCriterion = (typeof ratingCriteria)[number];

export type ReviewRatings = Record<RatingCriterion, number>;

export type Review = {
  id: string;
  author: Member;
  ratings: Pick<ReviewRatings, "overall"> & Partial<Omit<ReviewRatings, "overall">>;
  wouldVisitAgain: "yes" | "maybe" | "no";
  body: string;
  submittedAt: string;
  editedAt?: string;
};

export type ReactionType = "like" | "love" | "insightful" | "surprised";

export type ReactionSummary = {
  type: ReactionType;
  count: number;
  selected: boolean;
};

export type PostPhoto = {
  url: string;
  alt?: string;
};

export type VisitPost = {
  id: string;
  place: Place;
  author: Member;
  visitedOn: string;
  exhibition: string;
  title: string;
  story: string;
  photos?: PostPhoto[];
  reviews: Review[];
  comments: number;
  reactions: ReactionSummary[];
  discussion?: DiscussionComment[];
  reactedBy?: string[];
  createdAt: string;
};

export type DiscussionComment = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type PassportMetric = {
  label: string;
  value: string;
  supportingText: string;
  icon: "museum" | "map" | "star" | "clock";
};
