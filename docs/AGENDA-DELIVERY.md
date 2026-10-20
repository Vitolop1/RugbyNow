# RugbyNOW agenda delivery

## Product direction

The current milestone is the daily rugby agenda: today's matches, kickoff in the visitor's timezone and where to watch in the selected country. Compact green presentation takes its information hierarchy from Promiedos and ElNine, while retaining RugbyNOW identity. News, injury/player databases, chat AI and YouTube publishing are deferred.

## Previous work in chronological order

1. Correct source editions/dates and recover stale imports. A 16-feed read-only run returned 997 dated rows; a full production reconciliation then completed successfully.
2. Repair paginated snapshots and Git publication. The monitored full run exported all 1,792 matches and pushed the snapshot to main; it did not stop at the default 1,000-row limit.
3. Restore the existing verified GA4 property and optional visit/click measurement. DebugView received real test events. Search Console accepted the updated sitemap; indexing is not guaranteed by submission.
4. Preserve the dated regional guide as editorial input, with Argentina times and explicit channel/platform distinctions.
5. Replace the large editorial layout with the compact daily homepage and agenda. Merge source results into the editorial rows, rather than showing duplicate URBA fixtures. Preserve calendar, sharing and local favourites.
6. Repair the Lions/Old Lions identity collision and prevent substring matches. No records were deleted.
7. Install and validate the reusable `rugbynow-quality` skill. It is invoked during an agent task and does not run on its own.

## Actual boundaries

- The configured source set is not every rugby competition. Regional data outside the dated guide needs an ongoing maintained source. An old source edition is never rolled into today.
- TV listings from the guide apply to Argentina and the listed date. An unconfirmed destination stays pending; broadcasts in other countries still need event-specific research. No highlights link is invented.
- The page polls once per minute while open. Source freshness depends on the ingestion workflows; polling is not proof of live score latency.
- The primary workflow is configured every five minutes, subject to GitHub scheduling/queue delays, with a daily refresh plus complete snapshot/Git push at 05:17 UTC. Both depend on repository variable `DATA_SYNC_ENABLED=true`. The same snapshot job is also exercised by manual production imports; a successful database import alone does not prove that the push succeeded.
- Only the verified primary data workflow is restored as part of this recovery. Legacy live/clock/finalization/standings workflows remain disabled until their behavior is reconciled with source-confirmed states. In particular, clock-only inference must not reintroduce guessed live/final states.
- No external inactivity monitor, paid feed, notifications backend, review backend or monetization feature has been provisioned. The existing research report contains later opportunities; they do not delay the daily agenda.

## Validation

The automated checks cover explicit source years, UTC/local day boundaries, editorial/database merging, duplicate handling, no inferred live state, no propagation of TV rights and exact team identity. Browser checks exercise desktop/mobile layouts, empty weekdays, search, date navigation, saved events, country selection, a downloaded ICS and share links. Final deployment results and evidence are recorded in the user-facing delivery report.
