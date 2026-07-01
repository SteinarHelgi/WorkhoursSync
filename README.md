# Work shifts importer

Admin uploads the monthly shift-schedule `.xlsx` export. Workers sign in with
Google and click a button to push their upcoming shifts (and leave/absence
entries) into a dedicated "Work Shifts" calendar in their own Google account.
Re-syncing after a schedule change updates/removes events instead of
duplicating them.

## One-time setup

### 1. Database (Neon, free tier)

1. Create a project at neon.tech.
2. Copy the pooled connection string into `DATABASE_URL` in `.env`.
3. Run migrations:
   ```
   npx prisma migrate dev --name init
   ```

### 2. Google OAuth client

1. In the Google Cloud Console, create a project and enable the **Google
   Calendar API**.
2. Configure the OAuth consent screen:
   - Keep publishing status as **Testing** (this avoids Google's app
     verification process entirely).
   - Add every worker's Google account email under **Test users** (limit of
     100 - fine for one workplace). Anyone not added here will get an
     "access blocked" screen when they try to sign in.
3. Create an **OAuth client ID** (Web application) with authorized redirect
   URI:
   - `http://localhost:3000/api/auth/callback/google` for local dev
   - `https://<your-domain>/api/auth/callback/google` for production
4. Put the client ID/secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
5. Generate `AUTH_SECRET` with `npx auth secret`.
6. Set `ADMIN_EMAILS` to a comma-separated list of Google emails allowed to
   upload schedules at `/admin`.

See `.env.example` for the full list.

### 3. Run locally

```
npm install
npm run dev
```

- Admin uploads the schedule at `/admin`.
- Workers sign in at `/`, pick their name from the roster on first login,
  then click "Add shifts to Google Calendar".

### 4. Deploy (Vercel, free tier)

1. Import the repo into Vercel.
2. Set the same environment variables as `.env.example` in the Vercel
   project settings.
3. Add the production callback URL to the Google OAuth client's authorized
   redirect URIs (see step 2 above).

## Notes

- Each month, re-uploading the schedule at `/admin` replaces that period's
  shifts - workers just click sync again to pick up changes.
- "FJARVERA" entries in the source file are absences/leave and are pushed as
  separate, visually distinct calendar events rather than being skipped.
- The employee roster only has names + employee numbers (no email), so a
  worker's Google account is linked to their roster row via a one-time
  "pick your name" step after first sign-in.
