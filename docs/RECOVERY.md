# Data refresh recovery

## Portal expansion

See `docs/PROVIDERS-AND-PERSONALIZATION.md` for the shared interface, local preferences, RSS news, actual-date competition calendar, per-feed fault isolation, and the read-only API provider candidate. Structured score imports and cross-device accounts are not active. This section supersedes earlier UI descriptions that say the external directory was removed.


## Current state after monitored recovery

The complete production run [39343700539](https://github.com/Vitolop1/RugbyNow/actions/runs/39343700539) succeeded in all four feed groups and the separate snapshot job. The snapshot was pushed to main as `36cec92`: 1,792 matches, 48 seasons, 141 teams, 212 standings rows. Import success and Git publication were verified separately. The primary schedule was enabled after this check, then briefly gated again while deploying the identity correction below; the final activation is recorded in the delivery report.

The source resolver had also confused South African Lions with Argentina's Old Lions RC through substring matching. A bounded repair reassigned 40 source-linked matches in URC/European competitions and one standings row to Lions (ID 223), preserving match IDs, scores, dates and all regional Old Lions records. A backup of the affected rows was saved before applying; a second dry run found zero candidates. The complete post-repair snapshot contains 1,792 matches and 142 teams. The importer now requires an exact normalized name or explicit alias.

The new homepage and `/agenda` share the compact daily agenda. They render real initial content on the server and refresh through `/api/agenda`. Database times/results override matching editorial entries. Today is the default; match state is never inferred from elapsed kickoff, and the shared match-state helper now also preserves source-confirmed states on legacy detail pages.

The UI has aligned rows grouped by competition, real crests, a country-specific TV panel, day navigation, language/timezone controls, search, status/region filters, local favourites, ICS export and share links. Empty weekdays show upcoming fixtures and a link to recent results. Editorial programmes remain secondary. Generic competition-to-broadcaster assignments and unverified stream menus were removed; old screens link to the maintained TV agenda instead.

The reusable skill is installed at `~/.codex/skills/rugbynow-quality/SKILL.md`. Invoke `$rugbynow-quality` for a review or requested improvement. It is not a scheduler or continuous monitor. The original working checkout and its pre-existing changes remain untouched.

The remaining historical sections below describe the sequence of recovery and should not be read as claims that every old workflow or proposed feature is active.

The public GitHub API reported all six scheduled refresh workflows as `disabled_inactivity` on 2026-10-19. The last visible runs were from 2026-06-04. GitHub automatically disables public-repository schedules after 60 days without repository activity; a successful application deployment does not prove that data refresh is running.

## Changes in this repair

- Parse complete source dates before yearless labels. Reject impossible dates and ambiguous editions instead of assigning today's year to `Current`.
- Request source pages in UTC and English so parsed kickoff times and relative dates agree on one timezone on local and hosted runners.
- Read the source page's season, create a missing explicitly identified season, and process historical results and upcoming fixtures in separate groups. Existing stable source event IDs can move incorrectly dated records into the corrected edition on the next successful sync.
- Seed the men's World Cup as 2027. Records lacking stable source IDs may need a separate audited reconciliation; do not reset the database to repair these.
- Fail the job when a full match feed cannot be read or writes fail, instead of reporting success with no updates. Remove the global TLS-verification bypass from the main importer.
- Evaluate the homepage date per request and recover from failed or non-JSON requests with an error and retry.
- Update the document language after selection and offer time zones for additional rugby markets. Separate indexable language URLs remain a later change.
- Record `match_open`, `watch_options_open` and `watch_provider_click` through the owner's existing GA4 web stream, verified in Analytics. It does not confirm a stream was watched, a purchase occurred, or a review was submitted.

## Recovery verification

1. Run `npm test`, `npm run typecheck` and `npm run build:next`.
2. After the repair is on the default branch, re-enable and manually run the primary matches workflow with `dry_run: true` and selected competition URLs. Scheduled primary imports require repository variable `DATA_SYNC_ENABLED=true`; leave it unset until the validation and a monitored live import pass. Inspect the conclusion and per-competition logs. A warning or a successful job with no relevant fresh matches is not sufficient evidence of recovery.
3. Compare the public API and UI against official sources. The audit examples were Alumni–CASI (2026-10-17, final 14–22) and France–Samoa (World Cup, 2027-10-17, not 2026).
4. Re-enable the live and standings schedules once their logs are healthy. The live workflow already runs clock and finalization passes; backup jobs are separate and need not all run concurrently during recovery.
5. Verify the deployed homepage separately. Pushing application code to GitHub does not by itself confirm a Cloudflare deployment.

The repository uses Cloudflare Workers/OpenNext. Runtime credentials stay in Cloudflare and GitHub Secrets. Never commit or print them. Do not use the destructive rebuild workflow for this recovery.

The importer no longer deletes presumed midnight duplicates by default. The legacy cleanup requires explicit `CLEANUP_PLACEHOLDER_DUPLICATES=1`; review a backup and candidate records before opting in. Dry-run reports include parsed kickoff times and scores for official-source comparisons.

Snapshot exports paginate with a stable ordering. The live database held 1,160 matches during recovery, exceeding the default 1,000-row response limit; a single unpaginated query could silently truncate the fallback dataset. A failure on any page rejects the export before a new file is written.

## Prevent a repeat

Use monitoring outside these GitHub schedules for disabled workflows, missing refreshes and expected results remaining unresolved. A scheduled workflow inside the same inactive repository cannot reliably warn about its own inactivity suspension. Configure the external monitor before treating data freshness as continuously supervised. No external monitor or new paid service is provisioned by this repair.

The existing generic transmission links still need territorial verification. The analytics events only measure use of the existing interface; they do not establish broadcast availability or licensing.

## Interactive agenda

`/agenda` adds search, date/type/region filters, locally saved events, calendar downloads and share links that resolve the event in the recipient's timezone. Its interface supports English, Spanish, French and Italian. The homepage and desktop navigation link to it.

The first editorial selection contains 52 entries (24 matches and 28 programmes), explicitly dated 15–22 October 2026 and attributed to the user-provided Norte Rugby guide. Argentina timestamps are stored as UTC instants. This selection is not a recurring feed, international broadcast-rights database or live score service. Do not move these entries into another week. Future coverage needs a maintained source and verification process.

Provider names without confirmed URLs remain marked pending. Known channel and platform destinations are labeled separately from event-specific streams. Calendar and favourite actions send optional GA4 events after the visitor allows analytics; no analytics account or review backend is created.

## Analytics recovery

The owner confirmed an existing Analytics/Search Console setup. The web stream for `https://rugby-now.com` was verified in their signed-in Analytics session: `G-FXNKQ0MK41`. The inspected public homepage had no Google Analytics tag. The verified public measurement ID is the fallback when `NEXT_PUBLIC_GA_ID` is absent.

Analytics loads only after the optional analytics choice is allowed; rejection persists and visitors can reopen the choice. Product event dispatch is also gated. Revocation disables this GA property. The banner controls this analytics integration, not the existing AdSense or Cloudflare services.

Enhanced Measurement already has page-load and browser-history views enabled in the property. Initialization now queues before the SDK loads and uses the automatic page view path; a separate manual route config no longer races initialization or duplicates history views. Localhost uses debug mode for validation. Verify actual `page_view` and product events in DebugView/Realtime before treating measurement as operational. This is not a full advertising CMP implementation.

Local validation on 2026-10-19: 13 tests and TypeScript passed; the agenda was checked in a 390px mobile viewport and a 1440px desktop viewport. Search, favourites, a downloaded ICS and cross-timezone event links were checked through the browser. The full Cloudflare build also passed.

## Monitored recovery on 2026-10-19

PR #1 was merged and the public `/agenda` deployment was verified. DebugView received a real `page_view` and `agenda_favorite`; the public tag was checked after allowing optional analytics. Search Console accepted the updated sitemap with 170 URLs.

Manual read-only import run 39302531611 passed: URBA 2026 produced 114 dated matches and World Cup 2027 produced 36 dated fixtures. Alumni–CASI was 14–22 and France–Samoa was dated 2027-10-17.

The subsequent live import updated 148 records and inserted 2; the public API confirmed all seven URBA October 17 scores and no World Cup matches on that 2026 date. France–Samoa retained its stable ID 15593 and moved to 2027. Teams remained at 139. No duplicate-cleanup deletion was enabled.

That run failed after the successful data import/export, in the container's Git snapshot commit step (`fatal: not in a git directory`). Snapshot publication now runs once in a separate Ubuntu job with an explicitly scoped write token. Browser scraping jobs retain read-only repository access. The 16 configured feeds are distributed into up to four bounded groups instead of one long serial job. Current dry-run reports use a dedicated directory so committed historical dumps cannot be mistaken for fresh output.

Scheduled primary writes remain gated by `DATA_SYNC_ENABLED` until the complete configured feed set passes validation and monitored reconciliation. Other dormant schedules remain disabled during this recovery.


## Points, form, news photos and live refresh — PR #8

- Seven regular-season standings feeds passed read-only validation run 39358399611: URBA 14 rows, France 14, Italy 10, MLR 6, URC 16, Super Rugby Americas 8, Premiership 10. Selecting the regular Main phase avoids accidentally reading a playoff draw; asynchronous table rendering is awaited and incomplete rows are rejected.
- URBA's official 2026 table is independently read from urba.org.ar, validates all 14 exact clubs and includes actual bonus points. Newman: 26 played, 110 points. The edition-bound overlay preserves available recent form and never applies the 2026 table to another year.
- League pages open with points tables and offer the five available confirmed results, expandable to opponents, scores, dates and details. Incomplete historical match coverage is not silently described as a complete season.
- Twenty-four news previews have publisher images, compact cards and original source links. All 24 image endpoints were checked successfully.
- All 151 database-catalogue teams resolve locally. Additional editorial-only clubs were researched separately; see VISUAL-ASSETS.md for coverage and remaining unverified identities.
- TV, radio y streams has a dedicated route. Previous external directory destinations remain labeled as external options, not verified per-match broadcasts.
- The new live workflow removes synthetic clock/finalization steps, paginates candidates and refuses to infer LIVE or FT from elapsed time. Frontend polling is 15 seconds while source-live games are shown, 60 otherwise; upstream workflows are scheduled every 5 minutes and GitHub scheduling can be delayed. A no-candidate run does not demonstrate a score changing during a match.
- Supersedes the older recovery instruction above mentioning clock/finalization passes: do not re-enable those legacy steps.
- 36 tests and TypeScript passed. The local browser controller is disabled by Work settings and exposes no tool to enable it, so the current additions still need an interactive desktop/mobile pass when that setting is available. HTTP/API, source images and production build checks are separate evidence, not a substitute claim of browser QA.


## Appearance settings

The shared header now labels /settings as Configuración / Settings / Réglages / Impostazioni. The first section offers visual selectors for RugbyNOW green, light and dark themes, normal/large text, and compact/comfortable spacing, with a preview and an appearance-only reset. League and club selections are preserved by the reset.

Theme storage retains the existing `theme` key; text size and density extend `rn:personalization` without discarding guide visibility or followed teams/leagues. Appearance is applied before hydration and synchronized across page navigation and browser tabs. No account or cross-device synchronization is introduced. Source checks, 36 tests, TypeScript and a production build verify the change; interactive browser QA remains unavailable while Work disables browser control.


## Compact portal, Pro D2, broadcasters and challenges — 2026-10-20

Implementation is on `codex/compact-portal-advertising`; publication and live-data validation must be checked separately. Pro D2 uses the explicit 2026/2027 LNR roster and Flashscore feed, a distinct `fr-pro-d2` slug and a sixteen-row guard both before identity resolution and before cache writes. No duplicate-cleanup deletion was enabled.

`sync:broadcasts` refreshes the current official LNR round, validates complete fixtures/edition/offsets and atomically replaces its JSON after parsing. It runs in the main snapshot job; refresh failure preserves previous listings and is reported independently of scores. The displayed broadcaster requires exact teams, UTC kickoff and selected country.

The dense shared portal adds competition navigation and reserved horizontal/desktop vertical ad placements. Existing public AdSense publisher and unit IDs were recovered from the project configuration, avoiding an unnecessary request to the owner. The house creative and /advertise inquiry coexist with AdSense; no sponsor, account approval, fill, traffic or earnings is claimed. Google ad clicks are not tracked manually or refreshed in a custom loop.

Match details now request source data every 15 seconds for LIVE/HT and 60 otherwise, preserve the last successful response on an update error, and provide exact territorial TV. H2H uses stable IDs in both home/away directions, the same rugby discipline, FT with both scores, dates before the reference/current instant and at most five available results. Snapshot identities must match the catalogue; curated fallback IDs never join database history.

/games contains twenty sourced questions in four languages, five daily questions selected by UTC date, a separate practice mode and locally saved daily progress. Correct answers, explanations and official sources appear after answering. This is the first rugby quiz implementation, not a claim of all Futbol11 game types.
