-- Run as the project database owner. This migration provisions no users or visits.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.passport_spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100)
);

create table public.passport_members (
  space_id uuid not null references public.passport_spaces(id),
  user_id uuid not null references auth.users(id),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  role text not null check (role in ('owner', 'partner')),
  primary key (space_id, user_id),
  unique (user_id),
  -- Two allowed roles + one row per role = at most two members, even concurrently.
  unique (space_id, role)
);

create table public.places (
  id text primary key,
  slug text not null unique,
  name text not null,
  category text not null check (category in ('Museum', 'Cafe', 'Restaurant', 'Park', 'Heritage', 'District', 'Gallery', 'Walk')),
  address text not null,
  city text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  initials text not null,
  short_description text not null,
  opening_note text
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.passport_spaces(id),
  place_id text not null references public.places(id),
  author_id uuid not null,
  visited_on date not null,
  story text not null check (char_length(btrim(story, E' \n\r\t\f\v')) between 20 and 1200),
  created_at timestamptz not null default now(),
  idempotency_key uuid not null,
  photo_path text,
  photo_alt text check (char_length(photo_alt) <= 240),
  foreign key (space_id, author_id) references public.passport_members(space_id, user_id),
  unique (author_id, idempotency_key)
);

create index visits_space_created_idx on public.visits (space_id, created_at desc);
create index visits_place_idx on public.visits (place_id);

create table public.reviews (
  visit_id uuid not null references public.visits(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  overall integer not null check (overall between 1 and 5),
  reflection text not null check (char_length(btrim(reflection, E' \n\r\t\f\v')) between 8 and 500),
  would_visit_again text not null check (would_visit_again in ('yes', 'maybe', 'no')),
  submitted_at timestamptz not null default now(),
  primary key (visit_id, author_id)
);

-- Definer helpers read membership without recursively applying its own RLS policy.
-- Keep the private schema out of the Supabase Data API exposed schemas.
create function private.current_passport_space()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select m.space_id from public.passport_members m where m.user_id = auth.uid();
$$;

create function private.both_members_reviewed(p_visit_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.visits v
    where v.id = p_visit_id
      and v.space_id = private.current_passport_space()
      and (select count(*) from public.passport_members m where m.space_id = v.space_id) = 2
      and not exists (
        select 1 from public.passport_members m
        where m.space_id = v.space_id and not exists (
          select 1 from public.reviews r
          where r.visit_id = v.id and r.author_id = m.user_id
        )
      )
  );
$$;

revoke all on function private.current_passport_space() from public, anon, authenticated;
revoke all on function private.both_members_reviewed(uuid) from public, anon, authenticated;
grant execute on function private.current_passport_space() to authenticated;
grant execute on function private.both_members_reviewed(uuid) to authenticated;

alter table public.passport_spaces enable row level security;
alter table public.passport_members enable row level security;
alter table public.places enable row level security;
alter table public.visits enable row level security;
alter table public.reviews enable row level security;

create policy space_read on public.passport_spaces for select to authenticated
  using (id = (select private.current_passport_space()));
create policy members_read on public.passport_members for select to authenticated
  using (space_id = (select private.current_passport_space()));
create policy catalog_read on public.places for select to authenticated
  using ((select auth.uid()) is not null);
create policy visits_read on public.visits for select to authenticated
  using (space_id = (select private.current_passport_space()));
create policy reviews_read on public.reviews for select to authenticated
  using (
    exists (
      select 1 from public.visits v
      where v.id = reviews.visit_id and v.space_id = (select private.current_passport_space())
    )
    and (author_id = (select auth.uid()) or private.both_members_reviewed(visit_id))
  );

-- No browser may provision membership or write tables directly, including owners.
revoke all on table public.passport_spaces, public.passport_members, public.places,
  public.visits, public.reviews from public, anon, authenticated;
grant select on table public.passport_spaces, public.passport_members, public.places,
  public.visits, public.reviews to authenticated;

create function public.publish_experience(
  p_place_id text,
  p_visited_on date,
  p_story text,
  p_overall integer,
  p_reflection text,
  p_revisit text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_space_id uuid;
  v_visit_id uuid;
  v_story text := btrim(p_story, E' \n\r\t\f\v');
  v_reflection text := btrim(p_reflection, E' \n\r\t\f\v');
begin
  if v_user_id is null then
    raise exception 'Sign in before publishing.' using errcode = '42501';
  end if;
  select m.space_id into v_space_id from public.passport_members m where m.user_id = v_user_id;
  if v_space_id is null then
    raise exception 'An invited passport membership is required.' using errcode = '42501';
  end if;
  if p_place_id is null or not exists (select 1 from public.places p where p.id = p_place_id) then
    raise exception 'Choose an available place.' using errcode = '22023';
  end if;
  if p_visited_on is null or not isfinite(p_visited_on)
     or p_visited_on < date '0001-01-01'
     or p_visited_on > (now() at time zone 'Asia/Manila')::date then
    raise exception 'Choose a valid visit date, no later than today in the Philippines.' using errcode = '22023';
  end if;
  if v_story is null or char_length(v_story) not between 20 and 1200 then
    raise exception 'The story must contain 20 to 1200 characters.' using errcode = '22023';
  end if;
  if p_overall is null or p_overall not between 1 and 5 then
    raise exception 'Choose a whole-number rating from 1 to 5.' using errcode = '22023';
  end if;
  if v_reflection is null or char_length(v_reflection) not between 8 and 500 then
    raise exception 'The reflection must contain 8 to 500 characters.' using errcode = '22023';
  end if;
  if p_revisit is null or p_revisit not in ('yes', 'maybe', 'no') or p_idempotency_key is null then
    raise exception 'A revisit answer and request identifier are required.' using errcode = '22023';
  end if;

  insert into public.visits (space_id, place_id, author_id, visited_on, story, idempotency_key)
  values (v_space_id, p_place_id, v_user_id, p_visited_on, v_story, p_idempotency_key)
  on conflict (author_id, idempotency_key) do nothing
  returning id into v_visit_id;

  if v_visit_id is null then
    -- A concurrent identical retry waits on the unique constraint, then sees the
    -- committed visit and review together. Reusing a key for new content is invalid.
    select v.id into v_visit_id from public.visits v
    join public.reviews r on r.visit_id = v.id and r.author_id = v_user_id
    where v.author_id = v_user_id and v.idempotency_key = p_idempotency_key
      and v.space_id = v_space_id and v.place_id = p_place_id
      and v.visited_on = p_visited_on and v.story = v_story
      and r.overall = p_overall and r.reflection = v_reflection
      and r.would_visit_again = p_revisit;
    if v_visit_id is null then
      raise exception 'This request identifier was already used for another experience.' using errcode = '22023';
    end if;
    return v_visit_id;
  end if;

  insert into public.reviews (visit_id, author_id, overall, reflection, would_visit_again)
  values (v_visit_id, v_user_id, p_overall, v_reflection, p_revisit);
  return v_visit_id;
end;
$$;

-- Reviews are final once submitted, so a
-- member cannot read the partner's score and then silently change their own.
create function public.submit_review(
  p_visit_id uuid,
  p_overall integer,
  p_reflection text,
  p_revisit text
)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reflection text := btrim(p_reflection, E' \n\r\t\f\v');
begin
  if v_user_id is null or not exists (
    select 1 from public.visits v join public.passport_members m on m.space_id = v.space_id
    where v.id = p_visit_id and m.user_id = v_user_id
  ) then
    raise exception 'This experience is not available to your membership.' using errcode = '42501';
  end if;
  if p_overall is null or p_overall not between 1 and 5
     or v_reflection is null or char_length(v_reflection) not between 8 and 500
     or p_revisit is null or p_revisit not in ('yes', 'maybe', 'no') then
    raise exception 'A valid rating, reflection, and revisit answer are required.' using errcode = '22023';
  end if;
  insert into public.reviews (visit_id, author_id, overall, reflection, would_visit_again)
  values (p_visit_id, v_user_id, p_overall, v_reflection, p_revisit)
  on conflict (visit_id, author_id) do nothing;
  if not exists (
    select 1 from public.reviews r where r.visit_id = p_visit_id and r.author_id = v_user_id
      and r.overall = p_overall and r.reflection = v_reflection and r.would_visit_again = p_revisit
  ) then
    raise exception 'Your review has already been submitted and cannot be changed.' using errcode = '22023';
  end if;
  return p_visit_id;
end;
$$;

revoke all on function public.publish_experience(text, date, text, integer, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.submit_review(uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.publish_experience(text, date, text, integer, text, text, uuid)
  to authenticated;
grant execute on function public.submit_review(uuid, integer, text, text)
  to authenticated;

-- Catalog descriptions are carried over from the design prototype, not verified
-- venue metadata. No demo members, visit history, scores, or schedules are seeded.
insert into public.places (id, slug, name, category, address, city, latitude, longitude, initials, short_description, opening_note)
values
  ('place-nmfa', 'national-museum-of-fine-arts', 'National Museum of Fine Arts', 'Museum', 'Padre Burgos Avenue, Ermita', 'Manila', 14.5869, 120.9816, 'NM', 'Quiet galleries, familiar works, and an afternoon that deserved a second lap.', 'Open Tuesday to Sunday'),
  ('place-luna', 'luna-cafe', 'Luna Café', 'Cafe', 'Legazpi Village', 'Makati', 14.5538, 121.0177, 'LC', 'A warm corner for dessert, long conversations, and rainy-window memories.', 'Open daily until 10 PM'),
  ('place-bgc', 'bgc-high-street', 'BGC High Street', 'District', 'Bonifacio Global City', 'Taguig', 14.5507, 121.0508, 'BH', 'An easy evening walk with bookstores, public art, and space to wander.', 'Best after sunset'),
  ('place-ayala-triangle', 'ayala-triangle', 'Ayala Triangle', 'Park', 'Ayala Avenue', 'Makati', 14.5568, 121.0232, 'AT', 'A shaded pause in the city for a slow Sunday walk and an early dinner.', 'Open daily'),
  ('place-first-united', 'first-united-building', 'First United Building', 'Heritage', 'Escolta Street', 'Manila', 14.5967, 120.9782, 'FU', 'A heritage stop for old Manila details, creative shops, and a walk along Escolta.', null),
  ('place-pinto', 'pinto-art-museum', 'Pinto Art Museum', 'Gallery', 'Sierra Madre Street', 'Antipolo', 14.5812, 121.1669, 'PA', 'Open-air galleries and garden paths saved for an unhurried day together.', null),
  ('place-binondo', 'binondo-food-walk', 'Binondo Food Walk', 'Walk', 'Ongpin Street', 'Manila', 14.6001, 120.9744, 'BF', 'A shared list of dumplings, bakeries, and small stops to try in one afternoon.', null);

commit;
