# Our Places on a private Ubuntu VPS

This application now uses its own PostgreSQL database and Next.js route handlers. Supabase is not part of the runtime. Keep the database, app process, service account, and future file storage separate from IGSTPREM, even if both apps share a VPS.

## Prepare the database

1. Create a new PostgreSQL database and a dedicated login role for this app. Do not reuse an existing database or IGSTPREM credentials. Keep PostgreSQL private to the VPS.
2. On that new, empty database, apply `db/schema.sql` once with `psql -h 127.0.0.1 -U our_places_app -d our_places -v ON_ERROR_STOP=1 -f db/schema.sql` (replace the example role/database names). Verify the target first; the schema is not a migration for an existing app.
3. Set `DATABASE_URL` in a protected server-only environment file. Never use a `NEXT_PUBLIC_` variable for it or commit the real value.
4. In an interactive terminal, run `node scripts/provision-space.mjs --database our_places --owner-email YOU@example.com --owner-name "Your name" --partner-email PARTNER@example.com --partner-name "Partner name"`. Replace the placeholders and use the actual dedicated database name. The script checks the target, asks for confirmation, and prompts for passwords without echo.

5. Add places with SQL, since there is no "Add place" screen yet: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/sample-places.sql` loads seven sample places, and the file shows how to add your own.

There is no public registration. The two accounts share one space. Private sessions are stored in PostgreSQL; the browser receives only a Secure, HttpOnly session cookie when running over HTTPS.

## Run and isolate

Run `npm ci`, `npm run check`, `npm run build`, and `npm run start` under a separate, unprivileged Ubuntu service account. Bind the app to a loopback port and place an HTTPS reverse proxy in front of it on the future Our Places subdomain. Do not alter IGSTPREM's service, database, or existing proxy entry. Back up the database regularly and test restoration before storing real memories.

With no `DATABASE_URL`, development keeps the browser-only preview. Production locks private pages instead of exposing that preview. The old `supabase/` directory is historical design work only; do not apply its migration to this PostgreSQL database.

## Photos

Set `PHOTO_DIR` to a private directory owned by the service account, for example `/var/lib/our-places/photos`, and never inside `public/`. Back it up with the database, since visits point at files there. The reverse proxy must accept uploads of at least 10 MB (for nginx, `client_max_body_size 10m;`).

## Plan and review reminders

Reminder emails need `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `APP_URL` in the service's environment file, readable only by the service account. The app checks for due reminders every two minutes and stamps each plan before sending, so a restart or a second process never sends the same reminder twice. Without SMTP settings, messages are written to `storage/outbox` (or `MAIL_OUTBOX_DIR`) instead. Many VPS providers block outgoing port 25; use port 587 or 465 with a mail provider.

The same schedule emails a member when their partner logged a visit 15 minutes ago that they have not reviewed (the `review_reminders` setting), once per visit.

Databases created before these reminders need `db/migrations/001-plan-reminders.sql` and then `db/migrations/002-review-reminders.sql`. The second marks existing visits as already reminded, so no one gets emails about old visits.

## Road tiles

Routes save the OpenStreetMap roads they download in `ROAD_CACHE_DIR` (default `./storage/roads`), one file per map tile, refreshed after 30 days. The service account needs write access there. It is a cache: it does not need backups and can be deleted at any time.

## Before deployment

- The exact subdomain and current VPS reverse-proxy configuration still need to be chosen and checked.
