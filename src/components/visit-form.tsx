"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  LockKeyhole,
  RotateCcw,
  Save,
  Star,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { type NewVisitPhoto, usePassport } from "@/components/passport-provider";
import type { Place } from "@/lib/domain";
import { placeLocation } from "@/lib/places";
import { MAX_VISIT_PHOTOS, todayInManila, visitFormSchema, type VisitFormInput } from "@/lib/visit-form";

const steps = ["Place", "Story", "Photos", "Review & publish"] as const;
const ratingLabels = [
  "Not rated",
  "Disappointing",
  "Needs improvement",
  "Worth a visit",
  "Excellent",
  "Unforgettable",
] as const;

const stepForField = { placeId: 0, visitedOn: 0, story: 1 } as const;

type DraftPhoto = NewVisitPhoto & { key: string };

/** Photos kept in a saved draft: resized images as data URLs, each with its description. */
function draftPhotosFrom(draft: { photos?: unknown; photoUrl?: unknown; photoWidth?: unknown; photoHeight?: unknown; values?: unknown }): DraftPhoto[] {
  // Drafts saved before several photos were allowed hold one photo as photoUrl.
  const list: unknown[] = Array.isArray(draft.photos) ? draft.photos : draft.photoUrl
    ? [{ url: draft.photoUrl, alt: (draft.values as { photoAlt?: unknown } | undefined)?.photoAlt, width: draft.photoWidth, height: draft.photoHeight }]
    : [];
  return list
    .filter((photo): photo is { url: string; alt?: unknown; width?: unknown; height?: unknown } =>
      typeof photo === "object" && photo !== null && typeof (photo as { url?: unknown }).url === "string"
      && (photo as { url: string }).url.startsWith("data:image/"))
    .slice(0, MAX_VISIT_PHOTOS)
    .map((photo) => ({
      key: crypto.randomUUID(),
      url: photo.url,
      alt: typeof photo.alt === "string" ? photo.alt.slice(0, 240) : "",
      width: Number(photo.width) || 1,
      height: Number(photo.height) || 1,
    }));
}

/** Read an image file and shrink it to at most 1200 px on its longer side, as a JPEG data URL. */
async function preparePhoto(file: File): Promise<NewVisitPhoto> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image"));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not decode image"));
    element.src = source;
  });
  const maxDimension = 1200;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { url: canvas.toDataURL("image/jpeg", 0.78), alt: "", width: canvas.width, height: canvas.height };
}

export function VisitForm({
  places,
  initialPlaceSlug,
  memberId,
}: {
  places?: Place[];
  initialPlaceSlug?: string;
  memberId?: string;
}) {
  const router = useRouter();
  const passport = usePassport();
  const availablePlaces = passport.serverMode ? passport.places : passport.places.length ? passport.places : places ?? [];
  const activeMemberId = memberId ?? passport.currentMember.id;
  const draftKey = `our-places-passport-experience-draft:${activeMemberId}`;
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const initialPlace = availablePlaces.find((place) => place.slug === initialPlaceSlug);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<VisitFormInput>({
    placeId: initialPlace?.id ?? "",
    visitedOn: "",
    story: "",
    rating: 0,
    reflection: "",
    revisit: "yes",
    privateToMembers: true,
  });
  const [title, setTitle] = useState("");
  const [exhibition, setExhibition] = useState("");
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!values.placeId && initialPlace) updateValue("placeId", initialPlace.id);
    // A draft is deliberately restored only when the user asks; opening the form never overwrites fresh input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlace?.id]);

  function updateValue<Key extends keyof VisitFormInput>(key: Key, value: VisitFormInput[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setStatusMessage("");
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validateCurrentStep() {
    const nextErrors: Record<string, string> = {};
    if (step === 0) {
      if (!values.placeId) nextErrors.placeId = "Choose a place.";
      const date = visitFormSchema.shape.visitedOn.safeParse(values.visitedOn);
      if (!values.visitedOn) nextErrors.visitedOn = "Choose the visit date.";
      else if (!date.success) nextErrors.visitedOn = date.error.issues[0]?.message ?? "Enter a valid visit date.";
    }
    if (step === 1 && values.story.trim().length < 20) {
      nextErrors.story = "Share at least 20 characters from the experience.";
    }
    if (step === 3) {
      if (!values.rating) nextErrors.rating = "Choose a private rating.";
      if (values.reflection.trim().length < 8) {
        nextErrors.reflection = "Add a short private reflection.";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function goForward() {
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
    setStatusMessage("");
  }

  function savedPhotos(): NewVisitPhoto[] {
    return photos.map(({ url, alt, width, height }) => ({ url, alt, width, height }));
  }

  function saveDraft() {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ values, title, exhibition, photos: savedPhotos(), step, idempotencyKey }));
      setStatusMessage("Draft saved on this device.");
    } catch {
      setStatusMessage("This browser could not save the draft. Keep this page open to preserve your text.");
    }
  }

  function restoreDraft() {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) {
        setStatusMessage("No saved draft was found on this device.");
        return;
      }
      const draft = JSON.parse(raw) as {
        values?: VisitFormInput;
        title?: string;
        exhibition?: string;
        photos?: unknown;
        photoUrl?: unknown;
        photoWidth?: unknown;
        photoHeight?: unknown;
        step?: number;
        idempotencyKey?: string;
      };
      const validDraft = visitFormSchema.partial().safeParse(draft.values);
      // Rating 0 and unfinished text are valid while drafting; restore only known fields.
      if (!draft.values || (!validDraft.success && typeof draft.values.story !== "string")) throw new Error("Invalid draft");
      setValues((current) => ({ ...current, ...draft.values, privateToMembers: true }));
      setTitle(typeof draft.title === "string" ? draft.title : "");
      setExhibition(typeof draft.exhibition === "string" ? draft.exhibition : "");
      setPhotos(draftPhotosFrom(draft));
      if (draft.idempotencyKey && /^[\da-f]{8}-[\da-f-]{27}$/i.test(draft.idempotencyKey)) setIdempotencyKey(draft.idempotencyKey as `${string}-${string}-${string}-${string}-${string}`);
      setStep(Math.min(Math.max(Number.isInteger(draft.step) ? draft.step! : 0, 0), steps.length - 1));
      setStatusMessage("Draft restored.");
    } catch {
      setStatusMessage("The saved draft could not be restored.");
    }
  }

  async function handlePhotos(files: File[]) {
    if (!files.length || addingPhotos) return;
    const room = MAX_VISIT_PHOTOS - photos.length;
    const usable = files.filter((file) => file.type.startsWith("image/") && file.size <= 8 * 1024 * 1024);
    const skipped = files.length - usable.length;
    setAddingPhotos(true);
    const added: DraftPhoto[] = [];
    let failed = 0;
    for (const file of usable.slice(0, room)) {
      try {
        added.push({ ...await preparePhoto(file), key: crypto.randomUUID() });
      } catch {
        failed += 1;
      }
    }
    setPhotos((current) => [...current, ...added].slice(0, MAX_VISIT_PHOTOS));
    setAddingPhotos(false);
    const notes = [
      added.length ? `${added.length} ${added.length === 1 ? "photo" : "photos"} added${passport.serverMode ? ", uploading when you publish" : ""}.` : "",
      skipped ? `${skipped} skipped: only images under 8 MB.` : "",
      failed ? `${failed} could not be read.` : "",
      usable.length > room ? `An experience keeps up to ${MAX_VISIT_PHOTOS} photos.` : "",
    ];
    setStatusMessage(notes.filter(Boolean).join(" "));
  }

  function updatePhotoAlt(key: string, alt: string) {
    setPhotos((current) => current.map((photo) => photo.key === key ? { ...photo, alt } : photo));
  }

  function removePhoto(key: string) {
    setPhotos((current) => current.filter((photo) => photo.key !== key));
  }

  async function publishVisit() {
    if (publishing) return;
    if (!validateCurrentStep()) return;
    const result = visitFormSchema.safeParse(values);
    if (!result.success) {
      const nextErrors = Object.fromEntries(
        result.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]),
      );
      setErrors(nextErrors);
      const firstField = String(result.error.issues[0]?.path[0] ?? "");
      setStep(stepForField[firstField as keyof typeof stepForField] ?? 3);
      return;
    }
    setPublishing(true);
    setStatusMessage("");
    // Retain both text and retry key if the connection drops after the database saves.
    try { window.localStorage.setItem(draftKey, JSON.stringify({ values, title, exhibition, photos: savedPhotos(), step, idempotencyKey })); } catch {}
    try {
      await passport.addVisit({
        idempotencyKey,
        placeId: result.data.placeId,
        visitedOn: result.data.visitedOn,
        exhibition: exhibition || selectedPlace?.category || "Shared place",
        title: title || selectedPlace?.name || "Shared place",
        story: result.data.story,
        rating: result.data.rating,
        reflection: result.data.reflection,
        revisit: result.data.revisit,
        photos: savedPhotos(),
      }, activeMemberId);
      try { window.localStorage.removeItem(draftKey); } catch {}
      router.push("/feed?published=1");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Your experience could not be saved. Please try again.");
      setPublishing(false);
    }
  }

  const selectedPlace = availablePlaces.find((place) => place.id === values.placeId);

  return (
    <section className="visit-form" aria-busy={publishing}>
      <fieldset disabled={publishing} className="visit-form__fields">
      <div className="visit-form__toolbar">
        <p>Step {step + 1} of {steps.length}</p>
        <div>
          <button type="button" className="text-button" onClick={restoreDraft}>
            <RotateCcw size={16} aria-hidden="true" /> Restore draft
          </button>
          <button type="button" className="button button--secondary" onClick={saveDraft}>
            <Save size={17} aria-hidden="true" /> Save draft
          </button>
        </div>
      </div>

      <ol className="form-progress" aria-label="Experience form progress">
        {steps.map((label, index) => (
          <li
            key={label}
            className={index === step ? "is-current" : index < step ? "is-complete" : ""}
            aria-current={index === step ? "step" : undefined}
          >
            <button
              type="button"
              disabled={index > step}
              onClick={() => index <= step && setStep(index)}
            >
              <span>{index < step ? <Check size={15} aria-hidden="true" /> : `0${index + 1}`}</span>
              <small>{label}</small>
            </button>
          </li>
        ))}
      </ol>

      <div className="form-panel">
        {step === 0 && (
          <fieldset>
            <legend>Choose the place and date</legend>
            <label className="field">
              <span>Place</span>
              <select
                value={values.placeId}
                aria-invalid={Boolean(errors.placeId)}
                onChange={(event) => updateValue("placeId", event.target.value)}
              >
                <option value="">Choose a place</option>
                {availablePlaces.map((place) => (
                  <option key={place.id} value={place.id}>{place.name} — {placeLocation(place)}</option>
                ))}
              </select>
              {errors.placeId && <small className="field-error">{errors.placeId}</small>}
            </label>
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={values.visitedOn}
                max={todayInManila()}
                aria-invalid={Boolean(errors.visitedOn)}
                onChange={(event) => updateValue("visitedOn", event.target.value)}
              />
              {errors.visitedOn && <small className="field-error">{errors.visitedOn}</small>}
            </label>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset>
            <legend>Tell the story</legend>
            <label className="field">
              <span>Occasion or highlight <small>(optional)</small></span>
              <input value={exhibition} maxLength={120} placeholder="Gallery visit, dinner for two, Sunday walk" onChange={(event) => setExhibition(event.target.value)} />
            </label>
            <label className="field">
              <span>Story title <small>(optional)</small></span>
              <input value={title} maxLength={120} placeholder="The room we kept returning to" onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="field">
              <span>Your memory</span>
              <textarea
                value={values.story}
                rows={8}
                maxLength={1200}
                placeholder="What stayed with you after this place?"
                aria-invalid={Boolean(errors.story)}
                onChange={(event) => updateValue("story", event.target.value)}
              />
              <small className={errors.story ? "field-error" : "field-hint"}>
                {errors.story ?? `${values.story.length} / 1200`}
              </small>
            </label>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset>
            <legend>Photos</legend>
            <p className="field-hint">
              {passport.serverMode
                ? `Add up to ${MAX_VISIT_PHOTOS} photos. Only the two of you can see them.`
                : `Add up to ${MAX_VISIT_PHOTOS} photos. They are resized and kept only in this browser preview.`}
            </p>
            {photos.length < MAX_VISIT_PHOTOS && (
              <label className="photo-dropzone">
                <ImagePlus size={24} aria-hidden="true" />
                <strong>{addingPhotos ? "Preparing photos…" : photos.length ? "Add more photos" : "Choose photos"}</strong>
                <span>{photos.length} of {MAX_VISIT_PHOTOS} · JPEG, PNG, or WebP</span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  disabled={addingPhotos}
                  onChange={(event) => {
                    void handlePhotos(Array.from(event.target.files ?? []));
                    event.target.value = "";
                  }}
                />
              </label>
            )}
            {photos.length > 0 && (
              <ul className="photo-previews" aria-label="Chosen photos">
                {photos.map((photo, index) => (
                  <li key={photo.key} className="photo-preview">
                    <div className="photo-preview__image">
                      {/* A data URL is intentionally used here: the photo has not been uploaded yet. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={photo.alt || `Photo ${index + 1}`} />
                      {index === 0 && photos.length > 1 && <span className="photo-preview__cover">Cover</span>}
                      <button type="button" className="icon-button" onClick={() => removePhoto(photo.key)} aria-label={`Remove photo ${index + 1}`}>
                        <X size={17} aria-hidden="true" />
                      </button>
                    </div>
                    <label className="field">
                      <span className="sr-only">Description of photo {index + 1} (optional)</span>
                      <input value={photo.alt} maxLength={240} placeholder="Describe this photo (optional)" onChange={(event) => updatePhotoAlt(photo.key, event.target.value)} />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        )}

        {step === 3 && (
          <fieldset>
            <legend>Private review</legend>
            <div className="selected-place-summary">
              <span>{selectedPlace?.initials ?? "P"}</span>
              <div>
                <strong>{selectedPlace?.name ?? "Choose a place"}</strong>
                <small>{selectedPlace ? `${selectedPlace.category} · ${selectedPlace.city}` : "Return to step one"}</small>
              </div>
            </div>

            <div className="rating-field">
              <div>
                <span>Overall rating</span>
                <strong>{ratingLabels[values.rating]}</strong>
              </div>
              <div className="rating-input" role="radiogroup" aria-label="Overall rating">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    role="radio"
                    aria-checked={values.rating === rating}
                    aria-label={`${rating} of 5, ${ratingLabels[rating]}`}
                    className={values.rating >= rating ? "is-selected" : ""}
                    onClick={() => updateValue("rating", rating)}
                  >
                    <Star size={25} fill={values.rating >= rating ? "currentColor" : "none"} aria-hidden="true" />
                  </button>
                ))}
                <button type="button" className="rating-reset" onClick={() => updateValue("rating", 0)}>
                  Reset
                </button>
              </div>
              {errors.rating && <small className="field-error">{errors.rating}</small>}
            </div>

            <label className="field">
              <span>Written reflection</span>
              <textarea
                value={values.reflection}
                rows={4}
                maxLength={500}
                placeholder="Warm, quiet, and worth returning for."
                aria-invalid={Boolean(errors.reflection)}
                onChange={(event) => updateValue("reflection", event.target.value)}
              />
              {errors.reflection && <small className="field-error">{errors.reflection}</small>}
            </label>

            <fieldset className="revisit-field">
              <legend>Would you visit again?</legend>
              <div>
                {(["yes", "maybe", "no"] as const).map((choice) => (
                  <label key={choice}>
                    <input
                      type="radio"
                      name="revisit"
                      value={choice}
                      checked={values.revisit === choice}
                      onChange={() => updateValue("revisit", choice)}
                    />
                    {choice[0].toUpperCase() + choice.slice(1)}
                  </label>
                ))}
              </div>
            </fieldset>

            <p className="privacy-note">
              <LockKeyhole size={17} aria-hidden="true" />
              Your partner will not see your score until both private reviews are ready.
            </p>
          </fieldset>
        )}

        <footer className="form-actions">
          <button
            type="button"
            className="button button--secondary"
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
          >
            <ArrowLeft size={18} aria-hidden="true" /> Previous
          </button>
          {step < steps.length - 1 ? (
            <button type="button" className="button button--primary" onClick={goForward}>
              Continue <ArrowRight size={18} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={publishVisit}>
              {publishing ? "Saving…" : "Publish"}
            </button>
          )}
        </footer>
      </div>
      </fieldset>
      <p className="form-status" role="status" aria-live="polite">{statusMessage}</p>
    </section>
  );
}
