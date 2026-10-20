# RugbyNOW visual assets

Logos identify teams, competitions and listed broadcasters. They do not imply a partnership or transmission rights. Keep originals in `public/team-logos`, `public/league-logos` and `public/broadcast-logos`; use `object-fit: contain` and a rugby-ball fallback on missing resources.

`npm run generate:assets` refreshes `data/visual-assets.json`; the production build runs it automatically. The resolver checks this local inventory before emitting a logo URL, so missing images also work before client-side error handlers attach. Black Lion, Parabiago and unknown club resources use `public/icons/rugby-ball.svg`. Missing competition identities use the same fallback; Challenge Cup must not borrow the Champions Cup logo, and SVNS must not borrow Rugby World Cup Sevens branding.

- `team-logos/los-pumas.svg`: downloaded 2026-10-19 from https://uar.com.ar/wp-content/uploads/LosPumas.svg, linked by the UAR's official identity page https://uar.com.ar/identidad/. Used for the senior Argentina team. The previous PNG predates the UAR identity redesign.
- `team-logos/vannes.svg`: downloaded from https://www.rugbyclubvannes.bzh/voy_content/uploads/2022/05/logo-rc-vannes.svg, the club crest linked by its official homepage. `toulon` now resolves to the existing `rc-toulonnais` crest.
- `team-logos/australia.png`: existing Wallabies kangaroo identity, visually inspected in this revision. Existing club and competition assets are retained; provenance of older files was not independently reconstructed.
- Broadcast logos already in the repository are used only for providers listed against that dated editorial event. There is no competition-wide automatic provider assignment on the new agenda. Listing territory is Argentina, independently selected from the time zone. Other countries show no confirmed provider until researched.

The 15–22 October 2026 guide is a bounded editorial input. A channel/platform link is labeled as such; missing or tentative destinations remain pending. Do not copy a listing to another match/week or present it as a verified direct stream.
