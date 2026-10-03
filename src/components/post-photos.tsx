"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";

import type { PostPhoto } from "@/lib/domain";

const SHOWN = 4;

/** Up to four photos in a grid; any photo opens the full set in a viewer. */
export function PostPhotos({ photos, title }: { photos: PostPhoto[]; title: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(0);
  if (!photos.length) return null;
  const hidden = photos.length - SHOWN;
  const current = photos[open] ?? photos[0];

  function show(index: number) {
    setOpen(index);
    dialogRef.current?.showModal();
  }

  function step(by: number) {
    setOpen((index) => (index + by + photos.length) % photos.length);
  }

  function handleKey(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "ArrowRight") step(1);
    if (event.key === "ArrowLeft") step(-1);
  }

  return (
    <>
      <div className={`post-photos post-photos--${Math.min(photos.length, SHOWN)}`}>
        {photos.slice(0, SHOWN).map((photo, index) => (
          <button
            key={photo.url}
            type="button"
            className="post-photos__item"
            style={{ backgroundImage: `url(${photo.url})` }}
            onClick={() => show(index)}
            aria-label={`Open photo ${index + 1} of ${photos.length}${photo.alt ? `: ${photo.alt}` : ""}`}
          >
            {index === SHOWN - 1 && hidden > 0 && <span className="post-photos__more" aria-hidden="true">+{hidden}</span>}
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className="photo-viewer"
        aria-label={`Photos from ${title}`}
        onKeyDown={handleKey}
        onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
      >
        <button type="button" className="icon-button photo-viewer__close" onClick={() => dialogRef.current?.close()} aria-label="Close photos">
          <X size={20} aria-hidden="true" />
        </button>
        <figure>
          {/* Photos are private files served to members, so they skip the public image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.url} alt={current.alt || `Photo ${open + 1} from ${title}`} />
          <figcaption>
            {photos.length > 1 && <span>{open + 1} of {photos.length}</span>}
            {current.alt}
          </figcaption>
        </figure>
        {photos.length > 1 && (
          <>
            <button type="button" className="icon-button photo-viewer__step photo-viewer__step--previous" onClick={() => step(-1)} aria-label="Previous photo">
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button photo-viewer__step photo-viewer__step--next" onClick={() => step(1)} aria-label="Next photo">
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          </>
        )}
      </dialog>
    </>
  );
}
