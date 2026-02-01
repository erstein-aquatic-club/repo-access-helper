-- Seed default swimming groups for Erstein Aquatic Club.
-- Mirrors the old Cloudflare D1 DIM_groupes table structure.
-- These can be edited/extended later via the admin panel.

-- Populate the groups table (used by api.getGroups() and group_members)
INSERT INTO groups (name, description) VALUES
  ('Avenirs',    'Nageurs de 6 à 9 ans'),
  ('Poussins',   'Nageurs de 9 à 11 ans'),
  ('Benjamins',  'Nageurs de 11 à 13 ans'),
  ('Minimes',    'Nageurs de 13 à 15 ans'),
  ('Cadets',     'Nageurs de 15 à 17 ans'),
  ('Juniors',    'Nageurs de 17 à 18 ans'),
  ('Seniors',    'Nageurs de 18 ans et plus'),
  ('Maîtres',    'Nageurs adultes (25+)'),
  ('Loisirs',    'Pratique loisir, tous âges')
ON CONFLICT (name) DO NOTHING;

-- Keep dim_groupes in sync (legacy dimension table used by the old Worker)
INSERT INTO dim_groupes (name, description) VALUES
  ('Avenirs',    'Nageurs de 6 à 9 ans'),
  ('Poussins',   'Nageurs de 9 à 11 ans'),
  ('Benjamins',  'Nageurs de 11 à 13 ans'),
  ('Minimes',    'Nageurs de 13 à 15 ans'),
  ('Cadets',     'Nageurs de 15 à 17 ans'),
  ('Juniors',    'Nageurs de 17 à 18 ans'),
  ('Seniors',    'Nageurs de 18 ans et plus'),
  ('Maîtres',    'Nageurs adultes (25+)'),
  ('Loisirs',    'Pratique loisir, tous âges')
ON CONFLICT (name) DO NOTHING;
