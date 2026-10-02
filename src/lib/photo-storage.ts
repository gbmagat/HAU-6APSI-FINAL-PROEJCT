import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export type PhotoType = "image/jpeg" | "image/png" | "image/webp";

const extensions: Record<PhotoType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const STORAGE_KEY = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** Private photos live outside public/; set PHOTO_DIR on the server (for example /var/lib/our-places/photos). */
export function photoDirectory(): string {
  return resolve(process.env.PHOTO_DIR || join(process.cwd(), "storage", "photos"));
}

/** Trust the file's bytes, not its name or the browser's claimed type. */
export function detectPhotoType(bytes: Uint8Array): PhotoType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((value, index) => bytes[index] === value)) return "image/png";
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function savePhotoFile(bytes: Uint8Array, type: PhotoType): Promise<string> {
  const directory = photoDirectory();
  await mkdir(directory, { recursive: true });
  const key = `${randomUUID()}.${extensions[type]}`;
  const temporary = join(directory, `.${key}.partial`);
  await writeFile(temporary, bytes, { mode: 0o600 });
  await rename(temporary, join(directory, key));
  return key;
}

export async function readPhotoFile(key: string): Promise<Buffer | null> {
  if (!STORAGE_KEY.test(key)) return null;
  try {
    return await readFile(join(photoDirectory(), key));
  } catch {
    return null;
  }
}

export async function deletePhotoFiles(keys: string[]): Promise<void> {
  await Promise.all(keys.filter((key) => STORAGE_KEY.test(key)).map((key) =>
    unlink(join(photoDirectory(), key)).catch(() => undefined)));
}
