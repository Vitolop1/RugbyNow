# RugbyNOW visual assets

Logos identify teams, competitions and listed broadcasters. They do not imply a partnership or transmission rights. Keep originals in `public/team-logos`, `public/league-logos` and `public/broadcast-logos`; use `object-fit: contain` and a rugby-ball fallback on missing resources.

`npm run generate:assets` refreshes `data/visual-assets.json`; the production build runs it automatically. The resolver checks this local inventory before emitting a logo URL, so missing images also work before client-side error handlers attach. Unknown club resources use `public/icons/rugby-ball.svg`; Black Lion and Parabiago now have verified local crests. Missing competition identities use the same fallback; Challenge Cup must not borrow the Champions Cup logo, and SVNS must not borrow Rugby World Cup Sevens branding.

- `team-logos/los-pumas.svg`: downloaded 2026-10-19 from https://uar.com.ar/wp-content/uploads/LosPumas.svg, linked by the UAR's official identity page https://uar.com.ar/identidad/. Used for the senior Argentina team. The previous PNG predates the UAR identity redesign.
- `team-logos/vannes.svg`: downloaded from https://www.rugbyclubvannes.bzh/voy_content/uploads/2022/05/logo-rc-vannes.svg, the club crest linked by its official homepage. `toulon` now resolves to the existing `rc-toulonnais` crest.
- `team-logos/australia.png`: existing Wallabies kangaroo identity, visually inspected in this revision. Existing club and competition assets are retained; provenance of older files was not independently reconstructed.
- Broadcast logos already in the repository are used only for providers listed against that dated editorial event. There is no competition-wide automatic provider assignment on the new agenda. Listing territory is Argentina, independently selected from the time zone. Other countries show no confirmed provider until researched.

The 15–22 October 2026 guide is a bounded editorial input. A channel/platform link is labeled as such; missing or tentative destinations remain pending. Do not copy a listing to another match/week or present it as a verified direct stream.


## Complete catalogue audit, 2026-10-20 UTC

All 142 teams in the current snapshot resolve to a real local resource (zero neutral fallbacks in the team catalogue). Six Spanish sevens slugs now resolve to their existing national union images: Fiyi, Sudáfrica, Nueva Zelanda, España, Gran Bretaña and Francia. These are union identifiers, not invented separate seven-team brands.

New verified resources:

- Black Lion: [EPCR club page](https://www.epcrugby.com/challenge-cup/clubs/black-lion/latest), the club's dark SVG from its published logoDark data: <https://media-cdn.incrowdsports.com/05e48a83-232e-4485-a449-b965b1f6d247.svg>. The companion light PNG is also preserved.
- Cheetahs: [official club](https://www.fscheetahs.co.za/), <https://www.fscheetahs.co.za/images/logo.png>.
- Rugby Deutschland: [official federation](https://www.rugbydeutschland.org/), <https://d28kyj1r8oju1l.cloudfront.net/4253/logo/480x480_rugby-deutschland_1770568906.png>.
- Parabiago: the official website's old image URLs returned 404. Used the club crest from its [title sponsor's partnership page](https://www.vivienergia.it/rugby-parabiago): <https://vivienergia.imgix.net/uploads/2022/10/18142221/Logo-Parabiago.png?auto=format&width=320>.
- Kenya Rugby Union: the federation site was unavailable and its old social profile image returned 404. Used the union's press logo supplied in the [KRU-issued release](https://www.africanews.it/english/rugby-books-entrepreneurship/): <https://www.africa-newsroom.com/files/large/b1c3acf07ba1b7f>.

New logos were visually inspected. Existing assets were checked for local resolution, not all re-downloaded or independently relicensed. Logos identify teams; ownership remains with their respective clubs/unions.

News illustrations are publisher-provided Open Graph/RSS preview images hosted by UAR or ESPN. Only the preview, headline, date and original source link appear; no full articles are copied. Twenty-four image endpoints returned HTTP 200 and an image content type during validation. Broken or unavailable previews fall back to a neutral RugbyNOW tile.


## Editorial guide additions, 2026-10-20 UTC

The 142-team database catalogue is separate from clubs and youth sides mentioned only in the dated editorial guide. Added and visually inspected:

- Curupaytí, Lomas, Pueyrredón, San Andrés, San Luis and Universitario La Plata: the corresponding club image linked by the [official URBA directory](https://urba.org.ar/clubes). URBA's published CDN/proxy destination is retained as source evidence in the delivery research files.
- Northland: official header logo, <https://northlandrugby.co.nz/wp-content/uploads/2025/01/NRU-Logo-Dark-Blue-Horizontal.png>.
- Taranaki: official [TRFU](https://trfu.co.nz/) header logo, `TRFU-Logo-Crest-TITLE-Negative-BG_2ec55789-b175-474b-abef-9c74cfba5a46.png` from its Shopify CDN.
- Córdoba Athletic: <https://cordobaathletic.club/wp-content/uploads/2022/08/logo300.png>.
- Tucumán Rugby: <https://tucumanrugby.com/wp-content/uploads/2022/01/trc-88-copia.png>.
- Huirapucá, Cardenales, Natación y Gimnasia and Universitario de Tucumán: the club-specific Cloudinary images linked by the [official URT site](https://www.urtuc.com/). Universitario's image is stored but the ambiguous standalone editorial name is not automatically assigned to it.
- Los Cuervos (Uruguay): `logo-los-cuervos.png` linked by the [official URU directory](https://uru.org.uy/clubes).

The editorial youth national sides use the existing union identity, preserving their M-19/M-20/M-17 names. Jockey Salta maps only to Jockey Club de Salta. Some editorial-only identities remain unresolved, including Otago, Canterbury, Tala, Lobos, Alfiles, Jockey San Juan and provincial youth unions; the neutral fallback is intentional until the correct crest can be verified. Sporty's Canterbury/Otago image servers returned HTTP 403. This is not a claim of every club worldwide being covered.
