# RugbyNow

RugbyNow is a rugby-focused web app built to display fixtures, results, live matches, and standings with a fast, readable UI. The project combines a Next.js frontend, Supabase as the main data source, and Flashscore-based scraping scripts for automated updates.

The app is designed to keep working even when the main data source is unavailable. For that reason, it includes a local fallback layer that can serve competitions, league pages, fixtures, results, and standings from generated dumps and seed data.

## What It Does

- Shows rugby matches by date on the home page
- Groups competitions by region and highlights featured leagues
- Provides league-specific pages with rounds, fixtures, and standings
- Supports multiple UI languages: `en`, `es`, `fr`, `it`
- Supports multiple time zones
- Uses local fallback data when Supabase cannot be reached
- Includes syncing and rebuild scripts for Flashscore-driven data refreshes

## Tech Stack

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Supabase`
- `Playwright`
- `Tailwind CSS 4`

## Project Structure

```text
app/
  api/                    API routes for competitions, home, and league views
  components/             Shared UI pieces
  leagues/                Leagues index and league detail pages
  about/                  About page
  weekly/                 Weekly content
lib/
  assets.ts               Team and league logo resolution
  competitionMeta.ts      Group / country emoji helpers
  fallbackData.ts         Local fallback competitions, matches, standings
  i18n.ts                 UI translation strings
  serverSupabase.ts       Server-side Supabase client
  usePrefs.ts             Persisted language / theme / timezone preferences
public/
  team-logos/             Team badges
  league-logos/           League logos
scripts/
  sync-flashscore.ts      Main Flashscore sync
  rebuild-flashscore.ts   Reset + rebuild flashscore-backed data
  sync-standings.ts       Standings sync helper
  audit-fallback.ts       Audits fallback coverage and missing logos
```

## Local Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build:

```bash
npm run build
npm run start
```

Lint:

```bash
npm run lint
```

## Environment Variables

Create a `.env.local` file in the project root.

Minimum variables:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
FLASH_URLS=fr-top14=https://www.flashscore.com/rugby-union/france/top-14/results/
```

Optional:

```env
LIVE_ONLY=1
DRY_RUN=1
```

Notes:

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required for real database syncs
- `FLASH_URLS` accepts one or many league URLs
- `DRY_RUN=1` skips database writes and writes local dumps instead
- `LIVE_ONLY=1` limits scraping to live-oriented fixtures mode

## Available Scripts

### App

```bash
npm run dev
npm run build
npm run start
npm run lint
```

### Data Sync

```bash
npm run sync:flashscore
npm run sync:live
npm run sync:standings
npm run rebuild:flashscore
npm run audit:fallback
```

### Script Purpose

- `sync:flashscore`: Scrapes fixtures, results, and standings, then updates Supabase
- `sync:live`: Faster live-oriented sync path
- `sync:standings`: Standings refresh helper
- `rebuild:flashscore`: Clears Flashscore-owned `matches` and `standings_cache`, then re-syncs
- `audit:fallback`: Audits what fallback can currently serve and reports missing logos

## Rebuild Workflow

Use this only when you intentionally want to rebuild Flashscore-managed data.

```bash
CONFIRM_RESET=YES npm run rebuild:flashscore
```

On Windows PowerShell:

```powershell
$env:CONFIRM_RESET="YES"
npm run rebuild:flashscore
```

This removes only records sourced from Flashscore inside:

- `matches`
- `standings_cache`

Then it runs a fresh sync.

## Fallback Mode

RugbyNow includes a fallback layer for cases where:

- Supabase is blocked by the network
- league queries fail
- only partial local dumps are available

The fallback system currently powers:

- `/api/competitions`
- `/api/home`
- `/api/leagues`
- `/api/leagues/[slug]`

Fallback data is assembled from:

- local generated dumps
- seed data for leagues that have incomplete upstream coverage
- merged fixture/result windows selected around the requested date

This is important for development because the UI can still be tested even when the database is unreachable.

## Logos

Logos are resolved through:

- `public/team-logos`
- `public/league-logos`
- alias mapping in [`lib/assets.ts`](./lib/assets.ts)

If a logo exists but under a different name, add an alias instead of duplicating the file.

Audit missing logos with:

```bash
npm run audit:fallback
```

## Translation System

UI strings are centralized in:

- [`lib/i18n.ts`](./lib/i18n.ts)

Supported languages:

- English
- Spanish
- French
- Italian

Preferences are persisted through:

- [`lib/usePrefs.ts`](./lib/usePrefs.ts)

This includes:

- language
- timezone
- theme
- sidebar state

## Current Status

The project is in active refinement. The core app is working, and the main flows are in place:

- home page
- competitions page
- league pages
- multilingual UI
- fallback data routes

Known technical debt still worth improving:

- migrate remaining badge/logo `<img>` tags to `next/image`
- keep refining Flashscore matching for edge-case competitions
- continue improving season and round inference for leagues with incomplete upstream data
- complete any remaining logo gaps with real assets

## Troubleshooting

### `npm run build` fails with `ENOENT` for `package.json`

You are probably one directory too high. Run commands from:

```powershell
cd C:\Users\PC\rugbynow\RugbyNOW
```

### Supabase requests are blocked

If your network blocks `supabase.co`, the app can still work through fallback routes, but real syncs will fail. In that case:

- use the local app normally
- use `DRY_RUN=1` for scraping tests
- or switch to a network that allows Supabase

### Flashscore sync writes real data

`sync-flashscore.ts` updates the database for real unless `DRY_RUN=1` is enabled.

## Contact

- Email: `lopresttivito@gmail.com`
- LinkedIn: [Vito Loprestti](https://www.linkedin.com/in/vitoloprestti/)
