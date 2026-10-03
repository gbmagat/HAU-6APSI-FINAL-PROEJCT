import "server-only";

import { getPool } from "@/lib/db";
import type {
  DiscussionComment,
  Member,
  Place,
  PlaceCategory,
  PostPhoto,
  ReactionSummary,
  ReactionType,
  Review,
  ReviewProgress,
  VisitPost,
  VisitStatus,
} from "@/lib/domain";

type MemberRow = { id: string; display_name: string; role: Member["role"] };
type PlaceRow = {
  id: string;
  slug: string;
  name: string;
  category: PlaceCategory;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  initials: string;
  short_description: string;
  opening_note: string | null;
  status: VisitStatus;
  planned_for: string | null;
  favorite: boolean;
  visit_count: number;
};
type VisitRow = {
  id: string;
  place_id: string;
  author_id: string;
  visited_on: string;
  title: string;
  exhibition: string;
  story: string;
  created_at: Date | string;
  review_count: number;
  combined_score: string | number | null;
  own_reviewed: boolean;
};
type ReviewRow = {
  visit_id: string;
  author_id: string;
  overall: number;
  reflection: string;
  would_visit_again: Review["wouldVisitAgain"];
  submitted_at: Date | string;
};
type CommentRow = {
  id: string;
  visit_id: string;
  author_id: string;
  body: string;
  created_at: Date | string;
};
type ReactionRow = { visit_id: string; author_id: string; type: ReactionType };
type PhotoRow = { id: string; visit_id: string; alt_text: string };
type SettingsRow = { review_reminders: boolean; location_enabled: boolean };

export type ServerState = {
  places: Place[];
  posts: VisitPost[];
  members: Member[];
  currentMemberId: string;
  settings: { reviewReminders: boolean; locationEnabled: boolean };
};

function initialsFor(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function reviewProgress(visit: VisitRow | undefined): ReviewProgress {
  if (!visit) return "not-started";
  if (visit.review_count === 2) return "ready";
  return visit.own_reviewed ? "partner-review-needed" : "your-review-needed";
}

/** Load only one authenticated member's space; never expose an unfinished partner review. */
export async function loadServerState(spaceId: string, userId: string): Promise<ServerState> {
  const pool = getPool();
  const memberResult = await pool.query<MemberRow>(
    `select u.id, u.display_name, m.role
       from space_members m
       join app_users u on u.id = m.user_id
      where m.space_id = $1
        and exists (select 1 from space_members me where me.space_id = $1 and me.user_id = $2)
      order by case m.role when 'owner' then 0 else 1 end`,
    [spaceId, userId],
  );
  if (!memberResult.rows.some((row) => row.id === userId)) {
    throw new Error("Our Places membership is required.");
  }

  const [placeResult, visitResult, reviewResult, commentResult, reactionResult, photoResult, settingsResult] = await Promise.all([
    pool.query<PlaceRow>(
      `select p.id, p.slug, p.name, p.category, p.address, p.city, p.country,
              p.latitude, p.longitude, p.initials, p.short_description,
              p.opening_note, p.status, to_char(p.planned_for, 'YYYY-MM-DD') as planned_for,
              exists (select 1 from member_favorites f
                       where f.space_id = p.space_id and f.place_id = p.id and f.user_id = $2) as favorite,
              (select count(*)::integer from visits v
                where v.space_id = p.space_id and v.place_id = p.id) as visit_count
         from places p where p.space_id = $1 order by p.name`,
      [spaceId, userId],
    ),
    pool.query<VisitRow>(
      `select v.id, v.place_id, v.author_id,
              to_char(v.visited_on, 'YYYY-MM-DD') as visited_on,
              v.title, v.exhibition, v.story, v.created_at,
              s.review_count, s.combined_score,
              exists (select 1 from reviews mine
                       where mine.visit_id = v.id and mine.author_id = $2) as own_reviewed
         from visits v
         join visit_review_summary s on s.visit_id = v.id and s.space_id = v.space_id
        where v.space_id = $1 order by v.created_at desc, v.id desc`,
      [spaceId, userId],
    ),
    pool.query<ReviewRow>(
      `select r.visit_id, r.author_id, r.overall, r.reflection,
              r.would_visit_again, r.submitted_at
         from reviews r
         join visit_review_summary s on s.visit_id = r.visit_id and s.space_id = r.space_id
        where r.space_id = $1 and (r.author_id = $2 or s.review_count = 2)
        order by r.submitted_at, r.author_id`,
      [spaceId, userId],
    ),
    pool.query<CommentRow>(
      `select id, visit_id, author_id, body, created_at
         from comments where space_id = $1 order by created_at, id`,
      [spaceId],
    ),
    pool.query<ReactionRow>(
      `select visit_id, author_id, type from reactions where space_id = $1`,
      [spaceId],
    ),
    pool.query<PhotoRow>(
      `select id, visit_id, alt_text from visit_photos
        where space_id = $1 order by created_at, id`,
      [spaceId],
    ),
    pool.query<SettingsRow>(
      `select review_reminders, location_enabled from member_settings
        where space_id = $1 and user_id = $2`,
      [spaceId, userId],
    ),
  ]);

  const members: Member[] = memberResult.rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    initials: initialsFor(row.display_name),
    role: row.role,
  }));
  const memberById = new Map(members.map((member) => [member.id, member]));

  const latestVisitByPlace = new Map<string, VisitRow>();
  for (const visit of visitResult.rows) {
    if (!latestVisitByPlace.has(visit.place_id)) latestVisitByPlace.set(visit.place_id, visit);
  }
  const places: Place[] = placeResult.rows.map((row) => {
    const latest = latestVisitByPlace.get(row.id);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      category: row.category,
      address: row.address,
      city: row.city,
      country: row.country,
      latitude: row.latitude,
      longitude: row.longitude,
      initials: row.initials,
      shortDescription: row.short_description,
      openingNote: row.opening_note ?? undefined,
      status: row.status,
      favorite: row.favorite,
      combinedScore: latest?.combined_score == null ? null : Number(latest.combined_score),
      reviewProgress: reviewProgress(latest),
      visitCount: row.visit_count,
      nextVisitDate: row.planned_for ?? undefined,
    };
  });
  const placeById = new Map(places.map((place) => [place.id, place]));

  const reviewsByVisit = new Map<string, Review[]>();
  for (const row of reviewResult.rows) {
    const author = memberById.get(row.author_id);
    if (!author) throw new Error("A review has no member in this space.");
    const review: Review = {
      id: `${row.visit_id}:${row.author_id}`,
      author,
      ratings: { overall: row.overall },
      body: row.reflection,
      wouldVisitAgain: row.would_visit_again,
      submittedAt: iso(row.submitted_at),
    };
    reviewsByVisit.set(row.visit_id, [...(reviewsByVisit.get(row.visit_id) ?? []), review]);
  }

  const commentsByVisit = new Map<string, DiscussionComment[]>();
  for (const row of commentResult.rows) {
    const comment: DiscussionComment = {
      id: row.id,
      authorId: row.author_id,
      body: row.body,
      createdAt: iso(row.created_at),
    };
    commentsByVisit.set(row.visit_id, [...(commentsByVisit.get(row.visit_id) ?? []), comment]);
  }

  const reactionsByVisit = new Map<string, ReactionRow[]>();
  for (const row of reactionResult.rows) {
    reactionsByVisit.set(row.visit_id, [...(reactionsByVisit.get(row.visit_id) ?? []), row]);
  }

  const photosByVisit = new Map<string, PostPhoto[]>();
  for (const row of photoResult.rows) {
    const photo: PostPhoto = { url: `/api/photos/${row.id}`, alt: row.alt_text || undefined };
    photosByVisit.set(row.visit_id, [...(photosByVisit.get(row.visit_id) ?? []), photo]);
  }

  const posts: VisitPost[] = visitResult.rows.map((row) => {
    const place = placeById.get(row.place_id);
    const author = memberById.get(row.author_id);
    if (!place || !author) throw new Error("An experience has no place or member in this space.");
    const postReactions = reactionsByVisit.get(row.id) ?? [];
    const reactionTypes = [...new Set(postReactions.map((reaction) => reaction.type))];
    const reactions: ReactionSummary[] = (reactionTypes.length ? reactionTypes : ["love" as const]).map((type) => ({
      type,
      count: postReactions.filter((reaction) => reaction.type === type).length,
      selected: postReactions.some((reaction) => reaction.type === type && reaction.author_id === userId),
    }));
    const discussion = commentsByVisit.get(row.id) ?? [];
    return {
      id: row.id,
      place,
      author,
      visitedOn: row.visited_on,
      exhibition: row.exhibition,
      title: row.title,
      story: row.story,
      photos: photosByVisit.get(row.id) ?? [],
      reviews: reviewsByVisit.get(row.id) ?? [],
      comments: discussion.length,
      reactions,
      discussion,
      reactedBy: postReactions.map((reaction) => reaction.author_id),
      createdAt: iso(row.created_at),
    };
  });

  return {
    places,
    posts,
    members,
    currentMemberId: userId,
    settings: {
      reviewReminders: settingsResult.rows[0]?.review_reminders ?? true,
      locationEnabled: settingsResult.rows[0]?.location_enabled ?? false,
    },
  };
}
