-- ============================================================================
-- GTG Vibral: job requests from the website, scheduled and tracked in the app
-- ----------------------------------------------------------------------------
-- Tables live in the `private` schema, which the API cannot reach. anon and
-- authenticated get no table privileges at all; every read and write goes
-- through the SECURITY DEFINER functions below (owned by the migration role,
-- which owns the tables, so RLS with no policies only blocks everyone else).
--
--   anon          -> submit_job_request, health_check
--   team member   -> get_my_profile, list_jobs, get_job, job_counts, actions
--   admin         -> everything, plus team management and money
--
-- A team member is a row in private.staff whose email matches the signed-in
-- user's verified JWT email. Technicians see only the jobs assigned to them.
--
-- Job flow:
--   new -> scheduled -> in_progress -> completed -> paid
--   new | scheduled | in_progress -> cancelled -> (reopen) new
-- Every change is written to private.job_events, the job's timeline.
-- ============================================================================

begin;

create extension if not exists pg_net;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
create table private.staff (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique,
  email      text not null unique check (email = lower(btrim(email)) and email like '%_@_%'),
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  phone      text check (phone is null or char_length(phone) <= 20),
  role       text not null default 'technician' check (role in ('admin', 'technician')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create sequence private.job_reference_seq;

create table private.jobs (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique
                     default 'GTG-' || lpad(nextval('private.job_reference_seq')::text, 5, '0'),
  status             text not null default 'new'
                     check (status in ('new', 'scheduled', 'in_progress', 'completed', 'paid', 'cancelled')),
  source             text not null default 'website' check (source in ('website', 'manual')),
  -- Customer
  customer_name      text not null check (char_length(customer_name) between 1 and 80),
  company            text check (char_length(company) <= 120),
  phone              text not null check (phone ~ '^\+?[0-9 -]{8,16}$'),
  email              text check (char_length(email) <= 120),
  location           text not null check (char_length(location) between 2 and 300),
  -- Machine
  machine_type       text not null check (char_length(machine_type) between 1 and 80),
  quantity           integer not null default 1 check (quantity between 1 and 100),
  rpm                integer check (rpm between 0 and 200000),
  power              text check (char_length(power) <= 40),
  rotor_weight       text check (char_length(rotor_weight) <= 40),
  rotor_diameter     text check (char_length(rotor_diameter) <= 40),
  mounting           text check (char_length(mounting) <= 60),
  brand_model        text check (char_length(brand_model) <= 80),
  -- Problem and request
  symptoms           text[] not null default '{}' check (cardinality(symptoms) <= 10),
  vibration_reading  text check (char_length(vibration_reading) <= 120),
  service            text check (char_length(service) <= 80),
  notes              text check (char_length(notes) <= 2000),
  preferred_date     date,
  urgency            text check (char_length(urgency) <= 60),
  -- Schedule
  scheduled_at       timestamptz,
  assigned_to        uuid references private.staff (id) on delete set null,
  started_at         timestamptz,
  -- Result
  completed_at       timestamptz,
  vibration_before   text check (char_length(vibration_before) <= 200),
  vibration_after    text check (char_length(vibration_after) <= 200),
  balance_grade      text check (char_length(balance_grade) <= 20),
  correction_details text check (char_length(correction_details) <= 1000),
  work_summary       text check (char_length(work_summary) <= 2000),
  -- Money (admins only)
  amount             numeric(12, 2) check (amount >= 0),
  payment_mode       text check (char_length(payment_mode) <= 40),
  paid_at            timestamptz,
  cancelled_reason   text check (char_length(cancelled_reason) <= 500),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index jobs_status_idx on private.jobs (status);
create index jobs_scheduled_at_idx on private.jobs (scheduled_at);
create index jobs_assigned_to_idx on private.jobs (assigned_to);
create index jobs_created_at_idx on private.jobs (created_at desc);

create table private.job_events (
  id         bigint generated always as identity primary key,
  job_id     uuid not null references private.jobs (id) on delete cascade,
  event      text not null check (event in (
               'created', 'updated', 'scheduled', 'rescheduled', 'started',
               'completed', 'paid', 'cancelled', 'reopened', 'note')),
  note       text check (char_length(note) <= 1000),
  actor_name text,
  created_at timestamptz not null default now()
);

create index job_events_job_idx on private.job_events (job_id, created_at);

create table private.push_tokens (
  token      text primary key check (char_length(token) <= 200),
  staff_id   uuid not null references private.staff (id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table private.submission_throttle (
  id         bigint generated always as identity primary key,
  client_key text not null,
  created_at timestamptz not null default now()
);

create index submission_throttle_client_idx on private.submission_throttle (client_key, created_at desc);
create index submission_throttle_created_idx on private.submission_throttle (created_at);

do $$
declare t text;
begin
  foreach t in array array['staff', 'jobs', 'job_events', 'push_tokens', 'submission_throttle'] loop
    execute format('alter table private.%I enable row level security', t);
    execute format('revoke all on private.%I from public, anon, authenticated', t);
  end loop;
end $$;
revoke all on sequence private.job_reference_seq from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Helpers (private, not callable through the API)
-- ----------------------------------------------------------------------------

-- Empty strings become null; everything is trimmed.
create function private.clean(p_value text)
returns text language sql immutable set search_path = '' as $$
  select nullif(btrim(p_value), '');
$$;

-- The signed-in team member. Links the auth user on first sign-in.
create function private.current_staff()
returns private.staff
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_staff private.staff;
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'Please sign in.' using errcode = '42501';
  end if;

  select * into v_staff from private.staff where email = v_email and active;
  if not found then
    raise exception 'This account does not have access to GTG Vibral. Ask the admin to add %.', v_email
      using errcode = '42501';
  end if;

  if v_staff.user_id is distinct from auth.uid() then
    update private.staff set user_id = auth.uid() where id = v_staff.id returning * into v_staff;
  end if;
  return v_staff;
end $$;

create function private.require_admin()
returns private.staff
language plpgsql security definer set search_path = '' as $$
declare v_staff private.staff := private.current_staff();
begin
  if v_staff.role <> 'admin' then
    raise exception 'Only the admin can do this.' using errcode = '42501';
  end if;
  return v_staff;
end $$;

-- A job the caller may see, locked for update. Technicians only get their own.
create function private.load_job(p_id uuid, p_staff private.staff)
returns private.jobs
language plpgsql security definer set search_path = '' as $$
declare v_job private.jobs;
begin
  select * into v_job from private.jobs where id = p_id for update;
  if not found or (p_staff.role <> 'admin' and v_job.assigned_to is distinct from p_staff.id) then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;
  return v_job;
end $$;

create function private.log_event(p_job_id uuid, p_event text, p_note text, p_actor text)
returns void language sql security definer set search_path = '' as $$
  insert into private.job_events (job_id, event, note, actor_name)
  values (p_job_id, p_event, private.clean(p_note), p_actor);
$$;

create function private.wrong_status(p_job private.jobs, p_action text)
returns void language plpgsql set search_path = '' as $$
begin
  raise exception 'Cannot % a job that is %.', p_action, replace(p_job.status, '_', ' ')
    using errcode = 'P0001';
end $$;

-- Sends an Expo push notification to every phone of the given team members.
-- Never fails the caller: a missing token or network problem only logs.
create function private.send_push(p_staff_ids uuid[], p_title text, p_body text, p_job_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
           'to', t.token, 'title', p_title, 'body', p_body,
           'sound', 'default', 'priority', 'high', 'channelId', 'jobs',
           'data', jsonb_build_object('jobId', p_job_id)))
    into v_messages
    from private.push_tokens t
    join private.staff s on s.id = t.staff_id and s.active
   where t.staff_id = any (p_staff_ids);

  if v_messages is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_messages,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'));
  end if;
exception when others then
  raise warning 'push notification skipped: %', sqlerrm;
end $$;

-- Website abuse protection: 30 submissions a minute overall, 5 an hour per
-- network. Network keys are md5 hashes and are purged after a day.
create function private.assert_submission_allowed()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_headers json;
  v_ip      text;
  v_key     text;
  v_recent  integer;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;
  v_ip := btrim(split_part(coalesce(
    v_headers ->> 'cf-connecting-ip', v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1));

  delete from private.submission_throttle where created_at < now() - interval '1 day';

  select count(*) into v_recent from private.submission_throttle
   where created_at > now() - interval '1 minute';
  if v_recent >= 30 then
    raise exception 'Too many requests right now. Please try again in a minute.';
  end if;

  v_key := case when v_ip <> '' then md5(v_ip) else 'unknown' end;
  if v_ip <> '' then
    select count(*) into v_recent from private.submission_throttle
     where client_key = v_key and created_at > now() - interval '1 hour';
    if v_recent >= 5 then
      raise exception 'Too many requests from this network. Please call or WhatsApp us instead.';
    end if;
  end if;

  insert into private.submission_throttle (client_key) values (v_key);
end $$;

-- Job as the app sees it: assignee name, money hidden from technicians.
create function private.job_json(p_job private.jobs, p_staff private.staff)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(p_job)
         - case when p_staff.role = 'admin' then '' else 'amount' end
         - case when p_staff.role = 'admin' then '' else 'payment_mode' end
         || jsonb_build_object(
              'assigned_name', (select s.name from private.staff s where s.id = p_job.assigned_to),
              'job_date', (coalesce((p_job.scheduled_at at time zone 'Asia/Kolkata')::date,
                                    p_job.preferred_date,
                                    (p_job.created_at at time zone 'Asia/Kolkata')::date)));
$$;

-- Shared validation for website and manual jobs.
create function private.insert_job(p jsonb, p_source text, p_actor text)
returns private.jobs
language plpgsql security definer set search_path = '' as $$
declare
  v_job      private.jobs;
  v_symptoms text[];
  v_date     date := nullif(p ->> 'preferred_date', '')::date;
begin
  if private.clean(p ->> 'customer_name') is null then raise exception 'Please enter your name.'; end if;
  if coalesce(private.clean(p ->> 'phone'), '') !~ '^\+?[0-9 -]{8,16}$' then
    raise exception 'Please enter a valid phone number.';
  end if;
  if private.clean(p ->> 'location') is null then raise exception 'Please enter the site address or city.'; end if;
  if private.clean(p ->> 'machine_type') is null then raise exception 'Please choose the machine type.'; end if;
  if p_source = 'website' and v_date < (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'The preferred date cannot be in the past.';
  end if;

  select coalesce(array_agg(private.clean(s)) filter (where private.clean(s) is not null), '{}')
    into v_symptoms
    from jsonb_array_elements_text(coalesce(p -> 'symptoms', '[]'::jsonb)) as s;

  insert into private.jobs (
    source, customer_name, company, phone, email, location, machine_type, quantity, rpm,
    power, rotor_weight, rotor_diameter, mounting, brand_model, symptoms, vibration_reading,
    service, notes, preferred_date, urgency)
  values (
    p_source,
    private.clean(p ->> 'customer_name'), private.clean(p ->> 'company'),
    private.clean(p ->> 'phone'), lower(private.clean(p ->> 'email')),
    private.clean(p ->> 'location'), private.clean(p ->> 'machine_type'),
    coalesce(nullif(p ->> 'quantity', '')::integer, 1), nullif(p ->> 'rpm', '')::integer,
    private.clean(p ->> 'power'), private.clean(p ->> 'rotor_weight'),
    private.clean(p ->> 'rotor_diameter'), private.clean(p ->> 'mounting'),
    private.clean(p ->> 'brand_model'), v_symptoms, private.clean(p ->> 'vibration_reading'),
    private.clean(p ->> 'service'), private.clean(p ->> 'notes'), v_date,
    private.clean(p ->> 'urgency'))
  returning * into v_job;

  perform private.log_event(v_job.id, 'created',
    case p_source when 'website' then 'Request received from the website' else 'Added in the app' end,
    p_actor);
  return v_job;
end $$;

-- ----------------------------------------------------------------------------
-- Public website
-- ----------------------------------------------------------------------------

/** Customer order from the website. Returns only the reference. */
create function public.submit_job_request(p_request jsonb)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_job    private.jobs;
  v_admins uuid[];
begin
  perform private.assert_submission_allowed();
  v_job := private.insert_job(p_request, 'website', private.clean(p_request ->> 'customer_name'));

  select array_agg(id) into v_admins from private.staff where role = 'admin' and active;
  perform private.send_push(v_admins, 'New job request',
    v_job.machine_type || ' · ' || v_job.customer_name || ' · ' || split_part(v_job.location, ',', 1)
      || coalesce(' · ' || v_job.urgency, ''),
    v_job.id);
  return v_job.reference;
end $$;

/** Keep-alive ping so a free project is never paused for inactivity. */
create function public.health_check()
returns text language sql stable set search_path = '' as $$ select 'ok'; $$;

-- ----------------------------------------------------------------------------
-- App: reading
-- ----------------------------------------------------------------------------

create function public.get_my_profile()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_staff private.staff := private.current_staff();
begin
  return jsonb_build_object('id', v_staff.id, 'name', v_staff.name, 'email', v_staff.email,
                            'role', v_staff.role, 'phone', v_staff.phone);
end $$;

/**
 * Jobs, newest work first. p_status filters one status ('open' = new,
 * scheduled and in progress); p_from/p_to filter the job date (scheduled day,
 * else preferred day, else the day it came in, Indian time); p_search matches
 * reference, customer, company, phone, location or machine.
 */
create function public.list_jobs(
  p_status text default null,
  p_from   date default null,
  p_to     date default null,
  p_search text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_staff  private.staff := private.current_staff();
  v_search text := '%' || lower(coalesce(private.clean(p_search), '')) || '%';
begin
  return coalesce((
    select jsonb_agg(j.data order by j.sort_at)
      from (
        select private.job_json(job, v_staff) as data,
               case when job.status in ('new', 'cancelled') then job.created_at
                    else coalesce(job.scheduled_at, job.created_at) end as sort_at,
               (private.job_json(job, v_staff) ->> 'job_date')::date as job_date
          from private.jobs job
         where (v_staff.role = 'admin' or job.assigned_to = v_staff.id)
           and (p_status is null
                or job.status = p_status
                or (p_status = 'open' and job.status in ('new', 'scheduled', 'in_progress')))
           and (p_search is null or lower(concat_ws(' ', job.reference, job.customer_name, job.company,
                 job.phone, job.location, job.machine_type)) like v_search)
      ) j
     where (p_from is null or j.job_date >= p_from)
       and (p_to is null or j.job_date <= p_to)
  ), '[]'::jsonb);
end $$;

create function public.get_job(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_staff private.staff := private.current_staff();
  v_job   private.jobs;
begin
  select * into v_job from private.jobs where id = p_id;
  if not found or (v_staff.role <> 'admin' and v_job.assigned_to is distinct from v_staff.id) then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;
  return private.job_json(v_job, v_staff) || jsonb_build_object('events', coalesce((
    select jsonb_agg(jsonb_build_object('event', e.event, 'note', e.note,
                                        'actor_name', e.actor_name, 'created_at', e.created_at)
                     order by e.created_at, e.id)
      from private.job_events e where e.job_id = p_id), '[]'::jsonb));
end $$;

/** Counts for the home screen. */
create function public.job_counts()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_staff private.staff := private.current_staff();
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  return (
    select jsonb_build_object(
      'new',         count(*) filter (where status = 'new'),
      'scheduled',   count(*) filter (where status = 'scheduled'),
      'in_progress', count(*) filter (where status = 'in_progress'),
      'completed',   count(*) filter (where status = 'completed'),
      'today',       count(*) filter (where status in ('scheduled', 'in_progress')
                                        and (scheduled_at at time zone 'Asia/Kolkata')::date = v_today),
      'unpaid_amount', case when v_staff.role = 'admin'
                            then coalesce(sum(amount) filter (where status = 'completed'), 0) end)
      from private.jobs
     where v_staff.role = 'admin' or assigned_to = v_staff.id);
end $$;

-- ----------------------------------------------------------------------------
-- App: actions (each returns the updated job)
-- ----------------------------------------------------------------------------

/** A job taken over the phone. Admin only. */
create function public.create_job(p_job jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_staff private.staff := private.require_admin();
begin
  return private.job_json(private.insert_job(p_job, 'manual', v_staff.name), v_staff);
end $$;

/** Fix customer or machine details. Admin only. */
create function public.update_job_details(p_id uuid, p_job jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_staff private.staff := private.require_admin();
  v_job   private.jobs := private.load_job(p_id, v_staff);
begin
  if private.clean(p_job ->> 'customer_name') is null
     or coalesce(private.clean(p_job ->> 'phone'), '') !~ '^\+?[0-9 -]{8,16}$'
     or private.clean(p_job ->> 'location') is null
     or private.clean(p_job ->> 'machine_type') is null then
    raise exception 'Name, a valid phone, location and machine type are required.';
  end if;

  update private.jobs set
    customer_name = private.clean(p_job ->> 'customer_name'),
    company = private.clean(p_job ->> 'company'),
    phone = private.clean(p_job ->> 'phone'),
    email = lower(private.clean(p_job ->> 'email')),
    location = private.clean(p_job ->> 'location'),
    machine_type = private.clean(p_job ->> 'machine_type'),
    quantity = coalesce(nullif(p_job ->> 'quantity', '')::integer, 1),
    rpm = nullif(p_job ->> 'rpm', '')::integer,
    power = private.clean(p_job ->> 'power'),
    rotor_weight = private.clean(p_job ->> 'rotor_weight'),
    rotor_diameter = private.clean(p_job ->> 'rotor_diameter'),
    mounting = private.clean(p_job ->> 'mounting'),
    brand_model = private.clean(p_job ->> 'brand_model'),
    vibration_reading = private.clean(p_job ->> 'vibration_reading'),
    service = private.clean(p_job ->> 'service'),
    notes = private.clean(p_job ->> 'notes'),
    urgency = private.clean(p_job ->> 'urgency'),
    updated_at = now()
  where id = v_job.id
  returning * into v_job;

  perform private.log_event(v_job.id, 'updated', 'Details edited', v_staff.name);
  return private.job_json(v_job, v_staff);
end $$;

/** Fix the visit date/time and who goes. Also reschedules. Admin only. */
create function public.schedule_job(p_id uuid, p_scheduled_at timestamptz, p_assigned_to uuid, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_staff    private.staff := private.require_admin();
  v_job      private.jobs := private.load_job(p_id, v_staff);
  v_assignee private.staff;
  v_event    text;
begin
  if v_job.status not in ('new', 'scheduled') then perform private.wrong_status(v_job, 'schedule'); end if;
  if p_scheduled_at is null then raise exception 'Please choose the visit date and time.'; end if;

  select * into v_assignee from private.staff where id = p_assigned_to and active;
  if not found then raise exception 'Please choose who will do this job.'; end if;

  v_event := case when v_job.status = 'scheduled' then 'rescheduled' else 'scheduled' end;
  update private.jobs
     set status = 'scheduled', scheduled_at = p_scheduled_at, assigned_to = v_assignee.id, updated_at = now()
   where id = v_job.id
  returning * into v_job;

  perform private.log_event(v_job.id, v_event,
    to_char(p_scheduled_at at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM') || ' · ' || v_assignee.name
      || coalesce(' — ' || private.clean(p_note), ''),
    v_staff.name);

  if v_assignee.id <> v_staff.id then
    perform private.send_push(array[v_assignee.id],
      case v_event when 'scheduled' then 'New job assigned to you' else 'Job rescheduled' end,
      v_job.reference || ' · ' || v_job.machine_type || ' · '
        || to_char(p_scheduled_at at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM'),
      v_job.id);
  end if;
  return private.job_json(v_job, v_staff);
end $$;

/** Reached the site and started work. */
create function public.start_job(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_staff private.staff := private.current_staff();
  v_job   private.jobs := private.load_job(p_id, v_staff);
begin
  if v_job.status <> 'scheduled' then perform private.wrong_status(v_job, 'start'); end if;
  update private.jobs set status = 'in_progress', started_at = now(), updated_at = now()
   where id = v_job.id returning * into v_job;
  perform private.log_event(v_job.id, 'started', 'Work started on site', v_staff.name);
  return private.job_json(v_job, v_staff);
end $$;

/** Work done: readings and summary. Only admins can set the amount. */
create function public.complete_job(p_id uuid, p_result jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_staff  private.staff := private.current_staff();
  v_job    private.jobs := private.load_job(p_id, v_staff);
  v_amount numeric := nullif(p_result ->> 'amount', '')::numeric;
begin
  if v_job.status not in ('scheduled', 'in_progress') then perform private.wrong_status(v_job, 'complete'); end if;
  if private.clean(p_result ->> 'vibration_after') is null then
    raise exception 'Please enter the vibration reading after balancing.';
  end if;

  update private.jobs set
    status = 'completed',
    started_at = coalesce(started_at, now()),
    completed_at = now(),
    vibration_before = private.clean(p_result ->> 'vibration_before'),
    vibration_after = private.clean(p_result ->> 'vibration_after'),
    balance_grade = private.clean(p_result ->> 'balance_grade'),
    correction_details = private.clean(p_result ->> 'correction_details'),
    work_summary = private.clean(p_result ->> 'work_summary'),
    amount = case when v_staff.role = 'admin' then coalesce(v_amount, amount) else amount end,
    updated_at = now()
  where id = v_job.id
  returning * into v_job;

  perform private.log_event(v_job.id, 'completed',
    coalesce('Before ' || v_job.vibration_before || ' → ', 'After ') || v_job.vibration_after,
    v_staff.name);

  if v_staff.role <> 'admin' then
    perform private.send_push(
      (select array_agg(id) from private.staff where role = 'admin' and active),
      'Job completed', v_job.reference || ' · ' || v_job.customer_name || ' · by ' || v_staff.name, v_job.id);
  end if;
  return private.job_json(v_job, v_staff);
end $$;

/** Payment received. Admin only. */
create function public.mark_job_paid(p_id uuid, p_amount numeric, p_payment_mode text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_staff private.staff := private.require_admin();
  v_job   private.jobs := private.load_job(p_id, v_staff);
begin
  if v_job.status <> 'completed' then perform private.wrong_status(v_job, 'mark paid'); end if;
  if p_amount is null or p_amount < 0 then raise exception 'Please enter the amount received.'; end if;

  update private.jobs
     set status = 'paid', amount = p_amount, payment_mode = private.clean(p_payment_mode),
         paid_at = now(), updated_at = now()
   where id = v_job.id returning * into v_job;
  perform private.log_event(v_job.id, 'paid',
    '₹' || to_char(p_amount, 'FM99,99,99,990.00') || coalesce(' · ' || v_job.payment_mode, ''), v_staff.name);
  return private.job_json(v_job, v_staff);
end $$;

/** Customer cancelled or job not possible. Admin only. */
create function public.cancel_job(p_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_staff private.staff := private.require_admin();
  v_job   private.jobs := private.load_job(p_id, v_staff);
begin
  if v_job.status not in ('new', 'scheduled', 'in_progress') then perform private.wrong_status(v_job, 'cancel'); end if;
  if private.clean(p_reason) is null then raise exception 'Please give a reason.'; end if;

  update private.jobs set status = 'cancelled', cancelled_reason = private.clean(p_reason), updated_at = now()
   where id = v_job.id returning * into v_job;
  perform private.log_event(v_job.id, 'cancelled', p_reason, v_staff.name);
  return private.job_json(v_job, v_staff);
end $$;

/** Bring a cancelled job back as a new request. Admin only. */
create function public.reopen_job(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_staff private.staff := private.require_admin();
  v_job   private.jobs := private.load_job(p_id, v_staff);
begin
  if v_job.status <> 'cancelled' then perform private.wrong_status(v_job, 'reopen'); end if;
  update private.jobs
     set status = 'new', cancelled_reason = null, scheduled_at = null, started_at = null, updated_at = now()
   where id = v_job.id returning * into v_job;
  perform private.log_event(v_job.id, 'reopened', null, v_staff.name);
  return private.job_json(v_job, v_staff);
end $$;

/** A note on the job's timeline, e.g. "Customer asked to come after 2 PM". */
create function public.add_job_note(p_id uuid, p_note text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_staff private.staff := private.current_staff();
  v_job   private.jobs := private.load_job(p_id, v_staff);
begin
  if private.clean(p_note) is null then raise exception 'Please write a note.'; end if;
  perform private.log_event(v_job.id, 'note', p_note, v_staff.name);
  return public.get_job(p_id);
end $$;

-- ----------------------------------------------------------------------------
-- App: team
-- ----------------------------------------------------------------------------

create function public.list_staff()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_staff private.staff := private.current_staff();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'email', s.email, 'phone', s.phone,
                                        'role', s.role, 'active', s.active, 'signed_up', s.user_id is not null)
                     order by s.active desc, s.role, s.name)
      from private.staff s
     where v_staff.role = 'admin' or s.active), '[]'::jsonb);
end $$;

/** Adds a helper (or another admin). They then sign up in the app with this email. */
create function public.add_staff(p_email text, p_name text, p_phone text default null, p_role text default 'technician')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin private.staff := private.require_admin();
  v_email text := lower(private.clean(p_email));
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email.'; end if;
  if private.clean(p_name) is null then raise exception 'Please enter the name.'; end if;
  if p_role not in ('admin', 'technician') then raise exception 'Unknown role.'; end if;

  insert into private.staff (email, name, phone, role)
  values (v_email, private.clean(p_name), private.clean(p_phone), p_role)
  on conflict (email) do update
    set name = excluded.name, phone = excluded.phone, role = excluded.role, active = true;
  return public.list_staff();
end $$;

create function public.set_staff_active(p_id uuid, p_active boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_admin private.staff := private.require_admin();
begin
  if p_id = v_admin.id and not p_active then raise exception 'You cannot remove your own access.'; end if;
  update private.staff set active = p_active where id = p_id;
  if not found then raise exception 'Team member not found.'; end if;
  if not p_active then
    delete from private.push_tokens where staff_id = p_id;
  end if;
  return public.list_staff();
end $$;

create function public.register_push_token(p_token text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_staff private.staff := private.current_staff();
begin
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'Invalid push token.';
  end if;
  insert into private.push_tokens (token, staff_id) values (p_token, v_staff.id)
  on conflict (token) do update set staff_id = excluded.staff_id, updated_at = now();
end $$;

create function public.unregister_push_token(p_token text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_staff private.staff := private.current_staff();
begin
  delete from private.push_tokens where token = p_token and staff_id = v_staff.id;
end $$;

-- ----------------------------------------------------------------------------
-- Who may call what
-- ----------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, n.nspname as schema, p.proname as name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and p.proname in (
         'clean', 'current_staff', 'require_admin', 'load_job', 'log_event', 'wrong_status',
         'send_push', 'assert_submission_allowed', 'job_json', 'insert_job',
         'submit_job_request', 'health_check', 'get_my_profile', 'list_jobs', 'get_job',
         'job_counts', 'create_job', 'update_job_details', 'schedule_job', 'start_job',
         'complete_job', 'mark_job_paid', 'cancel_job', 'reopen_job', 'add_job_note',
         'list_staff', 'add_staff', 'set_staff_active', 'register_push_token', 'unregister_push_token')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    if f.schema = 'public' then
      if f.name in ('submit_job_request', 'health_check') then
        execute format('grant execute on function %s to anon, authenticated', f.sig);
      else
        execute format('grant execute on function %s to authenticated', f.sig);
      end if;
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- First admin: Gopi. He signs up in the app with this email.
-- ----------------------------------------------------------------------------
insert into private.staff (email, name, role)
values ('gtgvibralgopi@gmail.com', 'Gopi', 'admin')
on conflict (email) do nothing;

commit;
