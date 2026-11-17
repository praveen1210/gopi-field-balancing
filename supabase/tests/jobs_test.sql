-- pgTAP tests for the job flow. Run with: npm run db:test (local stack only).
begin;
select plan(31);

-- Helpers to act as a caller.
create function pg_temp.as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
create function pg_temp.as_user(p_sub text, p_email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', p_sub, 'email', p_email, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true);
$$;

-- A technician the admin will add.
insert into private.staff (email, name, role) values ('helper@example.com', 'Ravi', 'technician');

-- ---------------------------------------------------------------- website
select pg_temp.as_anon();

select ok(public.submit_job_request(jsonb_build_object(
  'customer_name', 'Kumar', 'phone', '9876543210', 'location', 'Coimbatore',
  'machine_type', 'ID / FD fan', 'rpm', '1450', 'symptoms', jsonb_build_array('High vibration', 'Noise'),
  'urgency', 'Emergency (machine down)')) ~ '^GTG-\d{5}$', 'website submit returns a GTG reference');

select throws_like($$ select public.submit_job_request('{"customer_name":"A","phone":"12","location":"X","machine_type":"Pump"}') $$,
  '%valid phone%', 'bad phone rejected');
select throws_like($$ select public.submit_job_request(jsonb_build_object('customer_name','A','phone','9876543210',
  'location','X','machine_type','Pump','preferred_date', (current_date - 2)::text)) $$,
  '%past%', 'past preferred date rejected');
select throws_ok($$ select public.list_jobs() $$, '42501', null, 'anon cannot list jobs');
select throws_ok($$ select * from private.jobs $$, '42501', null, 'anon cannot read the table');

-- ---------------------------------------------------------------- access
select pg_temp.as_user('00000000-0000-0000-0000-000000000009', 'stranger@example.com');
select throws_like($$ select public.list_jobs() $$, '%does not have access%', 'unknown account blocked');

select pg_temp.as_user('00000000-0000-0000-0000-000000000001', 'GTGvibralgopi@gmail.com');
select is(public.get_my_profile() ->> 'role', 'admin', 'Gopi is admin (email case ignored)');
select is(jsonb_array_length(public.list_jobs('new')), 1, 'admin sees the new request');
select is((public.list_jobs('new') -> 0 ->> 'symptoms'), '["High vibration", "Noise"]', 'symptoms stored');
select is((public.job_counts() ->> 'new')::int, 1, 'counts new');

-- ---------------------------------------------------------------- flow
select pg_temp.as_postgres();
create temp table t as select (select id from private.jobs limit 1) as id,
  (select id from private.staff where email = 'helper@example.com') as helper;
grant select on t to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001', 'gtgvibralgopi@gmail.com');

select throws_like($$ select public.start_job((select id from t)) $$, '%Cannot start a job that is new%',
  'cannot start before scheduling');
select throws_like($$ select public.mark_job_paid((select id from t), 100, 'Cash') $$, '%Cannot mark paid%',
  'cannot pay before completion');

select is(public.schedule_job((select id from t), now() + interval '1 day', (select helper from t), 'Bring 2-plane kit')
  ->> 'status', 'scheduled', 'admin schedules and assigns');
select is(public.schedule_job((select id from t), now() + interval '2 day', (select helper from t))
  ->> 'assigned_name', 'Ravi', 'reschedule keeps assignee name');

-- technician
select pg_temp.as_user('00000000-0000-0000-0000-000000000002', 'helper@example.com');
select is(jsonb_array_length(public.list_jobs()), 1, 'technician sees their assigned job');
select ok(not (public.get_job((select id from t)) ? 'amount'), 'technician does not see money');
select throws_like($$ select public.cancel_job((select id from t), 'x') $$, '%Only the admin%', 'technician cannot cancel');
select throws_like($$ select public.schedule_job((select id from t), now(), (select helper from t)) $$,
  '%Only the admin%', 'technician cannot schedule');
select is(public.start_job((select id from t)) ->> 'status', 'in_progress', 'technician starts work');
select throws_like($$ select public.complete_job((select id from t), '{}') $$, '%after balancing%',
  'after-reading required');
select is(public.complete_job((select id from t), '{"vibration_before":"9.2 mm/s","vibration_after":"1.1 mm/s","balance_grade":"G 6.3","amount":"99999"}')
  ->> 'status', 'completed', 'technician completes');
select is(jsonb_array_length(public.add_job_note((select id from t), 'Customer happy') -> 'events'), 6,
  'timeline: created, scheduled, rescheduled, started, completed, note');

-- admin again
select pg_temp.as_user('00000000-0000-0000-0000-000000000001', 'gtgvibralgopi@gmail.com');
select is(public.get_job((select id from t)) -> 'amount', 'null'::jsonb, 'technician could not set the amount');
select is(public.mark_job_paid((select id from t), 4500, 'UPI') ->> 'status', 'paid', 'admin marks paid');
select is((public.get_job((select id from t)) ->> 'amount')::numeric, 4500::numeric, 'amount saved');
select throws_like($$ select public.cancel_job((select id from t), 'late') $$, '%Cannot cancel a job that is paid%',
  'paid job cannot be cancelled');

-- manual job, cancel, reopen
select is(public.create_job('{"customer_name":"Mill","phone":"+91 98765 43210","location":"Erode","machine_type":"Pump"}')
  ->> 'source', 'manual', 'admin adds a phone-call job');
select is(public.cancel_job((public.list_jobs('new') -> 0 ->> 'id')::uuid, 'Customer postponed') ->> 'status',
  'cancelled', 'admin cancels');
select is(public.reopen_job((public.list_jobs('cancelled') -> 0 ->> 'id')::uuid) ->> 'status', 'new', 'admin reopens');

-- team
select throws_like($$ select public.set_staff_active((public.get_my_profile() ->> 'id')::uuid, false) $$,
  '%own access%', 'admin cannot remove themself');
select is(jsonb_array_length(public.add_staff('New.Helper@Example.com', 'Arun', null, 'technician')), 3,
  'admin adds a helper');

select * from finish();
rollback;
