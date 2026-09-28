import { describe, expect, it } from "vitest";

import { publishVisitSchema, submitReviewSchema, todayInManila, visitFormSchema } from "@/lib/visit-form";

const valid = {
  placeId: "place-1",
  visitedOn: "2026-09-20",
  story: "A memory long enough to keep for both of us.",
  photoAlt: "",
  rating: 4,
  reflection: "Worth returning.",
  revisit: "yes",
  privateToMembers: true,
} as const;

function dayAfter(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

describe("visit form validation", () => {
  it("accepts a complete experience", () => {
    expect(visitFormSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts today but rejects a future visit date in Manila time", () => {
    expect(visitFormSchema.safeParse({ ...valid, visitedOn: todayInManila() }).success).toBe(true);
    const future = visitFormSchema.shape.visitedOn.safeParse(dayAfter(todayInManila()));
    expect(future.success).toBe(false);
    expect(future.error?.issues[0]?.message).toBe("Choose today or an earlier date.");
  });

  it("requires a story of at least 20 characters and a rating from one to five", () => {
    expect(visitFormSchema.safeParse({ ...valid, story: "Too short." }).success).toBe(false);
    expect(visitFormSchema.safeParse({ ...valid, rating: 0 }).success).toBe(false);
    expect(visitFormSchema.safeParse({ ...valid, rating: 6 }).success).toBe(false);
  });

  it("never allows an experience that is not private to the two members", () => {
    expect(visitFormSchema.safeParse({ ...valid, privateToMembers: false }).success).toBe(false);
  });
});

describe("server publish and review validation", () => {
  const publish = { ...valid, idempotencyKey: "30000000-0000-4000-8000-000000000001", title: "A visit", exhibition: "" };

  it("rejects photo metadata while uploads are unavailable", () => {
    expect(publishVisitSchema.safeParse(publish).success).toBe(true);
    expect(publishVisitSchema.safeParse({ ...publish, photoAlt: "A photo" }).success).toBe(false);
  });

  it("requires a real retry key", () => {
    expect(publishVisitSchema.safeParse({ ...publish, idempotencyKey: "not-a-uuid" }).success).toBe(false);
  });

  it("requires a rating and an eight-character reflection for a review", () => {
    expect(submitReviewSchema.safeParse({ rating: 5, reflection: "Lovely day.", revisit: "maybe" }).success).toBe(true);
    expect(submitReviewSchema.safeParse({ rating: 5, reflection: "Short", revisit: "maybe" }).success).toBe(false);
  });
});
