import { z } from "zod";

import { placeCategories } from "@/lib/domain";

export const newPlaceSchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  category: z.enum(placeCategories),
  address: z.string().trim().max(300).default(""),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(80),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  status: z.enum(["want-to-visit", "planned", "visited"]).default("want-to-visit"),
});

export type NewPlaceInput = z.input<typeof newPlaceSchema>;

export function slugify(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "");
}

/** "luna-cafe", then "luna-cafe-2" if that is taken. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const root = base || "place";
  if (!used.has(root)) return root;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${root.slice(0, 76)}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

export function placeInitials(name: string): string {
  const words = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[A-Za-z0-9]+/g) ?? [];
  const initials = words.length > 1 ? words.slice(0, 2).map((word) => word[0]).join("") : (words[0] ?? "").slice(0, 2);
  return initials.toUpperCase() || "P";
}

/** The same name within about 50 metres counts as the place we already saved. */
export function isSamePlace(
  a: { name: string; latitude: number; longitude: number },
  b: { name: string; latitude: number; longitude: number },
): boolean {
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase()
    && Math.abs(a.latitude - b.latitude) < 0.0005
    && Math.abs(a.longitude - b.longitude) < 0.0005;
}
