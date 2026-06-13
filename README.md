# Quizout — Setup Guide

## What you need before starting
- A computer with internet access
- Node.js installed (download from https://nodejs.org — get the "LTS" version)
- A free Supabase account (https://supabase.com)
- A free Vercel account for deployment (https://vercel.com) — optional for local testing

---

## Step 1 — Set up Supabase

1. Go to https://supabase.com and sign up / log in
2. Click **New project**, give it a name like `quizout`, pick a region near you, set a database password (save it somewhere)
3. Wait ~2 minutes for the project to be created
4. In the left sidebar, click **SQL Editor**
5. Click **New query**
6. Open the file `supabase-schema.sql` from this project, copy everything, paste it into the editor, and click **Run**
   - This creates all 4 tables and seeds 40 questions
7. In the left sidebar, click **Project Settings** → **API**
8. Copy two values — you'll need them in Step 3:
   - **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
   - **anon / public key** (a long string starting with `eyJ...`)

---

## Step 2 — Get the code running locally

Open a **terminal** (on Mac: search "Terminal"; on Windows: search "Command Prompt" or use Windows Terminal).

```bash
# Navigate to the quizout folder
cd path/to/quizout

# Install dependencies (takes 1-2 minutes)
npm install
```

---

## Step 3 — Add your Supabase credentials

1. In the `quizout` folder, find the file called `.env.example`
2. Make a copy of it and name the copy `.env.local`
3. Open `.env.local` in any text editor (Notepad works)
4. Replace the two placeholder values with your real values from Step 1:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-real-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-real-key...
```

Save the file.

---

## Step 4 — Run it locally

In your terminal:

```bash
npm run dev
```

Open your browser and go to **http://localhost:3000**

You should see the Quizout home screen. Open a second browser tab and join with a different name to test multiplayer.

---

## Step 5 — Deploy to Vercel (share with friends)

1. Go to https://vercel.com and sign up with GitHub
2. Push your code to a GitHub repo (or just drag the folder into Vercel's dashboard)
3. During setup, Vercel will ask for **Environment Variables** — add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click **Deploy** — Vercel gives you a public URL like `https://quizout-abc.vercel.app`
5. Share that URL with friends. They can join from their phones.

---

## How to add more questions

1. Go to your Supabase dashboard → **Table Editor** → **questions**
2. Click **Insert row**
3. Fill in:
   - `category`: one of `premier_league`, `world_cup`, `champions_league`, `legends`, `mixed`
   - `question`: the question text
   - `options`: must be valid JSON, e.g. `["Option A","Option B","Option C","Option D"]`
   - `correct_index`: 0, 1, 2, or 3 (which option is correct)

---

## Future features already designed for
- **Timer per question**: add a `timer_seconds` column to rooms and a countdown in the questions phase
- **Head-to-head counter**: add a `h2h` table tracking wins between pairs of players

---

## Folder structure at a glance

```
quizout/
├── src/
│   ├── app/
│   │   ├── page.tsx              ← Home / join screen
│   │   ├── room/[code]/
│   │   │   ├── page.tsx          ← Lobby (waiting room)
│   │   │   └── play/page.tsx     ← Game, reveal, results
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── lib/
│   │   ├── supabase.ts           ← Database client
│   │   └── utils.ts              ← Helpers
│   └── types/
│       └── index.ts              ← All TypeScript types
├── supabase-schema.sql           ← Run this in Supabase
├── .env.example                  ← Copy to .env.local
└── package.json
```
