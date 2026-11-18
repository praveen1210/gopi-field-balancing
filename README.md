# GTG Vibral

On-site field balancing and vibration services for Gopi's business:

- **Website** (`website/`): services, standards, FAQ and a booking form. Hosted
  on Netlify from Gopi's account: run `npm run website:release`, then drag the
  `website-release` folder (or `gtg-vibral-website.zip`) onto
  https://app.netlify.com/drop. After a change, run it again and drag it onto
  the site's **Deploys** page.
- **Mobile app** (Expo, `app/` + `src/`): every website request arrives here.
  Schedule visits on a calendar, assign helpers, track each job and keep its
  history.
- **Database** (Supabase, `supabase/`): stores jobs, the team and each job's timeline.

## How a job flows

```
Website form ──► New request ──► Scheduled ──► On site ──► Completed ──► Paid
 (or "Add job"     (admin picks     (technician    (readings,    (admin records
  in the app)       date + person)   taps Start)    grade)        amount)
                 New / Scheduled / On site ──► Cancelled ──► Reopen ──► New
```

- **Admin** (Gopi) sees everything. The admin schedules jobs, assigns them to
  people, edits details, cancels jobs, records payments and manages the team.
- **Technicians** (helpers) see only the jobs assigned to them. They can start
  and complete those jobs. They never see amounts.
- Every change is written to the job's **timeline** with who made it and when.
- **Notifications:**
  - Admins get a notification for each new website request.
  - A technician gets one when a job is assigned to them or rescheduled.
  - Admins get one when a technician completes a job.

## Going live (one-time)

1. **Create the Supabase project** (free) in Gopi's Supabase account:
   - Name it `gtg-vibral`, region Mumbai (ap-south-1).
   - Save the database password somewhere safe.
2. **Create the database.** In the Supabase dashboard, open SQL Editor and paste
   and run `supabase/migrations/20261117120000_jobs.sql`. This also makes
   `gtgvibralgopi@gmail.com` the first admin.
   - Or, with the CLI: `npx supabase login`, then `npx supabase link --project-ref <ref>`,
     then `npx supabase db push`.
   - Never run `supabase/seed.sql` or the tests against the live project.
     They are for the local test copy only.
3. **Enable the pg_net extension** under Database → Extensions. Notifications
   use it; the migration tries to enable it as well.
4. **Copy the project URL and publishable (anon) key** from Project Settings → API.
   - Put them in `website/config.js` under `window.BACKEND`.
   - Put them in `.env` for the app (see `.env.example`).
   - These two values are public by design. Never put the service-role key or
     the database password in any file here.
5. **Set the website's URL for sign-ups.** Under Authentication → URL
   Configuration, set the Site URL to the Netlify website address. Leave email confirmation on.
6. **Build the Android app:**
   - `npx eas-cli@latest init` links the project and adds the `projectId`
     that push notifications need.
   - Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS
     environment variables (`preview` environment).
   - `npm run build:apk` builds the app. Install the APK on Gopi's phone.
   - Android push notifications also need Firebase's `google-services.json` in
     the project root. It is free, git-ignored, and picked up by `app.config.js`.
7. **Gopi signs up.** In the app he taps *First time? Create your login* and
   uses `gtgvibralgopi@gmail.com`. To add helpers, open the Team tab → *Add a
   helper*. The helper then creates their login with that same email.
8. **Keep the free project awake.** Add repository secrets `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` so `.github/workflows/keepalive.yml` can ping the
   project twice a week.

## Day-to-day development

No Docker needed: put Gopi's project URL and key in `.env` and everything runs
against the real (free) Supabase project.

```bash
npm install
npm run website       # website on http://localhost:8120
npm start             # the app on a phone with Expo Go (or `npm run web` in a browser)
npm run check         # lint + typecheck + unit tests
```

### Optional: offline test database (Docker)

Use this only to try database changes without touching real jobs. It needs
Docker Desktop. `npm run db:start` starts a throwaway copy on ports 553xx and
`npm run db:test` runs the database tests. The test logins are listed in
`supabase/seed.sql`. Point `.env` at `http://127.0.0.1:55321` while using it.
