# QuizLive (Supabase Kahoot-like App)

A modern, real-time quiz platform built with React 18 + Vite + TypeScript + Tailwind + shadcn/ui and Supabase.

## Features
- Public join by code + QR (no account required)
- Authenticated creators for quiz management + hosting
- Real-time session updates (lobby, question, results, end)
- Live leaderboard updates
- Mobile-first, accessible UI with dark mode

## Tech Stack
- React 18 + Vite + TypeScript
- TailwindCSS + shadcn/ui + lucide-react
- Supabase Auth, Postgres, RLS, Realtime
- react-router, react-hook-form + zod
- TanStack Query

## Local Setup

### 1) Install dependencies
```bash
pnpm install
```

### 2) Create Supabase project
- Create a new project at Supabase.
- Open **SQL Editor** and run the contents of `supabase.sql`.
- Enable **Realtime** on tables: `sessions`, `participants`, `answers`.
- Auth: enable email/password provider.

### 3) Configure environment
Create `.env` in `apps/web`:
```
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### 4) Run dev server
```bash
pnpm dev
```

App runs at `http://localhost:5173` by default.

## Notes on RLS
See `apps/web/src/lib/rlsNotes.md` for the high-level design.

## Folder Structure
```
apps/web
  src
    components
    hooks
    lib
    pages
    types
```

## Final Checklist
- Creator can register/login
- Creator can create quiz + questions
- Creator can start host session with join code + QR
- Player can join without account and answer questions
- Host sees results and leaderboard update live
- Responsive UI works on mobile and desktop
# quizy
