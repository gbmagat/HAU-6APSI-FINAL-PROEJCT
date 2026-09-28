# Weekly Increment Report

## Week of: September 21, 2026

## What changed this week

Our Places moved off Supabase entirely and now runs on its own PostgreSQL database reached through Next.js route handlers and the `pg` package, with a fresh schema in `db/schema.sql` and an interactive `scripts/provision-space.mjs` that creates the two invited accounts. I wrote the authentication layer by hand: email/password sign-in with salted scrypt hashes, database-backed sessions whose tokens are stored only as SHA-256 hashes, and an HttpOnly session cookie. The screens and API routes were also renamed to the current product language, so the shared history now lives at `/archive` with the old `/passport` path kept as a redirect.

## Why

Supabase put our private memories in a third-party service and tied the project to a hosted product I do not control, so owning the database directly fits a two-person app that will live on my own VPS. Holding the data myself also let me enforce review privacy where it actually matters: the state query only returns the other person's review once both have submitted, instead of trusting the browser to hide it. Doing the authentication by hand was the part of the course I most needed to understand rather than outsource.

## What broke or what I got stuck on

The whole server integration is written but has never run against a real PostgreSQL server — the schema tests use in-memory PGlite, which proves the SQL parses and the tables fit together but proves nothing about a live database, sessions surviving a restart, or the two accounts actually being isolated. `npm run check` passes cleanly (lint, TypeScript, 9 tests across 3 files), so the passing checks flatter the project more than they should. Several saved documents in `project/` still carry museum-only wording and the superseded Supabase plan, and the map and photo-upload work is still unfinished, so the server currently accepts text-only experiences and the production catalog would start empty.

## What is left

Next I need to create the dedicated PostgreSQL database, apply the schema, provision the two accounts, and test sign-in, review privacy, mutations, and session persistence end to end against that real server. After that comes the unfinished product work — place creation, a coordinate-based map provider, and private photo upload and delivery — followed by the VPS service, HTTPS proxy, backups, and a tested restore, all kept separate from IGSTPREM. I also still owe the repository README with real screenshots and a pass over the older submission documents to bring their wording up to date.
