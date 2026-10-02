import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real route handlers run against an in-memory PostgreSQL; only the cookie session is faked.
const h = vi.hoisted(() => ({
  db: undefined as unknown as PGlite,
  session: null as null | { userId: string; spaceId: string; email: string; displayName: string; role: "owner" | "partner" },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => {
  const run = async (text: string, params?: unknown[]) => {
    const result = await h.db.query(text, params);
    return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
  };
  return { getPool: () => ({ query: run, connect: async () => ({ query: run, release: () => undefined }) }) };
});
vi.mock("@/lib/session", () => ({
  getCurrentSession: async () => h.session,
  createSession: async () => undefined,
}));

import { POST as runAction } from "@/app/api/actions/route";
import { POST as signIn } from "@/app/api/auth/login/route";
import { POST as submitReview } from "@/app/api/visits/[id]/review/route";
import { POST as publishVisit } from "@/app/api/visits/route";
import { hashPassword } from "@/lib/password";
import { loadServerState } from "@/lib/state-server";

const owner = "00000000-0000-4000-8000-000000000001";
const partner = "00000000-0000-4000-8000-000000000002";
const outsider = "00000000-0000-4000-8000-000000000003";
const space = "10000000-0000-4000-8000-000000000001";
const otherSpace = "10000000-0000-4000-8000-000000000002";
const ORIGIN = "http://localhost";

const as = (userId: string, spaceId = space) => {
  h.session = { userId, spaceId, email: `${userId}@example.test`, displayName: "Member", role: userId === owner ? "owner" : "partner" };
};

const request = (path: string, body: unknown, origin = ORIGIN) => new NextRequest(`${ORIGIN}${path}`, {
  method: "POST",
  headers: { origin, "content-type": "application/json" },
  body: JSON.stringify(body),
});

const visitBody = (overrides: Record<string, unknown> = {}) => ({
  idempotencyKey: "30000000-0000-4000-8000-000000000001",
  placeId: "place-1",
  visitedOn: "2026-09-20",
  title: "Rain at the café",
  exhibition: "",
  story: "We stayed past dessert while the rain softened outside.",
  photoAlt: "",
  rating: 4,
  reflection: "Warm and worth returning.",
  revisit: "yes",
  privateToMembers: true,
  ...overrides,
});

async function publishAsOwner() {
  as(owner);
  const response = await publishVisit(request("/api/visits", visitBody()));
  const { id } = await response.json() as { id: string };
  return { response, id };
}

beforeEach(async () => {
  h.db = await PGlite.create();
  await h.db.exec(await readFile(new URL("../../db/schema.sql", import.meta.url), "utf8"));
  const passwordHash = await hashPassword("correct horse battery");
  for (const [id, email] of [[owner, "owner@example.test"], [partner, "partner@example.test"], [outsider, "outsider@example.test"]]) {
    await h.db.query("insert into app_users (id,email,password_hash,display_name) values ($1,$2,$3,$4)", [id, email, passwordHash, email.split("@")[0]]);
  }
  await h.db.query("insert into spaces (id,name) values ($1,'Our Places'),($2,'Other Space')", [space, otherSpace]);
  await h.db.query("insert into space_members (space_id,user_id,role) values ($1,$2,'owner'),($1,$3,'partner'),($4,$5,'owner')", [space, owner, partner, otherSpace, outsider]);
  await h.db.query(
    "insert into places (id,space_id,slug,name,category,latitude,longitude,status,planned_for) values ('place-1',$1,'luna-cafe','Luna Café','Cafe',14.55,121.02,'planned','2026-10-01')",
    [space],
  );
});

afterEach(async () => {
  h.session = null;
  await h.db?.close();
});

describe("blind reviews through the real server code", () => {
  it("hides the owner's review from the partner until both have submitted", async () => {
    const { response, id } = await publishAsOwner();
    expect(response.status).toBe(201);

    const partnerView = await loadServerState(space, partner);
    expect(partnerView.posts[0].reviews).toEqual([]);
    expect(partnerView.places[0]).toMatchObject({ reviewProgress: "your-review-needed", combinedScore: null });

    const ownerView = await loadServerState(space, owner);
    expect(ownerView.posts[0].reviews.map((review) => review.author.id)).toEqual([owner]);
    expect(ownerView.places[0]).toMatchObject({ status: "visited", reviewProgress: "partner-review-needed", combinedScore: null });

    as(partner);
    const reviewed = await submitReview(request(`/api/visits/${id}/review`, { rating: 5, reflection: "Lovely and quiet.", revisit: "yes" }), { params: Promise.resolve({ id }) });
    expect(reviewed.status).toBe(201);

    const revealed = await loadServerState(space, partner);
    expect(revealed.posts[0].reviews).toHaveLength(2);
    expect(revealed.places[0]).toMatchObject({ reviewProgress: "ready", combinedScore: 4.5 });
  });

  it("rejects a second review from the same member", async () => {
    const { id } = await publishAsOwner();
    const again = await submitReview(request(`/api/visits/${id}/review`, { rating: 5, reflection: "Trying twice.", revisit: "yes" }), { params: Promise.resolve({ id }) });
    expect(again.status).toBe(409);
  });

  it("never serves a photo URL while no photo route exists", async () => {
    const { id } = await publishAsOwner();
    await h.db.query(
      "insert into visit_photos (space_id,visit_id,storage_key,alt_text,content_type,byte_size,width,height) values ($1,$2,'photos/one.jpg','A café window','image/jpeg',1000,600,400)",
      [space, id],
    );
    const state = await loadServerState(space, owner);
    expect(state.posts[0].photoUrl).toBeUndefined();
  });

  it("refuses to load a space for someone who is not a member", async () => {
    await expect(loadServerState(space, outsider)).rejects.toThrow("membership");
  });
});

describe("publishing experiences", () => {
  it("is safe to retry and refuses to reuse a draft key for different content", async () => {
    const first = await publishAsOwner();
    const retry = await publishVisit(request("/api/visits", visitBody()));
    expect(retry.status).toBe(200);
    expect((await retry.json() as { id: string }).id).toBe(first.id);

    const changed = await publishVisit(request("/api/visits", visitBody({ story: "A different memory for the same draft key." })));
    expect(changed.status).toBe(409);
  });

  it("rejects a place from outside the shared space", async () => {
    as(owner);
    const response = await publishVisit(request("/api/visits", visitBody({ placeId: "place-elsewhere" })));
    expect(response.status).toBe(404);
  });
});

describe("shared actions", () => {
  it("rejects cross-site and signed-out writes", async () => {
    as(owner);
    expect((await runAction(request("/api/actions", { action: "toggleFavorite", placeId: "place-1" }, "https://evil.example"))).status).toBe(403);
    h.session = null;
    expect((await runAction(request("/api/actions", { action: "toggleFavorite", placeId: "place-1" }))).status).toBe(401);
  });

  it("keeps favorites separate for each member", async () => {
    as(owner);
    expect((await runAction(request("/api/actions", { action: "toggleFavorite", placeId: "place-1" }))).status).toBe(200);
    expect((await loadServerState(space, owner)).places[0].favorite).toBe(true);
    expect((await loadServerState(space, partner)).places[0].favorite).toBe(false);
  });

  it("clears the planned date when a place stops being planned", async () => {
    as(owner);
    expect((await loadServerState(space, owner)).places[0].nextVisitDate).toBe("2026-10-01");
    await runAction(request("/api/actions", { action: "setPlaceStatus", placeId: "place-1", status: "want-to-visit" }));
    expect((await loadServerState(space, owner)).places[0]).toMatchObject({ status: "want-to-visit", nextVisitDate: undefined });
  });

  it("lets only the author delete a post, then resets the place once its last visit is gone", async () => {
    const { id } = await publishAsOwner();
    as(partner);
    expect((await runAction(request("/api/actions", { action: "deletePost", postId: id }))).status).toBe(404);

    as(owner);
    expect((await runAction(request("/api/actions", { action: "deletePost", postId: id }))).status).toBe(200);
    const state = await loadServerState(space, owner);
    expect(state.posts).toHaveLength(0);
    expect(state.places[0]).toMatchObject({ status: "want-to-visit", visitCount: 0 });
  });

  it("cannot comment on an experience in another space", async () => {
    const { id } = await publishAsOwner();
    as(outsider, otherSpace);
    expect((await runAction(request("/api/actions", { action: "addComment", postId: id, body: "Hello" }))).status).toBe(404);
  });
});

describe("sign-in", () => {
  const attempt = (password: string, email = "owner@example.test") => signIn(request("/api/auth/login", { email, password }));

  // The route refuses to run without a configured database, so point it at the in-memory one.
  beforeEach(() => { vi.stubEnv("DATABASE_URL", "postgres://in-memory/test"); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("stays closed when no database is configured", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect((await attempt("correct horse battery")).status).toBe(503);
  });

  it("signs in with the right password", async () => {
    expect((await attempt("correct horse battery")).status).toBe(200);
  });

  it("signs in through the HTTPS proxy, where the server only knows its internal address", async () => {
    const proxied = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://places.example.com",
        "x-forwarded-host": "places.example.com",
        "x-forwarded-proto": "https",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "owner@example.test", password: "correct horse battery" }),
    });
    expect((await signIn(proxied)).status).toBe(200);
  });

  it("gives an unknown email the same answer as a wrong password", async () => {
    const unknown = await attempt("whatever password", "nobody@example.test");
    const wrong = await attempt("wrong password!!");
    expect(unknown.status).toBe(401);
    expect(await unknown.json()).toEqual(await wrong.json());
  });

  it("locks the account for 15 minutes after five failed attempts", async () => {
    for (let index = 0; index < 5; index += 1) expect((await attempt("wrong password!!")).status).toBe(401);
    expect((await attempt("correct horse battery")).status).toBe(429);
  });
});
