# Private passport database

This is a fresh-project migration, not an upgrade for an existing database with matching tables. It creates a private two-person passport, a seven-place starter catalog, and no sample visits. The catalog is copied from the existing prototype; venue details and hours are not verified listings.

## 1. Create and configure a Supabase project

1. Create a Supabase project you control. In Authentication settings, enable email/password sign-in and disable public sign-ups. Do not enable anonymous sign-in.
2. Set Authentication → URL Configuration → Site URL to the app's exact origin (`http://localhost:3000` for local development). For deployment, use the production HTTPS origin and restrict additional redirect URLs to origins/routes you actually use. The current password sign-in flow does not require an OAuth callback route.
3. In the SQL Editor, run the entire `supabase/migrations/202609200001_private_passport.sql` file as the database owner. The migration is transactional. Run it once against a new database; do not rerun it over existing tables.
4. Leave `private` out of the Data API exposed schemas. Its narrowly scoped functions exist only to support RLS. Exposing `public` is expected.

You may instead apply the migration with your existing Supabase CLI migration workflow. Review the selected project before any remote migration; no remote project has been configured or changed by adding these files.

## 2. Provision exactly two invited members

Authentication and membership are separate: creating an Auth user alone grants no passport access. There is no signup trigger that creates a passport or membership.

Create the two intended email/password users in Authentication → Users (Add user → Create new user), using strong temporary passwords delivered privately. Confirm their emails administratively only when you have verified their identities. An email invitation is also possible, but requires a supported invitation/password-setup flow; that UI is not part of this milestone. Do not put passwords in SQL, source code, or `.env` files.

Copy the two user IDs from Authentication → Users. Replace both UUID placeholders and display names below, then run this block in the SQL Editor as the database owner. Run it once; the unique membership constraints reject duplicate users/roles.

```sql
begin;
do $$
declare
  passport_id uuid;
begin
  insert into public.passport_spaces (name)
  values ('Our Places Passport') returning id into passport_id;

  insert into public.passport_members (space_id, user_id, display_name, role)
  values
    (passport_id, 'REPLACE-WITH-FIRST-AUTH-USER-UUID'::uuid, 'Your name', 'owner'),
    (passport_id, 'REPLACE-WITH-SECOND-AUTH-USER-UUID'::uuid, 'Partner name', 'partner');
end;
$$;
commit;
```

The application cannot provision or change memberships. Each Auth user can belong to one passport, and a passport supports one owner and one partner. `UNIQUE (space_id, role)` enforces the two-member ceiling even when administrators insert concurrently. The owner label does not grant additional database write privileges. Administrative accounts and Supabase service credentials remain trusted privileged access; never expose them to the client.

## 3. Configure the application

Copy `.env.example` to `.env.local`, and set only the project URL and publishable key from the Supabase project Connect/API settings:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

Restart the development server after changing environment variables. A publishable key identifies the project; authorization comes from each signed-in user's session and database RLS. Do not use a secret key or legacy `service_role` key in this app. Keep `.env.local` uncommitted.

## Database/API contract

- `passport_spaces`, `passport_members`, `visits`, and `reviews`: authenticated reads are restricted to the current user's one passport. A signed-in outsider receives no private rows. The place catalog is readable by signed-in users only.
- Reviews: a member can read their own review immediately. The partner's score/reflection becomes readable only when both currently provisioned members have submitted a review for that visit. The rule is enforced by RLS, not just by hiding UI.
- No anonymous reads, direct client table inserts/updates/deletes, membership self-enrollment, or client-supplied author/space IDs are allowed.
- `publish_experience(p_place_id text, p_visited_on date, p_story text, p_overall integer, p_reflection text, p_revisit text, p_idempotency_key uuid) → uuid` creates the visit and the author's initial review in one transaction. It derives author/space from `auth.uid()`. Story length is 20–1200, reflection 8–500, rating 1–5, and revisit is `yes`, `maybe`, or `no`. Dates must be finite, at least year 1, and no later than the current Philippine calendar day (`Asia/Manila`).
- The publication idempotency key is unique per author. Repeating the same key and normalized payload returns the existing visit ID; reusing the key for different content fails without creating another row.
- `submit_review(p_visit_id uuid, p_overall integer, p_reflection text, p_revisit text) → uuid` validates membership and inputs and returns the visit ID. Identical retries succeed; submitted reviews cannot be changed to prevent changing a score after seeing the partner's answer.
- `photo_path` and `photo_alt` are nullable reserved fields. This migration creates no storage buckets or upload policies, and publication does not accept a photo. Photo upload is not implemented.

Database errors use SQLSTATE `42501` for unavailable membership/access, `22023` for invalid submitted fields or conflicting retries, and standard constraint errors for provisioning mistakes.

## Verify before production use

Run `npm test -- src/lib/passport-database.test.ts` for isolated PostgreSQL-compatible database tests with PGlite. These tests exercise the migration, role grants, RLS, atomic publication, idempotency, and the blind-review gate without requiring credentials. They do not exercise hosted Supabase Auth, network requests, or separate concurrent PostgreSQL connections.

In a separate test Supabase project, also sign in as each member and an unrelated user. Confirm that only members see visit history, the second member cannot read the first review until submitting their own, direct table writes fail, and two retries with the same publication key produce one visit. Check anonymous REST requests with the publishable key fail for private tables and RPCs. Do not run destructive smoke tests against real personal history.

Security design follows Supabase's [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [database function security guidance](https://supabase.com/docs/guides/database/functions): private non-recursive helpers, empty `search_path` on definer functions, schema-qualified objects, and explicit execution grants.
