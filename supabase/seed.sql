-- LOCAL DEVELOPMENT ONLY (npm run db:reset). Never run against a hosted project.
-- Test team: sign up in the app (web or phone) with these emails.
--   admin@gtg.test / GtgLocal#2026  (admin)
--   tech@gtg.test  / GtgLocal#2026  (technician)
insert into private.staff (email, name, role, phone) values
  ('admin@gtg.test', 'Test Admin', 'admin', '9000000001'),
  ('tech@gtg.test', 'Ravi (test)', 'technician', '9000000002')
on conflict (email) do nothing;
