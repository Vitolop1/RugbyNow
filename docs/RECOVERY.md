# Data refresh recovery

The public GitHub API reported all six scheduled refresh workflows as `disabled_inactivity` on 2026-10-19. The last visible runs were from 2026-06-04. GitHub automatically disables public-repository schedules after 60 days without repository activity; a successful application deployment does not prove that data refresh is running.

## Changes in this repair

- Parse complete source dates before yearless labels. Reject impossible dates and ambiguous editions instead of assigning today's year to `Current`.
- Request source pages in UTC and English so parsed kickoff times and relative dates agree on one timezone on local and hosted runners.
- Read the source page's season, create a missing explicitly identified season, and process historical results and upcoming fixtures in separate groups. Existing stable source event IDs can move incorrectly dated records into the corrected edition on the next successful sync.
- Seed the men's World Cup as 2027. Records lacking stable source IDs may need a separate audited reconciliation; do not reset the database to repair these.
- Fail the job when a full match feed cannot be read or writes fail, instead of reporting success with no updates. Remove the global TLS-verification bypass from the main importer.
- Evaluate the homepage date per request and recover from failed or non-JSON requests with an error and retry.
- Update the document language after selection and offer time zones for additional rugby markets. Separate indexable language URLs remain a later change.
- Record `match_open`, `watch_options_open` and `watch_provider_click` through the existing optional GA4 integration. This requires a real configured GA4 property and the applicable consent setup. It does not confirm a stream was watched, a purchase occurred, or a review was submitted.

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

Provider names without confirmed URLs remain marked pending. Known channel and platform destinations are labeled separately from event-specific streams. Calendar and favourite actions send optional GA4 events only when an existing property is configured; no analytics account or review backend is created.

Local validation on 2026-10-19: 11 tests and TypeScript passed; the agenda was checked in a 390px mobile viewport and a 1440px desktop viewport. Search, favourites, a downloaded ICS and cross-timezone event links were checked through the browser.
