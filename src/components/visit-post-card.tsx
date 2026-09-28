"use client";

import { Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { usePassport } from "@/components/passport-provider";
import type { VisitPost } from "@/lib/domain";
import { postStatusLabel } from "@/lib/feed";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`)).toUpperCase();
}

export function VisitPostCard({ post }: { post: VisitPost }) {
  const passport = usePassport();
  const livePost = passport.posts.find((candidate) => candidate.id === post.id) ?? post;
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const reacted = livePost.reactedBy?.includes(passport.currentMember.id) ?? livePost.reactions.some((reaction) => reaction.selected);
  const reactionCount = livePost.reactions.reduce((total, reaction) => total + reaction.count, 0);
  const discussion = livePost.discussion ?? [];
  const commentCount = livePost.comments;
  const postStatus = postStatusLabel(livePost);

  function failure(message: string) {
    setError(message);
    if (typeof window !== "undefined") window.alert(message);
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = comment.trim();
    if (!body) return;
    try {
      await passport.addComment(livePost.id, body);
      setComment("");
      setCommentOpen(true);
      setError("");
    } catch {
      failure("We couldn’t save that comment. Please try again.");
    }
  }

  async function toggleReaction() {
    try {
      await passport.toggleReaction(livePost.id);
      setError("");
    } catch {
      failure("We couldn’t save your reaction. Please try again.");
    }
  }

  async function deletePost() {
    if (!window.confirm(passport.serverMode ? "Permanently delete this shared experience for both of you?" : "Delete this shared experience from the browser preview?")) return;
    try {
      await passport.deletePost(livePost.id);
    } catch {
      failure("We couldn’t delete this experience. Please try again.");
    }
  }

  return (
    <article className="visit-post">
      <header className="visit-post__header">
        <div className="post-author"><span className="avatar">{livePost.author.initials}</span><div><strong>{livePost.author.displayName}</strong><span>{formatDate(livePost.visitedOn)} · {livePost.place.city.toUpperCase()}</span></div></div>
        <div className="post-header-actions">
          <span className={`status-chip ${postStatus === "Favorite" ? "status-chip--favorite" : postStatus === "Pending" ? "status-chip--pending" : ""}`}><span aria-hidden="true">{postStatus[0]}</span>{postStatus}</span>
          {livePost.author.id === passport.currentMember.id && <button type="button" className="icon-button" onClick={deletePost} aria-label="Delete experience"><Trash2 size={16} aria-hidden="true" /></button>}
        </div>
      </header>
      <div className="visit-post__content">
        {livePost.photoUrl && <div className="visit-post__photo" role="img" aria-label={livePost.photoAlt || "Shared place photo"} style={{ backgroundImage: `url(${livePost.photoUrl})` }} />}
        <div className="visit-post__story"><Link href={`/places/${livePost.place.slug}`}>{livePost.place.name}</Link>{livePost.title && <h3>{livePost.title}</h3>}<p>{livePost.story}</p></div>
      </div>
      <footer className="visit-post__footer">
        <button type="button" className={reacted ? "post-action is-selected" : "post-action"} aria-pressed={reacted} onClick={toggleReaction}><Heart size={17} fill={reacted ? "currentColor" : "none"} aria-hidden="true" /> React · {reactionCount}</button>
        <button type="button" className="post-action" aria-expanded={commentOpen} onClick={() => setCommentOpen((open) => !open)}><MessageCircle size={17} aria-hidden="true" /> Comment · {commentCount}</button>
      </footer>
      {error && <p className="field-error" role="alert">{error}</p>}
      {commentOpen && <div className="comment-thread">{discussion.map((entry) => <p key={entry.id}><strong>{entry.authorId === passport.currentMember.id ? "You" : "Your partner"}</strong> {entry.body}</p>)}<form className="comment-composer" onSubmit={submitComment}><label className="sr-only" htmlFor={`comment-${livePost.id}`}>Add a private comment</label><input id={`comment-${livePost.id}`} value={comment} maxLength={240} placeholder="Add a private comment" onChange={(event) => setComment(event.target.value)} autoFocus /><button type="submit" className="icon-button" aria-label="Post comment"><Send size={18} aria-hidden="true" /></button></form></div>}
    </article>
  );
}
