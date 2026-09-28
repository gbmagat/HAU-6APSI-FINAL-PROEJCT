import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { getPool } from "@/lib/db";

const COOKIE_NAME = "our_places_session";
const SESSION_DAYS = 30;

export type AppSession = {
  userId: string;
  spaceId: string;
  email: string;
  displayName: string;
  role: "owner" | "partner";
};

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function findSession(token: string | undefined): Promise<AppSession | null> {
  if (!token || !process.env.DATABASE_URL) return null;
  const { rows } = await getPool().query<AppSession>(
    `select u.id as "userId", m.space_id as "spaceId", u.email,
            u.display_name as "displayName", m.role
       from user_sessions s
       join app_users u on u.id = s.user_id
       join space_members m on m.user_id = u.id
      where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()`,
    [tokenHash(token)],
  );
  return rows[0] ?? null;
}

export const getCurrentSession = cache(async (): Promise<AppSession | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return findSession(token);
});

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getPool().query(
    "insert into user_sessions (user_id, token_hash, expires_at) values ($1, $2, $3)",
    [userId, tokenHash(token), expiresAt],
  );
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function revokeSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token && process.env.DATABASE_URL) {
    await getPool().query(
      "update user_sessions set revoked_at = now() where token_hash = $1 and revoked_at is null",
      [tokenHash(token)],
    );
  }
  store.delete(COOKIE_NAME);
}
