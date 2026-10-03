"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  startTransition,
  useState,
} from "react";

import { members as seedMembers, places as seedPlaces, visitPosts as seedPosts } from "@/lib/mock-data";
import type {
  Member,
  Place,
  Review,
  VisitPost,
  VisitStatus,
} from "@/lib/domain";
import { isSamePlace, newPlaceSchema, placeInitials, slugify, uniqueSlug, type NewPlaceInput } from "@/lib/place-input";
import { withDerivedReviewState } from "@/lib/places";
import type { PlanInput } from "@/lib/plans";

const STORAGE_KEY = "our-places-passport-preview.v1";
const STORAGE_EVENT = "our-places-passport-preview:changed";

type PreviewSettings = {
  reviewReminders: boolean;
  locationEnabled: boolean;
  planReminders: boolean;
};

type NewVisitInput = {
  idempotencyKey: string;
  placeId: string;
  visitedOn: string;
  exhibition: string;
  title: string;
  story: string;
  rating: number;
  reflection: string;
  revisit: "yes" | "maybe" | "no";
  photos?: NewVisitPhoto[];
};

export type NewVisitPhoto = { url: string; alt: string; width: number; height: number };

type ReviewInput = {
  rating: number;
  reflection: string;
  revisit: "yes" | "maybe" | "no";
};

type PreviewState = {
  places: Place[];
  posts: VisitPost[];
  members: Member[];
  currentMemberId: string;
  settings: PreviewSettings;
};

type PassportContextValue = PreviewState & {
  serverMode: boolean;
  ready: boolean;
  storageError: string | null;
  currentMember: Member;
  setCurrentMember: (memberId: string) => void | Promise<void>;
  toggleFavorite: (placeId: string) => void | Promise<void>;
  setPlaceStatus: (placeId: string, status: VisitStatus) => void | Promise<void>;
  savePlan: (placeId: string, plan: PlanInput) => void | Promise<void>;
  addComment: (postId: string, body: string) => void | Promise<void>;
  toggleReaction: (postId: string) => void | Promise<void>;
  saveMemberName: (memberId: string, name: string) => void | Promise<void>;
  updateSettings: (settings: Partial<PreviewSettings>) => void | Promise<void>;
  deletePost: (postId: string) => void | Promise<void>;
  submitReview: (postId: string, review: ReviewInput) => void | Promise<void>;
  addVisit: (input: NewVisitInput, memberId?: string) => string | Promise<string>;
  addPlace: (input: NewPlaceInput) => Promise<{ id: string; slug: string }>;
  resetPreview: () => void;
};

const PassportContext = createContext<PassportContextValue | null>(null);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function seededState(): PreviewState {
  return {
    places: clone(seedPlaces),
    posts: clone(seedPosts),
    members: clone(seedMembers),
    currentMemberId: seedMembers[0]?.id ?? "member-alex",
    settings: { reviewReminders: true, locationEnabled: false, planReminders: true },
  };
}

function emptyState(): PreviewState {
  return { places: [], posts: [], members: [], currentMemberId: "", settings: { reviewReminders: true, locationEnabled: false, planReminders: true } };
}

function initialsFor(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "?";
}

function parsePreviewState(raw: string): PreviewState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PreviewState>;
    if (
      !Array.isArray(parsed.places) ||
      !Array.isArray(parsed.posts) ||
      !Array.isArray(parsed.members) ||
      typeof parsed.currentMemberId !== "string"
    ) {
      return null;
    }
    return {
      places: parsed.places as Place[],
      posts: parsed.posts as VisitPost[],
      members: parsed.members as Member[],
      currentMemberId: parsed.currentMemberId,
      settings: {
        reviewReminders: parsed.settings?.reviewReminders !== false,
        locationEnabled: parsed.settings?.locationEnabled === true,
        planReminders: parsed.settings?.planReminders !== false,
      },
    };
  } catch {
    return null;
  }
}

function readStoredState(): PreviewState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parsePreviewState(raw) : null;
  } catch {
    return null;
  }
}

function syncNested(state: PreviewState): PreviewState {
  const placesById = new Map(state.places.map((place) => [place.id, place]));
  const membersById = new Map(state.members.map((member) => [member.id, member]));
  return {
    ...state,
    posts: state.posts.map((post) => ({
      ...post,
      place: placesById.get(post.place.id) ?? post.place,
      author: membersById.get(post.author.id) ?? post.author,
    })),
  };
}

/** Preview scores and review progress are derived from posts for the current viewer, never hand-patched. */
// Older previews kept a single photo as photoUrl and photoAlt.
function withPhotoList(post: VisitPost & { photoUrl?: string; photoAlt?: string }): VisitPost {
  const { photoUrl, photoAlt, ...rest } = post;
  return { ...rest, photos: rest.photos ?? (photoUrl ? [{ url: photoUrl, alt: photoAlt }] : []) };
}

function normalizePreview(state: PreviewState): PreviewState {
  const posts = state.posts.map(withPhotoList);
  return syncNested({ ...state, posts, places: withDerivedReviewState(state.places, posts, state.currentMemberId) });
}

function getReactions(post: VisitPost, currentMemberId: string) {
  const reacted = post.reactedBy?.includes(currentMemberId) ?? post.reactions.some((item) => item.selected);
  return { reacted, count: post.reactions.reduce((total, item) => total + item.count, 0) };
}

function isPreviewState(value: unknown): value is PreviewState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PreviewState>;
  return Array.isArray(candidate.places) && Array.isArray(candidate.posts) && Array.isArray(candidate.members);
}

async function readServerState(): Promise<PreviewState> {
  const response = await fetch("/api/state", { credentials: "same-origin", cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok || !isPreviewState(data)) {
    throw new Error(data?.error || "Our Places could not load. Please refresh and try again.");
  }
  return syncNested(data);
}

async function sendServerRequest(url: string, body: object): Promise<{ id?: string; slug?: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "The change could not be saved. Please try again.");
  return data ?? {};
}

export function PassportProvider({ children, serverMode }: { children: ReactNode; serverMode: boolean }) {
  const [state, setState] = useState<PreviewState>(() => serverMode ? emptyState() : normalizePreview(seededState()));
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    if (serverMode) {
      void readServerState().then((next) => {
        stateRef.current = next;
        startTransition(() => { setState(next); setReady(true); });
      }).catch((error) => {
        startTransition(() => {
          setStorageError(error instanceof Error ? error.message : "Our Places could not load.");
          setReady(true);
        });
      });
      return;
    }
    const stored = readStoredState();
    if (stored) {
      const normalized = normalizePreview(stored);
      stateRef.current = normalized;
      startTransition(() => setState(normalized));
    } else if (window.localStorage.getItem(STORAGE_KEY)) {
      startTransition(() => setStorageError("This browser has an unreadable preview. Reset it from Profile to start fresh."));
    }
    startTransition(() => setReady(true));

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      const next = parsePreviewState(event.newValue);
      if (!next) {
        setStorageError("Another tab saved an unreadable preview. Reset it from Profile to start fresh.");
        return;
      }
      const normalized = normalizePreview(next);
      stateRef.current = normalized;
      setState(normalized);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [serverMode]);

  async function refreshServerState() {
    const next = await readServerState();
    stateRef.current = next;
    setState(next);
    setStorageError(null);
  }

  async function runServerAction(action: object) {
    await sendServerRequest("/api/actions", action);
    await refreshServerState();
  }

  function commit(next: PreviewState) {
    const normalized = normalizePreview(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
      stateRef.current = normalized;
      setState(normalized);
      setStorageError(null);
    } catch {
      setStorageError("This browser could not save the latest change. Try removing a photo or reset the preview.");
      throw new Error("Preview storage is unavailable");
    }
  }

  function update(mutator: (current: PreviewState) => PreviewState) {
    commit(mutator(clone(stateRef.current)));
  }

  const currentMember = state.members.find((member) => member.id === state.currentMemberId) ?? state.members[0];

  const value: PassportContextValue = {
    ...state,
    serverMode,
    ready,
    storageError,
    currentMember: currentMember ?? { id: "preview", displayName: "You", initials: "Y", role: "owner" },
    setCurrentMember(memberId) {
      if (serverMode) {
        if (memberId !== stateRef.current.currentMemberId) throw new Error("You cannot switch accounts. Sign in as the other member.");
        return;
      }
      if (!stateRef.current.members.some((member) => member.id === memberId)) return;
      update((current) => ({ ...current, currentMemberId: memberId }));
    },
    toggleFavorite(placeId) {
      if (serverMode) return runServerAction({ action: "toggleFavorite", placeId });
      update((current) => ({
        ...current,
        places: current.places.map((place) => place.id === placeId ? { ...place, favorite: !place.favorite } : place),
      }));
    },
    setPlaceStatus(placeId, status) {
      if (serverMode) return runServerAction({ action: "setPlaceStatus", placeId, status });
      update((current) => ({
        ...current,
        places: current.places.map((place) => place.id === placeId
          ? { ...place, status, plan: status === "planned" ? place.plan : undefined }
          : place),
      }));
    },
    savePlan(placeId, plan) {
      if (serverMode) return runServerAction({ action: "savePlan", placeId, plan });
      update((current) => ({
        ...current,
        places: current.places.map((place) => place.id !== placeId ? place : {
          ...place,
          status: "planned",
          plan: { date: plan.date, time: plan.time || undefined, note: plan.note.trim() || undefined, reminder: plan.reminder, reminderSent: false },
        }),
      }));
    },
    addComment(postId, body) {
      if (serverMode) return runServerAction({ action: "addComment", postId, body });
      const trimmed = body.trim();
      if (!trimmed) return;
      update((current) => ({
        ...current,
        posts: current.posts.map((post) => post.id !== postId ? post : {
          ...post,
          comments: post.comments + 1,
          discussion: [
            ...(post.discussion ?? []),
            { id: `comment-${Date.now()}`, authorId: current.currentMemberId, body: trimmed, createdAt: new Date().toISOString() },
          ],
        }),
      }));
    },
    toggleReaction(postId) {
      if (serverMode) return runServerAction({ action: "toggleReaction", postId });
      update((current) => ({
        ...current,
        posts: current.posts.map((post) => {
          if (post.id !== postId) return post;
          const { reacted } = getReactions(post, current.currentMemberId);
          const reactedBy = new Set(post.reactedBy ?? []);
          if (reacted) reactedBy.delete(current.currentMemberId); else reactedBy.add(current.currentMemberId);
          const reactions = post.reactions.map((reaction, index) => index === 0 ? {
            ...reaction,
            count: Math.max(0, reaction.count + (reacted ? -1 : 1)),
            selected: !reacted,
          } : reaction);
          return { ...post, reactions, reactedBy: [...reactedBy] };
        }),
      }));
    },
    saveMemberName(memberId, name) {
      if (serverMode) {
        if (memberId !== stateRef.current.currentMemberId) throw new Error("You can only edit your own name.");
        return runServerAction({ action: "saveMemberName", name });
      }
      const displayName = name.trim().slice(0, 40);
      if (!displayName) return;
      update((current) => ({
        ...current,
        members: current.members.map((member) => member.id === memberId ? { ...member, displayName, initials: initialsFor(displayName) } : member),
      }));
    },
    updateSettings(settings) {
      if (serverMode) return runServerAction({ action: "updateSettings", settings });
      update((current) => ({ ...current, settings: { ...current.settings, ...settings } }));
    },
    deletePost(postId) {
      if (serverMode) return runServerAction({ action: "deletePost", postId });
      update((current) => {
        const post = current.posts.find((item) => item.id === postId);
        if (!post || post.author.id !== current.currentMemberId) return current;
        const place = current.places.find((item) => item.id === post.place.id);
        return {
          ...current,
          posts: current.posts.filter((item) => item.id !== postId),
          places: place ? current.places.map((item) => item.id === place.id ? {
            ...item,
            visitCount: Math.max(0, item.visitCount - 1),
            status: item.visitCount <= 1 && item.status === "visited" ? "want-to-visit" : item.status,
          } : item) : current.places,
        };
      });
    },
    submitReview(postId, review) {
      if (serverMode) {
        return (async () => {
          await sendServerRequest(`/api/visits/${encodeURIComponent(postId)}/review`, review);
          await refreshServerState();
        })();
      }
      update((current) => {
        const member = current.members.find((item) => item.id === current.currentMemberId);
        if (!member) return current;
        const post = current.posts.find((item) => item.id === postId);
        if (!post || post.reviews.some((item) => item.author.id === member.id)) return current;
        const nextReview: Review = {
          id: `review-${Date.now()}`,
          author: member,
          ratings: { overall: review.rating },
          wouldVisitAgain: review.revisit,
          body: review.reflection.trim(),
          submittedAt: new Date().toISOString(),
        };
        const reviews = [...post.reviews, nextReview];
        return {
          ...current,
          posts: current.posts.map((item) => item.id === postId ? { ...item, reviews } : item),
        };
      });
    },
    addVisit(input, memberId = stateRef.current.currentMemberId) {
      if (serverMode) {
        return (async () => {
          const { photos = [], ...visit } = input;
          const result = await sendServerRequest("/api/visits", { ...visit, privateToMembers: true });
          if (!result.id) throw new Error("The save could not be confirmed. Please retry with this draft.");
          // The experience is saved first; the photos follow in order. Retrying Publish reuses the saved
          // experience, and photos that already arrived are recognised by their position and skipped.
          for (const [position, photo] of photos.entries()) {
            const form = new FormData();
            form.set("photo", await (await fetch(photo.url)).blob(), `photo-${position + 1}.jpg`);
            form.set("alt", photo.alt.trim());
            form.set("width", String(photo.width));
            form.set("height", String(photo.height));
            form.set("position", String(position));
            const upload = await fetch(`/api/visits/${encodeURIComponent(result.id)}/photos`, { method: "POST", body: form, credentials: "same-origin" });
            if (!upload.ok) {
              await refreshServerState();
              const data = await upload.json().catch(() => null) as { error?: string } | null;
              const which = photos.length > 1 ? `photo ${position + 1} of ${photos.length}` : "the photo";
              throw new Error(`Your experience is saved, but ${which} did not upload${data?.error ? `: ${data.error}` : "."} Press Publish again to retry.`);
            }
          }
          await refreshServerState();
          return result.id;
        })();
      }
      const current = stateRef.current;
      const member = current.members.find((item) => item.id === memberId) ?? current.members[0];
      const place = current.places.find((item) => item.id === input.placeId);
      if (!member || !place) throw new Error("Choose a place before publishing.");
      const postId = `visit-${Date.now()}`;
      const review: Review = {
        id: `review-${Date.now()}`,
        author: member,
        ratings: { overall: input.rating },
        wouldVisitAgain: input.revisit,
        body: input.reflection.trim(),
        submittedAt: new Date().toISOString(),
      };
      const post: VisitPost = {
        id: postId,
        place: { ...place, status: "visited", visitCount: place.visitCount + 1 },
        author: member,
        visitedOn: input.visitedOn,
        exhibition: input.exhibition.trim() || "Shared place",
        title: input.title.trim() || place.name,
        story: input.story.trim(),
        photos: (input.photos ?? []).map((photo) => ({ url: photo.url, alt: photo.alt.trim() || undefined })),
        reviews: [review],
        comments: 0,
        reactions: [{ type: "love", count: 0, selected: false }],
        reactedBy: [],
        discussion: [],
        createdAt: new Date().toISOString(),
      };
      commit({
        ...current,
        posts: [post, ...current.posts],
        places: current.places.map((item) => item.id === place.id ? {
          ...item,
          status: "visited",
          visitCount: item.visitCount + 1,
        } : item),
      });
      return postId;
    },
    async addPlace(input) {
      const place = newPlaceSchema.parse(input);
      if (serverMode) {
        const response = await fetch("/api/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(place),
        });
        const data = await response.json().catch(() => null) as { id?: string; slug?: string; error?: string } | null;
        // Already saved is not an error for the person saving it: hand back the existing place.
        if ((response.ok || response.status === 409) && data?.id && data.slug) {
          await refreshServerState();
          return { id: data.id, slug: data.slug };
        }
        throw new Error(data?.error || "This place could not be saved. Please try again.");
      }
      const current = stateRef.current;
      const existing = current.places.find((item) => isSamePlace(item, place));
      if (existing) return { id: existing.id, slug: existing.slug };
      const slug = uniqueSlug(slugify(place.name), current.places.map((item) => item.slug));
      const id = `place-${Date.now()}`;
      commit({
        ...current,
        places: [...current.places, {
          id,
          slug,
          name: place.name,
          category: place.category,
          address: place.address,
          city: place.city,
          country: place.country,
          latitude: place.latitude,
          longitude: place.longitude,
          status: place.status,
          favorite: false,
          combinedScore: null,
          reviewProgress: "not-started",
          visitCount: 0,
          initials: placeInitials(place.name),
          shortDescription: "",
        }],
      });
      return { id, slug };
    },
    resetPreview() {
      if (serverMode) throw new Error("Reset is only available in the browser preview.");
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        const next = normalizePreview(seededState());
        stateRef.current = next;
        setState(next);
        setStorageError(null);
      } catch {
        setStorageError("This browser would not clear the preview. Please clear this site’s storage manually.");
      }
    },
  };

  return <PassportContext.Provider value={value}>{children}</PassportContext.Provider>;
}

export function usePassport() {
  const context = useContext(PassportContext);
  if (!context) throw new Error("usePassport must be used inside PassportProvider");
  return context;
}

export { STORAGE_KEY };
