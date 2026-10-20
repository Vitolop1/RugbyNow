# RugbyNOW: portal, preferences and provider audit

## Delivered behavior

The agenda, competition directory and competition calendar use the same compact green interface and shared navigation. Existing match, team and information pages retain their functions under the shared header and palette. Competition calendars group actual local dates instead of treating reused or reconstructed round numbers as official matchdays. This fixes the observed June/October URBA mix without rewriting historical records. The season directory prefers editions with records over empty setup placeholders.

`/settings` stores favourite league order, followed clubs, appearance, spacing, timezone and editorial guide visibility locally. The agenda's Following filter includes either a followed club or a favourite league. It uses existing `rn:favorite-leagues` and `rn:hidden-leagues` keys, plus `rn:followed-clubs` and `rn:personalization`. No account, password collection or cross-device synchronization is implemented. The user suggested accounts as optional; local preferences provide immediate functionality without a fake login flow.

The TV panel separates dated editorial broadcasters from an optional external directory. Restored historical destinations: TV Libre, VIPLeague, VIPRow and RugbyBox. They are labeled unverified and are not represented as event-specific confirmed broadcasts. The old code contained RugbyBox, not a verified Big Box destination. On the audit, VIPRow DNS and TV Libre TLS failed; no replacement domains were guessed or security warnings bypassed.

## News

`/news` reads public RSS from UAR and ESPN Scrum independently. It displays only original-language headlines, publication timestamps, source names and original links. It does not copy full articles or remotely hosted editorial images. Both feeds returned actual dated items during validation. The interface supports ES/EN/FR/IT; headline language remains explicit.

Requests use six-second timeouts, RSS validation, size limits, entity-declaration rejection, allowed destination hosts, HTTPS-only links, duplicate removal and a 30-day window. The server caches reads for 15 minutes. If one feed fails or returns zero valid items, its previous snapshot items retain their original timestamps and the page reports a source failure. If all feeds fail, the backup updater fails without replacing the existing file. The bundled fallback refresh is included in the daily score snapshot publication; a news failure cannot block the score backup.

## Match ingestion audit

The active importer remains Flashscore. Primary GitHub Actions has 17 configured feeds, four bounded groups and a separate complete snapshot publication. Its activation and a successful manual run are not evidence of an automatic schedule firing. The last scheduled run observed before this phase was skipped; do not claim autonomous refresh is verified until a later scheduled run succeeds.

The new matches runner isolates each competition in a subprocess, continues to remaining feeds after a failed source, and writes an atomic per-feed health report. A process with exit code zero but no scraped rows fails health validation. Reports include source rows, writes, attempts' timestamps and exit code; they are uploaded for every workflow execution, including production, for 14 days. They contain no keys. Successful feeds remain in the database while any source failure prevents publication of a supposedly complete backup. Writes are not blindly retried. Metadata and complete competition calendar queries now paginate with stable IDs and reject a partial read.

## Structured provider expansion: not activated

Official API-Sports coverage page: <https://api-sports.io/sports/rugby>. At the audit it listed 144 leagues/cups, including historical/renamed competitions. This is not proof of 144 current complete live feeds. Validate each competition, season, update frequency, usage quota and commercial redistribution terms before activation. Another documented provider is Sportradar: <https://developer.sportradar.com/rugby/reference/rugby-competitions>.

`lib/apiSportsRugby.ts` and `npm run validate:rugby-api` provide a read-only connection and normalization candidate. Set `API_SPORTS_KEY` privately in the execution environment; optionally set a valid `RUGBY_API_DATE`. The tool reads leagues and games, rejects API-reported errors, incomplete pagination, unsupported states, ambiguous timestamps and malformed identities, and saves a review report. API keys never enter client code or reports. No key was present, so live provider validation and database writes are not claimed. No account or subscription was created.

Before production import, review the real payload and map provider competition/team IDs to existing IDs. Do not match teams by substring or mix scores field by field across sources. Add a persistent provider-ID mapping with provenance, source priority and conflict review; validate with a dry run and backup. In particular, API-Sports ID namespaces must not overwrite Flashscore source IDs or recreate Lions/Old Lions duplicates. Until this work is possible with a key, the adapter does not change production scores or imply automatic failover.

Flashscore's own terms restrict scraping/aggregation without consent: <https://livesport.eu/terms-of-use/en>. Expanding scraping is therefore not a durable commercial data contract. ESPN RSS is active for news, not confirmed as a results API. Salida de 22 (<https://salidade22.com/>) was identified but its site/feed could not be reached in this audit; it is not an active importer.

## Validation

Run `npm test`, `npm run typecheck`, and the Cloudflare build. Review desktop/mobile appearance, preferences after navigation/reload, date selection, a competition's partial-table label, TV directory disclosure and news source filters. Inspect the real GitHub per-feed validation artifact and deployed pages separately; deployment and source import are different checks.
