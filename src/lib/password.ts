import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_BYTES = 64;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256) {
    throw new Error("Password must be between 12 and 256 characters");
  }
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, KEY_BYTES)) as Buffer;
  return `scrypt-v1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [version, saltText, keyText] = stored.split("$");
  if (version !== "scrypt-v1" || !saltText || !keyText || password.length > 256) return false;
  try {
    const expected = Buffer.from(keyText, "base64url");
    const salt = Buffer.from(saltText, "base64url");
    if (expected.length !== KEY_BYTES || salt.length !== 16) return false;
    const actual = (await scrypt(password, salt, KEY_BYTES)) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
