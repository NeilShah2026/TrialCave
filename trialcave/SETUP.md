# TrialCave — Setup Guide (start here)

This guide gets TrialCave running on your own laptop from scratch. It assumes you
know **nothing**. Follow it top to bottom. Copy-paste the commands exactly.

If a step fails, read the **"If it breaks"** box under that step before moving on.

---

## 0. What you're setting up

TrialCave is a website that runs on your computer. It needs three things:

1. **Node.js** — the engine that runs the website code.
2. **A database (Supabase)** — where all the data lives. You'll run it locally with
   Docker, so you don't need a cloud account.
3. **(Optional) An Anthropic API key** — only needed for AI features (reading
   uploaded documents, translating). The demo works **without** it.

Total time: about 20–30 minutes the first time.

---

## 1. Install the tools you need

You'll install four programs. Pick your operating system below.

### 1a. Node.js (version 20 or newer)

Node runs the app.

- **Mac:** Easiest way is Homebrew. Open the **Terminal** app and paste:
  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  brew install node
  ```
- **Windows:** Download the "LTS" installer from <https://nodejs.org> and click
  through it (keep clicking Next). Then open **PowerShell**.
- **Linux:** Use your package manager, e.g. `sudo apt install nodejs npm`, or get
  it from <https://nodejs.org>.

**Check it worked.** In your terminal, run:
```bash
node --version
```
You should see something like `v20.x.x` or higher.

> **If it breaks:** If `node` isn't found after installing, close the terminal
> completely and open a new one. Installers often need a fresh terminal.

### 1b. Git (to download the code, if you don't have it yet)

- **Mac:** `brew install git`
- **Windows:** <https://git-scm.com/download/win>
- **Linux:** `sudo apt install git`

Check: `git --version`

### 1c. Docker Desktop (runs the local database)

The database runs inside Docker so you don't have to install Postgres by hand.

1. Download Docker Desktop: <https://www.docker.com/products/docker-desktop/>
2. Install it (click through the installer).
3. **Open the Docker Desktop app and leave it running.** You'll see a little whale
   icon. Wait until it says "Docker Desktop is running" / the whale stops animating.

Check: in your terminal run `docker --version`. You should see a version number.

> **If it breaks:** Docker MUST be open and running before you start the database
> in step 4. If the whale icon is red or spinning forever, restart Docker Desktop.
> On Windows, Docker may ask you to enable "WSL2" — accept and reboot if prompted.

### 1d. The Supabase CLI (controls the local database)

This is a small command-line tool.

- **Mac:** `brew install supabase/tap/supabase`
- **Windows (with Scoop):**
  ```powershell
  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
  scoop install supabase
  ```
  (No Scoop? Install it first from <https://scoop.sh>, or download the Supabase CLI
  release directly from <https://github.com/supabase/cli/releases>.)
- **Linux:** download the release from <https://github.com/supabase/cli/releases>.

Check: `supabase --version`

> **If it breaks:** If `supabase` isn't found, you may need to add it to your PATH,
> or just use the direct binary download from the releases page above.

---

## 2. Get the code and install its parts

In your terminal, go to wherever you keep projects and get the code. If you already
have this folder, skip the `git clone` line.

```bash
# Download the project (skip if you already have the folder)
git clone <YOUR-REPO-URL> Hackachusetts

# Go into the app folder
cd Hackachusetts/trialcave

# Download all the code libraries the app depends on (takes a few minutes)
npm install
```

> **If it breaks:** If `npm install` shows errors, make sure `node --version` is 20
> or higher (step 1a). Delete the `node_modules` folder and the
> `package-lock.json` file, then run `npm install` again.

---

## 3. Create your settings file (`.env.local`)

The app reads its settings from a file named `.env.local`. There's a template
called `.env.example`. Copy it:

- **Mac/Linux:** `cp .env.example .env.local`
- **Windows (PowerShell):** `Copy-Item .env.example .env.local`

You'll fill in the blank values in the next steps. The file is ignored by Git, so
your secrets never get committed.

---

## 4. Start the local database

Make sure **Docker Desktop is open and running** (step 1c). Then, inside the
`trialcave` folder:

```bash
supabase start
```

The first time, this downloads some images and takes a few minutes. When it
finishes, it prints a block of values that looks like this:

```
API URL: http://127.0.0.1:54321
anon key: eyJhbGciOi.....(a long string)
service_role key: eyJhbGciOi.....(a different long string)
```

**Keep this terminal output visible — you need three of those values.**

> **If it breaks:**
> - "Cannot connect to the Docker daemon" → Docker Desktop isn't running. Open it,
>   wait for it to be ready, try again.
> - Port already in use → run `supabase stop` then `supabase start` again.

### Copy the three values into `.env.local`

Open `.env.local` in any text editor and set these three lines using the values
`supabase start` printed:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste the "anon key" here>
SUPABASE_SERVICE_ROLE_KEY=<paste the "service_role key" here>
```

Save the file.

> **Lost the values?** Run `supabase status` to print them again.

---

## 5. Create the database tables

The app needs its tables and security rules. These live in
`supabase/migrations/`. Apply them to your local database:

```bash
supabase db reset
```

This wipes the local database and re-applies every migration cleanly. It's safe —
there's no real data in it. You can run it any time to get a fresh, empty database.

> **If it breaks:** If it complains it can't find the database, make sure
> `supabase start` (step 4) finished successfully first.

---

## 6. (Optional) Add an Anthropic API key for AI features

The demo runs **without** this. Only do this if you want the AI features (reading
real uploaded documents, translations) to work live.

1. Make an account at <https://console.anthropic.com>.
2. Create an API key.
3. Put it in `.env.local`:
   ```bash
   ANTHROPIC_API_KEY=<your key>
   ```

Leave it blank to skip. The demo uses pre-built sample data instead of calling AI.

---

## 7. Load the demo data

This fills the database with the demo trials, patients, and clinics so you have
something to look at. Run:

```bash
# Load clinical trials from ClinicalTrials.gov (any condition, Massachusetts)
npm run db:sync-trials

# Turn each trial's eligibility text into a checklist (needs the AI key from step 6;
# safe to skip if you don't have one — demo studies use hand-written criteria)
npm run db:parse-trials

# Create the demo patients, clinics, and logins
npm run db:seed

# Pre-compute who matches which trial
npm run db:match
```

Or run all of them at once:
```bash
npm run setup:demo
```

> **If it breaks:** Each of these needs the three Supabase values from step 4 to be
> filled in. If `db:parse-trials` fails because there's no AI key, that's fine —
> skip it; the demo logins and demo studies still work.

---

## 8. Start the app

```bash
npm run dev
```

Open your browser to **<http://localhost:3000>**.

You should see the TrialCave landing page. Go to **Log in** and use the **Demo
accounts** card to sign in with one click (for example, "Maria Gonzalez"). All demo
passwords are the value of `DEMO_PASSWORD` in `.env.local`
(default: `TrialCave2026!`).

To stop the app, press **Ctrl + C** in the terminal. To stop the database, run
`supabase stop`.

---

## 9. The 2-minute demo walkthrough

Once logged in as **Maria**:

1. Dashboard shows her matches and Data Donor paycheck.
2. Go to **Records → upload** a sample visit summary (there's a download button in
   demo mode), confirm the extracted facts.
3. Her matches update — a trial flips to a strong match.
4. Open a matched trial, answer a question, switch the language to Español.
5. Log in as the **clinic** and **researcher** demo accounts to see the other sides.

(The full script lives in the master plan, section B18.)

---

## Everyday commands (after first setup)

| I want to… | Run this (inside the `trialcave` folder) |
|---|---|
| Start the database | `supabase start` (needs Docker running) |
| Stop the database | `supabase stop` |
| See the Supabase URL and keys again | `supabase status` |
| Wipe + rebuild the database tables | `supabase db reset` |
| Reload demo data | `npm run setup:demo` |
| Start the website | `npm run dev` |
| Stop the website | Ctrl + C in its terminal |
| Check the code compiles | `npm run typecheck` |
| Run the tests | `npm run test` |
| Build for production | `npm run build` |

---

## Running against the Supabase cloud instead of locally (optional)

If you'd rather use a free hosted database instead of Docker:

1. Make a free project at <https://supabase.com>.
2. In the dashboard: **Project Settings → API**. Copy the **Project URL**, the
   **anon public** key, and the **service_role** key into `.env.local` (same three
   lines as step 4).
3. Link and push the schema:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
4. In the dashboard: **Authentication → Providers → Email**, turn **off** "Confirm
   email" so demo logins work. Set the **Site URL** to `http://localhost:3000`.
5. Run the demo data commands (step 7) and start the app (step 8).

---

## Common problems, quick fixes

| Symptom | Fix |
|---|---|
| "Supabase isn't configured" on the login page | You didn't fill in the three Supabase values in `.env.local` (step 4). Fill them in and restart `npm run dev`. |
| Demo login buttons say the account isn't available | You haven't seeded the demo yet. Run `npm run db:seed` (step 7). |
| "Cannot connect to the Docker daemon" | Docker Desktop isn't open/running. Open it, wait, retry `supabase start`. |
| Page is blank / won't load | Is `npm run dev` still running in a terminal? It must stay running. Check the terminal for errors. |
| Changed `.env.local` but nothing changed | Stop (`Ctrl + C`) and restart `npm run dev`. Settings load at startup. |
| AI features error out | You need an `ANTHROPIC_API_KEY` (step 6). The core demo still works without it. |

---

## What's NOT in this build (on purpose)

- **Inbound email ingestion is deprecated.** You add records by **uploading** a
  file, not by forwarding email. Any mention of email forwarding is turned off.
- **Payments are simulated.** All Data Donor "paycheck" amounts are demo numbers.
- **All patient data is synthetic.** No real people.

---

## Notes for the curious

- The trial library covers **any condition** recruiting in Massachusetts, pulled
  live from ClinicalTrials.gov. The deep, exact eligibility checks (numeric lab
  ranges, etc.) are strongest for diabetes / kidney / cardiometabolic trials; other
  conditions still load and match using AI-estimated and yes/no question checks,
  with the study team making the final call.
- Source data: trials from ClinicalTrials.gov; community equity figures (when
  shown) from MassGIS and the CDC/ATSDR Social Vulnerability Index.
