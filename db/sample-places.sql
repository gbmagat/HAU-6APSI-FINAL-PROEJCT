-- Sample places for a freshly provisioned Our Places database.
-- There is no "Add place" screen yet, so places are added with SQL. Run after provisioning:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/sample-places.sql
-- To add your own place, copy one row and change its values. Each id and slug must be new.
-- For coordinates, right-click the spot on openstreetmap.org and choose "Show address".
-- status is one of: want-to-visit, planned, visited. planned_for is a date or null.
-- country decides Local or International in the app; anything other than Philippines is International.
begin;

insert into places (id, space_id, slug, name, category, address, city, country, latitude, longitude,
                    initials, short_description, opening_note, status, planned_for)
select v.id, s.id, v.slug, v.name, v.category, v.address, v.city, v.country, v.latitude, v.longitude,
       v.initials, v.short_description, v.opening_note, v.status, v.planned_for::date
  from (select id from spaces) as s
 cross join (values
  ('place-nmfa', 'national-museum-of-fine-arts', 'National Museum of Fine Arts', 'Museum',
   'Padre Burgos Avenue, Ermita', 'Manila', 'Philippines', 14.5869, 120.9816, 'NM',
   'Quiet galleries, familiar works, and an afternoon that deserves a second lap.', 'Open Tuesday to Sunday', 'want-to-visit', null),
  ('place-luna', 'luna-cafe', 'Luna Café', 'Cafe',
   'Legazpi Village', 'Makati', 'Philippines', 14.5538, 121.0177, 'LC',
   'A warm corner for dessert, long conversations, and rainy-window memories.', 'Open daily until 10 PM', 'want-to-visit', null),
  ('place-bgc', 'bgc-high-street', 'BGC High Street', 'District',
   'Bonifacio Global City', 'Taguig', 'Philippines', 14.5507, 121.0508, 'BH',
   'An easy evening walk with bookstores, public art, and space to wander.', 'Best after sunset', 'planned', '2026-10-17'),
  ('place-ayala-triangle', 'ayala-triangle', 'Ayala Triangle', 'Park',
   'Ayala Avenue', 'Makati', 'Philippines', 14.5568, 121.0232, 'AT',
   'A shaded pause in the city for a slow Sunday walk and an early dinner.', 'Open daily', 'planned', '2026-10-24'),
  ('place-first-united', 'first-united-building', 'First United Building', 'Heritage',
   'Escolta Street', 'Manila', 'Philippines', 14.5967, 120.9782, 'FU',
   'A heritage stop for old Manila details, creative shops, and a walk along Escolta.', null, 'want-to-visit', null),
  ('place-pinto', 'pinto-art-museum', 'Pinto Art Museum', 'Gallery',
   'Sierra Madre Street', 'Antipolo', 'Philippines', 14.5812, 121.1669, 'PA',
   'Open-air galleries and garden paths saved for an unhurried day together.', null, 'planned', '2026-11-07'),
  ('place-binondo', 'binondo-food-walk', 'Binondo Food Walk', 'Walk',
   'Ongpin Street', 'Manila', 'Philippines', 14.6001, 120.9744, 'BF',
   'A shared list of dumplings, bakeries, and small stops to try in one afternoon.', null, 'want-to-visit', null),
  ('place-teamlab-planets', 'teamlab-planets', 'teamLab Planets', 'Museum',
   'Toyosu, Koto City', 'Tokyo', 'Japan', 35.6491, 139.7898, 'TP',
   'Walk-through light and water rooms saved for our first trip to Tokyo.', null, 'want-to-visit', null),
  ('place-gardens-by-the-bay', 'gardens-by-the-bay', 'Gardens by the Bay', 'Park',
   'Marina Gardens Drive', 'Singapore', 'Singapore', 1.2816, 103.8636, 'GB',
   'Supertrees at night and the cloud forest on a long layover.', null, 'want-to-visit', null)
 ) as v(id, slug, name, category, address, city, country, latitude, longitude,
        initials, short_description, opening_note, status, planned_for);

commit;
