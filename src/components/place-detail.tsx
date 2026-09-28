"use client";

import { CalendarPlus, Heart, MapPin, Plus, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ReviewComparison } from "@/components/review-comparison";
import { usePassport } from "@/components/passport-provider";
import { PlaceBadges } from "@/components/status-badge";
import { sharedScoreLabel, togglePlannedStatus } from "@/lib/places";
import { visibleReviews } from "@/lib/rating";

export function PlaceDetail({ slug }: { slug: string }) {
  const passport = usePassport();
  const place = passport.places.find((candidate) => candidate.slug === slug);
  const visiblePosts = passport.posts.filter((post) => post.place.slug === slug);
  const [rating, setRating] = useState(0);
  const [reflection, setReflection] = useState("");
  const [revisit, setRevisit] = useState<"yes" | "maybe" | "no">("yes");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const pendingPost = visiblePosts.find((post) => !post.reviews.some((review) => review.author.id === passport.currentMember.id));
  const comparisonPost = visiblePosts.find((post) => post.reviews.length >= 2);

  async function toggleFavorite() {
    if (!place) return;
    try { await passport.toggleFavorite(place.id); setMessage(""); } catch { const text = "We couldn’t save that favorite."; setMessage(text); window.alert(text); }
  }

  async function togglePlanned() {
    if (!place) return;
    try { await passport.setPlaceStatus(place.id, togglePlannedStatus(place)); setMessage(""); } catch { const text = "We couldn’t save that visit plan."; setMessage(text); window.alert(text); }
  }

  async function submitReviewForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingPost || rating < 1 || reflection.trim().length < 8) {
      setMessage("Choose a rating and write at least eight characters.");
      return;
    }
    setSubmitting(true);
    try {
      await passport.submitReview(pendingPost.id, { rating, reflection: reflection.trim(), revisit });
      setRating(0); setReflection(""); setMessage("Your review is saved. The shared result appears after both reviews.");
    } catch { const text = "We couldn’t save that review. Please try again."; setMessage(text); window.alert(text); }
    finally { setSubmitting(false); }
  }

  if (!passport.ready) return <p className="empty-state">Loading place…</p>;
  if (!place) return <p className="empty-state">This place was not found. <Link href="/map">Browse places</Link></p>;

  return (
    <>
      <section className="place-detail-layout">
        <div className="place-detail-main">
          <section className="place-detail-hero"><span className="place-detail-monogram" aria-hidden="true">{place.initials}</span><div className="place-detail-copy"><PlaceBadges place={place} /><h1>{place.name}</h1><p>{place.city} · {place.category}{place.openingNote ? ` · ${place.openingNote}` : ""}</p><p>{place.shortDescription}</p><div className="place-detail-actions"><Link href={`/visits/new?place=${place.slug}`} className="button button--primary"><Plus size={18} aria-hidden="true" /> Log experience</Link><Link href="/map" className="button button--secondary"><MapPin size={18} aria-hidden="true" /> Open map</Link></div></div></section>

          {pendingPost && <form className="memory-entry" aria-labelledby="partner-review-title" onSubmit={submitReviewForm}><header><div><p className="eyebrow">Private review</p><h2 id="partner-review-title">Add your perspective</h2></div><span>{rating ? `${rating} / 5` : "Not rated"}</span></header><div className="rating-input" role="radiogroup" aria-label="Review rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} of 5`} className={rating >= value ? "is-selected" : ""} onClick={() => setRating(value)}><Star size={25} fill={rating >= value ? "currentColor" : "none"} aria-hidden="true" /></button>)}</div><label className="field"><span className="sr-only">Reflection</span><textarea rows={4} value={reflection} maxLength={500} placeholder="What stayed with you?" onChange={(event) => setReflection(event.target.value)} /></label><fieldset className="choice-group"><legend>Would you visit again?</legend>{(["yes", "maybe", "no"] as const).map((choice) => <label key={choice}><input type="radio" name="revisit" value={choice} checked={revisit === choice} onChange={() => setRevisit(choice)} /> {choice === "yes" ? "Yes" : choice === "maybe" ? "Maybe" : "No"}</label>)}</fieldset><button type="submit" className="button button--primary" disabled={submitting}>{submitting ? "Saving…" : "Submit private review"}</button><p className="form-status" role="status">{message}</p></form>}

          <section className="place-notes" aria-labelledby="place-notes-title"><h2 id="place-notes-title">Shared notes</h2>{visiblePosts.flatMap((post) => [<article key={`${post.id}-story`}>{post.photoUrl && <div className="note-photo" style={{ backgroundImage: `url(${post.photoUrl})` }} role="img" aria-label={post.photoAlt ?? "Shared place photo"} />}<span className="avatar">{post.author.initials}</span><div><strong>{post.author.displayName} · {post.visitedOn}</strong><p>{post.story}</p></div></article>, ...visibleReviews(post.reviews, passport.currentMember.id).map((review) => <article key={review.id}><span className="avatar">{review.author.initials}</span><div><strong>{review.author.displayName}&apos;s review</strong><p>{review.body}</p></div></article>)])}{!visiblePosts.length && <p>No notes yet. Log the first experience above.</p>}</section>
        </div>
        <aside className="place-detail-sidebar"><section><h2>Our place</h2><button type="button" className={place.favorite ? "detail-toggle is-active" : "detail-toggle"} aria-pressed={place.favorite} onClick={() => void toggleFavorite()}><Heart size={19} fill={place.favorite ? "currentColor" : "none"} aria-hidden="true" />{place.favorite ? "Favorite" : "Add favorite"}</button><button type="button" className={place.status === "planned" ? "detail-toggle is-active" : "detail-toggle"} aria-pressed={place.status === "planned"} onClick={() => void togglePlanned()}><CalendarPlus size={19} aria-hidden="true" />{place.status === "planned" ? "Planned" : "Plan a visit"}</button></section><section><h2>Visit details</h2><dl><div><dt>City</dt><dd>{place.city}</dd></div><div><dt>Category</dt><dd>{place.category}</dd></div><div><dt>Visits</dt><dd>{place.visitCount}</dd></div><div><dt>Shared score</dt><dd>{sharedScoreLabel(place)}</dd></div></dl></section>{message && !pendingPost && <p className="form-status" role="status">{message}</p>}</aside>
      </section>
      {comparisonPost && <ReviewComparison reviews={comparisonPost.reviews} />}
    </>
  );
}
