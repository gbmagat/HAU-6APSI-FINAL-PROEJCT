"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PlaceCard } from "@/components/place-card";
import { VisitPostCard } from "@/components/visit-post-card";
import { usePassport } from "@/components/passport-provider";
import type { Place, VisitPost } from "@/lib/domain";
import { type FeedFilter, filterPosts } from "@/lib/feed";
import { pickNextPlace } from "@/lib/places";

const filterOptions: { value: FeedFilter; label: string }[] = [
  { value: "all", label: "All stories" },
  { value: "photos", label: "With photos" },
  { value: "pending", label: "Review pending" },
];

export function ExperienceFeed({ posts: initialPosts, nextPlace: initialNextPlace }: { posts?: VisitPost[]; nextPlace?: Place }) {
  const passport = usePassport();
  const [filter, setFilter] = useState<FeedFilter>("all");
  const posts = useMemo(() => passport.posts ?? initialPosts ?? [], [initialPosts, passport.posts]);
  const nextPlace = pickNextPlace(passport.places) ?? initialNextPlace;
  const visiblePosts = useMemo(() => filterPosts(posts, filter), [filter, posts]);

  if (!passport.ready) return <div className="loading-panel" role="status">Loading our shared places…</div>;

  const filterButtons = filterOptions.map(({ value, label }) => (
    <button key={value} type="button" className={filter === value ? "filter-chip is-selected" : "filter-chip"} aria-pressed={filter === value} onClick={() => setFilter(value)}>
      {label}
    </button>
  ));

  return (
    <>
      <div className="feed-filter-row" role="group" aria-label="Feed filters">{filterButtons}</div>
      <div className="forum-layout">
        <div className="feed-main">
          <Link href="/visits/new" className="memory-composer">
            <span className="avatar" aria-hidden="true">{passport.currentMember.initials}</span>
            <span><strong>Add a place or moment</strong><small>Where did we go, and what stayed with us?</small></span>
            <span className="button button--primary">Log experience <Plus size={17} aria-hidden="true" /></span>
          </Link>
          <h2 className="section-title">Recently shared</h2>
          <div className="feed-column">{visiblePosts.map((post) => <VisitPostCard key={post.id} post={post} />)}</div>
          {!visiblePosts.length && <div className="empty-state"><h2>{filter === "photos" ? "No stories with photos yet" : filter === "pending" ? "No pending reviews" : "No shared stories yet"}</h2><p>{filter === "pending" ? "Both reviews are ready for every shared experience." : "Log the first memory from a place we visited together."}</p><Link href="/visits/new" className="button button--secondary">Log an experience</Link></div>}
        </div>
        <aside className="context-sidebar" aria-label="Story filters and next place">
          <div className="feed-filter-panel">
            <h2 id="feed-filter-title">Filter stories</h2>
            <div role="group" aria-labelledby="feed-filter-title">{filterButtons}</div>
          </div>
          {nextPlace && <div className="feed-next-place"><h2>Next place</h2><PlaceCard place={nextPlace} /></div>}
        </aside>
      </div>
    </>
  );
}
