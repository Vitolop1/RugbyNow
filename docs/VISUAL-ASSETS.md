# RugbyNOW visual assets

Logos identify teams, competitions and listed broadcasters. They do not imply a partnership or transmission rights. Keep originals in `public/team-logos`, `public/league-logos` and `public/broadcast-logos`; use `object-fit: contain` and a rugby-ball fallback on missing resources.

`npm run generate:assets` refreshes `data/visual-assets.json`; the production build runs it automatically. The resolver checks this local inventory before emitting a logo URL, so missing images also work before client-side error handlers attach. Unknown club resources use `public/icons/rugby-ball.svg`; Black Lion and Parabiago now have verified local crests. Missing competition identities use the same fallback; Challenge Cup must not borrow the Champions Cup logo, and SVNS must not borrow Rugby World Cup Sevens branding.

- `team-logos/los-pumas.svg`: downloaded 2026-10-19 from https://uar.com.ar/wp-content/uploads/LosPumas.svg, linked by the UAR's official identity page https://uar.com.ar/identidad/. Used for the senior Argentina team. The previous PNG predates the UAR identity redesign.
- `team-logos/vannes.svg`: downloaded from https://www.rugbyclubvannes.bzh/voy_content/uploads/2022/05/logo-rc-vannes.svg, the club crest linked by its official homepage. `toulon` now resolves to the existing `rc-toulonnais` crest.
- `team-logos/australia.png`: existing Wallabies kangaroo identity, visually inspected in this revision. Existing club and competition assets are retained; provenance of older files was not independently reconstructed.
- Broadcast logos already in the repository are used only for providers listed against that dated editorial event. There is no competition-wide automatic provider assignment on the new agenda. Listing territory is Argentina, independently selected from the time zone. Other countries show no confirmed provider until researched.

The 15–22 October 2026 guide is a bounded editorial input. A channel/platform link is labeled as such; missing or tentative destinations remain pending. Do not copy a listing to another match/week or present it as a verified direct stream.


## Complete catalogue audit, 2026-10-20 UTC

All 151 teams in the current snapshot resolve to a real local resource (zero neutral fallbacks in the team catalogue). Six Spanish sevens slugs now resolve to their existing national union images: Fiyi, Sudáfrica, Nueva Zelanda, España, Gran Bretaña and Francia. These are union identifiers, not invented separate seven-team brands.

New verified resources:

- Black Lion: [EPCR club page](https://www.epcrugby.com/challenge-cup/clubs/black-lion/latest), the club's dark SVG from its published logoDark data: <https://media-cdn.incrowdsports.com/05e48a83-232e-4485-a449-b965b1f6d247.svg>. The companion light PNG is also preserved.
- Cheetahs: [official club](https://www.fscheetahs.co.za/), <https://www.fscheetahs.co.za/images/logo.png>.
- Rugby Deutschland: [official federation](https://www.rugbydeutschland.org/), <https://d28kyj1r8oju1l.cloudfront.net/4253/logo/480x480_rugby-deutschland_1770568906.png>.
- Parabiago: the official website's old image URLs returned 404. Used the club crest from its [title sponsor's partnership page](https://www.vivienergia.it/rugby-parabiago): <https://vivienergia.imgix.net/uploads/2022/10/18142221/Logo-Parabiago.png?auto=format&width=320>.
- Kenya Rugby Union: the federation site was unavailable and its old social profile image returned 404. Used the union's press logo supplied in the [KRU-issued release](https://www.africanews.it/english/rugby-books-entrepreneurship/): <https://www.africa-newsroom.com/files/large/b1c3acf07ba1b7f>.

New logos were visually inspected. Existing assets were checked for local resolution, not all re-downloaded or independently relicensed. Logos identify teams; ownership remains with their respective clubs/unions.

News illustrations are publisher-provided Open Graph/RSS preview images hosted by UAR or ESPN. Only the preview, headline, date and original source link appear; no full articles are copied. Twenty-four image endpoints returned HTTP 200 and an image content type during validation. Broken or unavailable previews fall back to a neutral RugbyNOW tile.


## Editorial guide additions, 2026-10-20 UTC

The 151-team database catalogue is separate from clubs and youth sides mentioned only in the dated editorial guide. Added and visually inspected:

- Curupaytí, Lomas, Pueyrredón, San Andrés, San Luis and Universitario La Plata: the corresponding club image linked by the [official URBA directory](https://urba.org.ar/clubes). URBA's published CDN/proxy destination is retained as source evidence in the delivery research files.
- Northland: official header logo, <https://northlandrugby.co.nz/wp-content/uploads/2025/01/NRU-Logo-Dark-Blue-Horizontal.png>.
- Taranaki: official [TRFU](https://trfu.co.nz/) header logo, `TRFU-Logo-Crest-TITLE-Negative-BG_2ec55789-b175-474b-abef-9c74cfba5a46.png` from its Shopify CDN.
- Córdoba Athletic: <https://cordobaathletic.club/wp-content/uploads/2022/08/logo300.png>.
- Tucumán Rugby: <https://tucumanrugby.com/wp-content/uploads/2022/01/trc-88-copia.png>.
- Huirapucá, Cardenales, Natación y Gimnasia and Universitario de Tucumán: the club-specific Cloudinary images linked by the [official URT site](https://www.urtuc.com/). Universitario's image is stored but the ambiguous standalone editorial name is not automatically assigned to it.
- Los Cuervos (Uruguay): `logo-los-cuervos.png` linked by the [official URU directory](https://uru.org.uy/clubes).

The editorial youth national sides use the existing union identity, preserving their M-19/M-20/M-17 names. Jockey Salta maps only to Jockey Club de Salta. Some editorial-only identities remain unresolved, including Otago, Canterbury, Alfiles and Jockey San Juan; the neutral fallback is intentional until the correct crest can be verified. Sporty's Canterbury/Otago image servers returned HTTP 403. This is not a claim of every club worldwide being covered.

- Provincial M-17 sides of Salta, Cuyo and Córdoba use their union crests linked by [UAR Uniones Miembros](https://uar.com.ar/union/uniones-miembros/), preserving the youth team labels.
- Tala: <https://talarc.com.ar/wp-content/uploads/2026/06/logo-tala-300x196.png>, linked by the official club homepage.
- Lobos, Punta del Este: <https://www.lobosrugbyclub.uy/wp-content/uploads/2019/10/lrc_logo_menu.png>, linked by the official club homepage. Never mapped to the unrelated Mexican Lobos team.


## Pro D2 and broadcaster additions, 2026-10-20

The official LNR 2026/2027 roster supplies the exact sixteen Pro D2 identities. Fifteen new local PNGs supplement the existing Montauban crest. The league crest is linked by the official [Pro D2 calendar](https://prod2.lnr.fr/calendrier-et-resultats). All sixteen team images were visually checked together. Resource inventory: 211 local assets after generation.

| Club | Local resource | Published source |
| --- | --- | --- |
| SU Agen | `/team-logos/agen.png` | [LNR crest](https://cdn.lnr.fr/club/agen/photo/logo.8aa88cdfe1a61b725d09eb72f5c7df1dcb211bfa) |
| AS Béziers Hérault | `/team-logos/beziers.png` | [LNR crest](https://cdn.lnr.fr/club/beziers/photo/logo.86701dfaa7b0b0f04f17c3b16dd179dba8cc925f) |
| Biarritz Olympique PB | `/team-logos/biarritz.png` | [LNR crest](https://cdn.lnr.fr/club/biarritz/photo/logo.69e361e72f927de58bb106f9f65f37bb63e5103d) |
| CA Brive | `/team-logos/brive.png` | [LNR crest](https://cdn.lnr.fr/club/brive/photo/logo.d1987994d56d18afdb8066c1f75137227c4e9743) |
| Colomiers Rugby | `/team-logos/colomiers.png` | [LNR crest](https://cdn.lnr.fr/club/colomiers/photo/logo.20a38f758f7f656d5b2994926ac61fa10e7de787) |
| US Dax | `/team-logos/dax.png` | [LNR crest](https://cdn.lnr.fr/club/dax/photo/logo.04c560e6c723287d36d576b2ed47c8ead061cd28) |
| Soyaux-Angoulême XV | `/team-logos/soyaux-angouleme.png` | [LNR crest](https://cdn.lnr.fr/club/angouleme/photo/logo.d54fe6a25434bc867621f7a6c11b1efdfb35f18c) |
| FC Grenoble Rugby | `/team-logos/grenoble.png` | [LNR crest](https://cdn.lnr.fr/club/grenoble/photo/logo.6131d96bcc2c1d10fad389ebe979f74dce6f9e74) |
| US Montauban | `/team-logos/montauban.png` | [LNR crest](https://cdn.lnr.fr/club/montauban/photo/logo.3e17852fbfa2cbfdce5f9b0d47bbf162dd103257) |
| RC Narbonnais | `/team-logos/narbonne.png` | [LNR crest](https://cdn.lnr.fr/club/narbonne/photo/logo.01ef80f0684044e8b6970d0f5d31a85476cbe7bd) |
| USON Nevers | `/team-logos/nevers.png` | [LNR crest](https://cdn.lnr.fr/club/nevers/photo/logo.6223985926c05ecaf3cc397f956a6d7157d63657) |
| Nissa Rugby | `/team-logos/nice.png` | [LNR crest](https://cdn.lnr.fr/club/nice/photo/logo.a7cef37006ba4c679059a3a7be581871ebbdf93e) |
| Stade Aurillacois | `/team-logos/aurillac.png` | [LNR crest](https://cdn.lnr.fr/club/aurillac/photo/logo.77fd2c954d9c788a6c23c0faf8fc54e8beef6212) |
| Oyonnax Rugby | `/team-logos/oyonnax.png` | [LNR crest](https://cdn.lnr.fr/club/oyonnax/photo/logo.69e361e72f927de58bb106f9f65f37bb63e5103d) |
| Provence Rugby | `/team-logos/provence-rugby.png` | [LNR crest](https://cdn.lnr.fr/club/provence-rugby/photo/logo.024d038c338831adcde279e30542b2f985cf0f55) |
| Valence Romans | `/team-logos/valence-romans.png` | [LNR crest](https://cdn.lnr.fr/club/valence-romans/photo/logo.1f4fb3c7644bcdc8d0b5d42c0f2148b599c1cb3e) |
| Pro D2 | `/league-logos/fr-pro-d2.png` | [LNR crest](https://assets.lnr.fr/8/8/9/4/1/conversions/LOGO_PROD2-logo.webp) |

CANAL+ SPORT, CANAL+ SPORT 360 and CANAL+ LIVE logos identify the channels named by the official [LNR round 8 calendar](https://prod2.lnr.fr/calendrier-et-resultats/2026-2027/j8). The eight listings on 22–23 October 2026 are confirmed for France only. SPORT+ has a text label where no verified local mark is available. Existing Disney+/ESPN assets remain available; Argentina editorial TV still applies only to its exact dated fixture. A known logo never creates broadcast rights.

The loading ball and language flags are repo-native SVG components. The ball is inspired by the user’s supplied reference and animated with CSS; it stops for reduced-motion preferences and stays static in an idle empty agenda.

The 20 October refinement uses the same softer oval illustration in loading/empty states and sponsor banners, with two fine seams instead of laces and a planar rotation. Advertising SVG dimensions explicitly override the agenda's generic icon sizing.

## Channel shortcuts, 20 October 2026

Programme rows link directly to the original channel and display the existing local `/broadcast-logos/youtube.png` mark for YouTube destinations. The label says channel, not a confirmed event/live transmission. Source dates and schedule stay bounded to the editorial guide; channel identity does not verify a new weekly programme schedule.

- Try TV Tucumán: https://www.youtube.com/channel/UCSbw1LvjkErbu62IEP9c2cQ (channel title verified).
- Somos La Plata: https://www.youtube.com/channel/UC294dkvc88KFZkkHsBLMAFQ (channel description identifies Canal 6/519 de Flow).
- Mía Tucumán HD: https://www.youtube.com/@miatucumanhd (linked in https://miatucuman.com.ar/).
- LaRz Radio: https://www.youtube.com/channel/UCYhdNotH35a31FoptmQj3Tg (linked from https://larz.com.ar/programacion/22-yardas-rugby/).
- Somos Salta / third time: no exact official channel link verified; keep the broadcaster name and mark the link as unconfirmed, rather than assigning a different Salta channel.

The compact empty-day illustration uses rounded concentric oval panels and a symmetric eight-tooth settings icon. The empty message is a short two-column notice with a small ball, leaving upcoming matches visible sooner.
