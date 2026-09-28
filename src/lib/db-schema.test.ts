import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const owner = "00000000-0000-4000-8000-000000000001";
const partner = "00000000-0000-4000-8000-000000000002";
const outsider = "00000000-0000-4000-8000-000000000003";
const space = "10000000-0000-4000-8000-000000000001";
const otherSpace = "10000000-0000-4000-8000-000000000002";
const visit = "20000000-0000-4000-8000-000000000001";

describe("self-hosted PostgreSQL schema", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec(await readFile(new URL("../../db/schema.sql", import.meta.url), "utf8"));
    for (const [id, email] of [[owner, "owner@example.test"], [partner, "partner@example.test"], [outsider, "outsider@example.test"]]) {
      await db.query(
        "insert into app_users (id,email,password_hash,display_name) values ($1,$2,$3,$4)",
        [id, email, "x".repeat(64), email],
      );
    }
    await db.query("insert into spaces (id,name) values ($1,'Our Places'),($2,'Other Space')", [space, otherSpace]);
    await db.query("insert into space_members (space_id,user_id,role) values ($1,$2,'owner'),($1,$3,'partner'),($4,$5,'owner')", [space, owner, partner, otherSpace, outsider]);
    await db.query(
      "insert into places (id,space_id,slug,name,category,latitude,longitude) values ('place-1',$1,'place-1','Our Place','Cafe',14.5,121)",
      [space],
    );
    await db.query(
      "insert into visits (id,space_id,place_id,author_id,visited_on,title,story,idempotency_key) values ($1,$2,'place-1',$3,'2026-09-20','A visit','A memory long enough to save.', $4)",
      [visit, space, owner, "30000000-0000-4000-8000-000000000001"],
    );
  });

  afterAll(async () => { await db?.close(); });

  it("withholds the combined score until both members review", async () => {
    await db.query(
      "insert into reviews (space_id,visit_id,author_id,overall,reflection,would_visit_again) values ($1,$2,$3,4,'A thoughtful memory.','yes')",
      [space, visit, owner],
    );
    const first = await db.query<{ review_count: number; combined_score: string | null }>(
      "select review_count,combined_score from visit_review_summary where visit_id=$1", [visit],
    );
    expect(first.rows[0].review_count).toBe(1);
    expect(first.rows[0].combined_score).toBeNull();

    await db.query(
      "insert into reviews (space_id,visit_id,author_id,overall,reflection,would_visit_again) values ($1,$2,$3,5,'Another thoughtful memory.','yes')",
      [space, visit, partner],
    );
    const both = await db.query<{ review_count: number; combined_score: string }>(
      "select review_count,combined_score from visit_review_summary where visit_id=$1", [visit],
    );
    expect(both.rows[0].review_count).toBe(2);
    expect(Number(both.rows[0].combined_score)).toBe(4.5);
  });

  it("rejects a duplicate review, cross-space review, and reused publication key", async () => {
    await expect(db.query(
      "insert into reviews (space_id,visit_id,author_id,overall,reflection,would_visit_again) values ($1,$2,$3,5,'A second review.','yes')",
      [space, visit, owner],
    )).rejects.toThrow();
    await expect(db.query(
      "insert into reviews (space_id,visit_id,author_id,overall,reflection,would_visit_again) values ($1,$2,$3,5,'An outsider review.','yes')",
      [space, visit, outsider],
    )).rejects.toThrow();
    await expect(db.query(
      "insert into visits (space_id,place_id,author_id,visited_on,title,story,idempotency_key) values ($1,'place-1',$2,'2026-09-21','Again','Another memory long enough.', $3)",
      [space, owner, "30000000-0000-4000-8000-000000000001"],
    )).rejects.toThrow();
  });
});
