import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
import { GET as getPhoto } from "@/app/api/photos/[id]/route";
import { POST as savePlace } from "@/app/api/places/route";
import { POST as uploadPhoto } from "@/app/api/visits/[id]/photos/route";
import { GET as aboutPlace } from "@/app/api/places/about/route";
import { GET as searchPlaces } from "@/app/api/places/search/route";
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

describe("saving places", () => {
  const tokyo = { name: "teamLab Planets", category: "Museum", address: "Toyosu", city: "Tokyo", country: "Japan", latitude: 35.6491, longitude: 139.7898 };

  it("saves a place from search for the shared space, abroad included", async () => {
    as(partner);
    const response = await savePlace(request("/api/places", tokyo));
    expect(response.status).toBe(201);
    const { slug } = await response.json() as { slug: string };
    expect(slug).toBe("teamlab-planets");
    const saved = (await loadServerState(space, owner)).places.find((place) => place.slug === slug);
    expect(saved).toMatchObject({ name: "teamLab Planets", country: "Japan", status: "want-to-visit", initials: "TP" });
  });

  it("returns the existing place instead of saving it twice, and keeps slugs unique", async () => {
    as(owner);
    const first = await (await savePlace(request("/api/places", tokyo))).json() as { slug: string };
    const again = await savePlace(request("/api/places", { ...tokyo, name: "TEAMLAB PLANETS" }));
    expect(again.status).toBe(409);
    expect((await again.json() as { slug: string }).slug).toBe(first.slug);
    const elsewhere = await (await savePlace(request("/api/places", { ...tokyo, latitude: 34.69, longitude: 135.5 }))).json() as { slug: string };
    expect(elsewhere.slug).toBe("teamlab-planets-2");
  });

  it("rejects bad input, other sites, and signed-out requests", async () => {
    as(owner);
    expect((await savePlace(request("/api/places", { ...tokyo, latitude: 200 }))).status).toBe(400);
    expect((await savePlace(request("/api/places", tokyo, "https://evil.example"))).status).toBe(403);
    h.session = null;
    expect((await savePlace(request("/api/places", tokyo))).status).toBe(401);
  });

  it("stores the country, defaulting old places to the Philippines", async () => {
    expect((await loadServerState(space, owner)).places.find((place) => place.id === "place-1")?.country).toBe("Philippines");
  });
});

describe("searching OpenStreetMap", () => {
  const search = (q: string) => searchPlaces(new NextRequest(`${ORIGIN}/api/places/search?q=${encodeURIComponent(q)}`));

  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("asks members only, identifies the app, and maps the results", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://in-memory/test");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{
      place_id: 7, lat: "15.0286", lon: "120.6898", name: "San Fernando",
      display_name: "San Fernando, Pampanga, Philippines", category: "boundary", type: "administrative",
      address: { city: "San Fernando", country: "Philippines" },
    }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    h.session = null;
    expect((await search("san fernando pampanga")).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();

    as(owner);
    const response = await search("san fernando pampanga");
    expect(response.status).toBe(200);
    expect((await response.json() as { results: { city: string }[] }).results[0].city).toBe("San Fernando");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toContain("nominatim.openstreetmap.org/search");
    expect((init.headers as Record<string, string>)["User-Agent"]).toContain("OurPlaces");

    expect((await search("San Fernando  Pampanga")).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("biases a search toward a pinned location without sending the exact pin", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://in-memory/test");
    as(owner);
    const fetchMock = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await searchPlaces(new NextRequest(`${ORIGIN}/api/places/search?q=sm%20city&lat=15.0286&lng=120.6898`));
    const url = new URL(String((fetchMock.mock.calls[0] as unknown as [URL])[0]));
    expect(url.searchParams.get("viewbox")).toBe("120.2,15.5,121.2,14.5");
    expect(url.searchParams.get("bounded")).toBe("0");
    expect(url.toString()).not.toContain("15.0286");
  });

  it("rejects very short searches and reports an unavailable service", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://in-memory/test");
    as(owner);
    expect((await search("a")).status).toBe(400);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("busy", { status: 503 })));
    expect((await search("somewhere new entirely")).status).toBe(502);
  });
});

describe("private photos", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01]);
  let photoDir = "";

  const upload = (visitId: string, bytes: Uint8Array = jpeg, origin = ORIGIN, fields: Record<string, string> = {}) => {
    const form = new FormData();
    form.set("photo", new Blob([bytes as BlobPart], { type: "image/jpeg" }), "photo.jpg");
    for (const [name, value] of Object.entries({ alt: "A rainy café window", width: "1200", height: "800", ...fields })) form.set(name, value);
    return uploadPhoto(new NextRequest(`${ORIGIN}/api/visits/${visitId}/photos`, { method: "POST", headers: { origin }, body: form }), { params: Promise.resolve({ id: visitId }) });
  };
  const fetchPhoto = (photoId: string) => getPhoto(new NextRequest(`${ORIGIN}/api/photos/${photoId}`), { params: Promise.resolve({ id: photoId }) });

  beforeEach(async () => {
    photoDir = await mkdtemp(join(tmpdir(), "our-places-photos-"));
    vi.stubEnv("PHOTO_DIR", photoDir);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(photoDir, { recursive: true, force: true });
  });

  it("stores the author's photo privately and serves it only inside the space", async () => {
    const { id } = await publishAsOwner();
    const response = await upload(id);
    expect(response.status).toBe(201);
    const { id: photoId } = await response.json() as { id: string };
    expect(await readdir(photoDir)).toHaveLength(1);

    const state = await loadServerState(space, partner);
    expect(state.posts[0]).toMatchObject({ photoUrl: `/api/photos/${photoId}`, photoAlt: "A rainy café window" });

    as(partner);
    const served = await fetchPhoto(photoId);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(jpeg);

    as(outsider, otherSpace);
    expect((await fetchPhoto(photoId)).status).toBe(404);
    h.session = null;
    expect((await fetchPhoto(photoId)).status).toBe(401);
  });

  it("refuses files that are not really images, other people's posts, a second photo, and other sites", async () => {
    const { id } = await publishAsOwner();
    expect((await upload(id, new TextEncoder().encode("<script>not an image</script>"))).status).toBe(400);
    expect((await upload(id, jpeg, ORIGIN, { width: "0" }))).toHaveProperty("status", 400);
    expect((await upload(id, jpeg, "https://evil.example")).status).toBe(403);
    as(partner);
    expect((await upload(id)).status).toBe(404);
    as(owner);
    expect((await upload(id)).status).toBe(201);
    expect((await upload(id)).status).toBe(409);
    expect(await readdir(photoDir)).toHaveLength(1);
  });

  it("deletes the photo file together with the post", async () => {
    const { id } = await publishAsOwner();
    await upload(id);
    expect(await readdir(photoDir)).toHaveLength(1);
    expect((await runAction(request("/api/actions", { action: "deletePost", postId: id }))).status).toBe(200);
    expect(await readdir(photoDir)).toHaveLength(0);
  });
});

describe("place details", () => {
  const about = (query: string) => aboutPlace(new NextRequest(`${ORIGIN}/api/places/about?${query}`));

  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("gathers website, hours, and a Wikipedia summary for a saved place", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://in-memory/test");
    as(owner);
    const fetchMock = vi.fn(async (input: URL | string) => {
      const url = String(input);
      if (url.includes("nominatim")) {
        return new Response(JSON.stringify([{
          lat: "14.5906", lon: "120.9752", display_name: "Intramuros, Manila", osm_type: "relation", osm_id: 9,
          extratags: { website: "https://intramuros.gov.ph", opening_hours: "Mo-Su 08:00-20:00", wikipedia: "en:Intramuros" },
        }]), { status: 200 });
      }
      return new Response(JSON.stringify({ title: "Intramuros", extract: "The historic walled area of Manila.", content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Intramuros" } } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await about("name=Intramuros&lat=14.5904&lng=120.9750");
    expect(response.status).toBe(200);
    expect((await response.json() as { about: object }).about).toEqual({
      website: "https://intramuros.gov.ph/",
      openingHours: "Mo-Su 08:00-20:00",
      osmUrl: "https://www.openstreetmap.org/relation/9",
      wikipedia: { title: "Intramuros", extract: "The historic walled area of Manila.", url: "https://en.wikipedia.org/wiki/Intramuros" },
    });
    const searchUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(searchUrl.searchParams.get("bounded")).toBe("1");
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://en.wikipedia.org/api/rest_v1/page/summary/Intramuros");
  });

  it("returns no details when nothing matches near the pin, and requires a session and coordinates", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://in-memory/test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ lat: "15.5", lon: "121.5", display_name: "Far away" }]), { status: 200 })));
    as(owner);
    expect(await (await about("name=Hidden%20Garden&lat=14.6&lng=121.0")).json()).toEqual({ about: {} });
    expect((await about("name=Hidden%20Garden")).status).toBe(400);
    h.session = null;
    expect((await about("name=Hidden%20Garden&lat=14.6&lng=121.0")).status).toBe(401);
  });
});
