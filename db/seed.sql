-- Seed the single firm and its people.
-- Fixed UUIDs so that restarting from a clean database keeps the same sign-in list.
-- Roles are NOT set here: a role is a property of a membership on one mandate,
-- not a property of a person, which is what FEAT-001 requires.

INSERT INTO firms (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'INVRT')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, firm_id, name, email) VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', 'Paul Higgins', 'paul@invrt.co'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', 'Alex Doyle',   'alex@invrt.co'),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111111', 'Sam Okafor',   'sam@invrt.co')
ON CONFLICT (id) DO NOTHING;
