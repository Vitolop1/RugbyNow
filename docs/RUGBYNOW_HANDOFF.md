# RugbyNow - Handoff Completo

## 1. Resumen corto

`RugbyNow` es una web de rugby que muestra:

- partidos del dia y por fecha
- resultados y marcadores en vivo
- paginas por liga
- tablas de posiciones
- perfiles de equipos y ligas
- soporte multiidioma
- soporte de zonas horarias

La app usa `Supabase` como fuente principal de datos, `Flashscore` como fuente scrapeada para actualizar resultados, y una capa de `snapshot/fallback` para que la web siga funcionando aunque la base falle o quede inaccesible.

## 2. Stack tecnico

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `Supabase`
- `Playwright`
- `Cloudflare Workers`
- `OpenNext` para adaptar Next.js a Cloudflare

## 3. Como esta organizada la app

### Frontend

- `app/page.tsx`
  - renderiza la home
- `app/HomeClient.tsx`
  - maneja filtros, fecha, zona horaria, idioma y pedidos a `/api/home`
- `app/leagues/[slug]/LeagueClient.tsx`
  - muestra la pagina de una liga, con fixture, tabla, equipos, campeones y cuadro eliminatorio
- `app/teams/[slug]/TeamClient.tsx`
  - muestra la pagina de un equipo
- `app/about/page.tsx`
  - pagina de info del proyecto

### Backend API

- `pages/api/home.ts`
  - devuelve los partidos de una fecha, agrupados logicamente para la home
- `pages/api/leagues/[slug].ts`
  - devuelve todo lo necesario para una liga:
  - perfil
  - rondas
  - partidos
  - tabla
  - metadata knockout
  - placeholders de fases futuras si aplica
- `pages/api/teams/[slug].ts`
  - devuelve perfil y estadisticas de un club
- `pages/api/competitions.ts`
  - devuelve el catalogo de ligas

### Librerias clave

- `lib/serverSupabase.ts`
  - crea el cliente server-side de Supabase
- `lib/supabaseSnapshot.ts`
  - lee y transforma el snapshot exportado de Supabase
- `lib/fallbackData.ts`
  - datos curados a mano para fallback
- `lib/matchStatus.ts`
  - decide el estado efectivo de un partido
- `lib/matchPresentation.ts`
  - define como se muestra el estado en UI
- `lib/usePrefs.ts`
  - guarda idioma, timezone y tema en localStorage
- `lib/timeZoneDate.ts`
  - convierte fechas a una timezone concreta
- `lib/i18n.ts`
  - textos de la interfaz en `en`, `es`, `fr`, `it`

## 4. Flujo general de datos

### Flujo principal

1. `Flashscore` publica fixtures, livescore y tablas.
2. Los scripts del repo scrapean esa informacion.
3. Los scripts guardan datos en `Supabase`.
4. La web consulta primero `Supabase`.
5. Si Supabase falla o no responde, usa:
   - `data/supabase-snapshot.json`
   - y despues `lib/fallbackData.ts`
6. La UI renderiza la home, ligas y equipos con esos datos.

### Prioridad de fuentes

La app sigue esta prioridad:

1. `Supabase`
2. `Snapshot`
3. `Fallback`

Eso permite que la web no se caiga aunque haya un problema de red, de entorno o del scraper.

## 5. Base de datos: modelo y logica

La base esta en `Supabase` y el modelo actual, visto desde el codigo, gira en torno a estas tablas:

### `competitions`

Representa cada liga o torneo.

Campos usados:

- `id`
- `name`
- `slug`
- `region`
- `country_code`
- `category`
- `group_name`
- `sort_order`
- `is_featured`

Ejemplos:

- `fr-top14`
- `int-six-nations`
- `svns-usa`
- `ar-liga-norte-grande`

### `seasons`

Representa una temporada de una competencia.

Campos usados:

- `id`
- `name`
- `competition_id`

Relacion:

- una `competition` tiene muchas `seasons`

### `teams`

Representa clubes o seleccionados.

Campos usados:

- `id`
- `name`
- `slug`

Relacion:

- los equipos aparecen en partidos y en standings

### `matches`

Es la tabla mas importante. Guarda los partidos.

Campos usados:

- `id`
- `season_id`
- `match_date`
- `kickoff_time`
- `status`
- `minute`
- `updated_at`
- `source`
- `source_url`
- `source_event_key`
- `home_score`
- `away_score`
- `round`
- `venue`
- `home_team_id`
- `away_team_id`

Estados usados por la app:

- `NS` = no empezado
- `LIVE` = en vivo
- `HT` = entretiempo
- `FT` = terminado
- `CANC` = cancelado

### `standings_cache`

Guarda tablas ya scrapeadas de Flashscore para no recalcular siempre.

Campos usados:

- `season_id`
- `team_id`
- `position`
- `played`
- `won`
- `drawn`
- `lost`
- `points_for`
- `points_against`
- `points`
- `source`
- `updated_at`

Relacion:

- una `season` tiene muchas filas en `standings_cache`
- una fila pertenece a un `team`

## 6. Relaciones entre tablas

Modelo simplificado:

- `competitions` 1 -> N `seasons`
- `seasons` 1 -> N `matches`
- `seasons` 1 -> N `standings_cache`
- `teams` 1 -> N `matches` como local
- `teams` 1 -> N `matches` como visitante
- `teams` 1 -> N `standings_cache`

## 7. Como decide la app el estado de un partido

La fuente base es el `status` guardado en `matches`, pero la app le aplica logica extra.

Eso vive en:

- `lib/matchStatus.ts`
- `lib/matchPresentation.ts`

### Reglas importantes

- si el scraper confirma `FT`, queda terminado
- si el scraper confirma `HT`, queda entretiempo
- si el scraper confirma `LIVE`, queda en vivo
- la UI puede seguir contando minutos desde el ultimo scrapeo
- pero no cruza sola de primer tiempo a segundo si el scraper no lo confirmo
- en rugby XV el tope visible es `80`
- en seven el tope visible es `14`

### Particularidades actuales

- `Liga Norte Grande`
  - no muestra reloj ni `1T/2T`
  - muestra solo `VIVO`
  - se usa un aviso tipo `Solo resultado final.`
- seven y XV tienen ventanas y duraciones distintas

## 8. Home: como funciona

La home llama a:

- `/api/home?date=YYYY-MM-DD&tz=America/...`

Esa API:

- busca partidos de `ayer`, `hoy` y `manana`
- normaliza los partidos en la timezone elegida
- deduplica partidos parecidos entre Supabase, snapshot y fallback
- prioriza el mejor registro
- devuelve partidos listos para renderizar

Esto es importante porque muchos errores venian de mezclar:

- fecha local del usuario
- fecha UTC del partido
- hora UTC del kickoff

Hoy eso esta bastante corregido para evitar que partidos de Oceania aparezcan en el dia incorrecto.

## 9. Pagina de liga: como funciona

La pagina de liga llama a:

- `/api/leagues/[slug]`

Esa API:

- busca la competencia en `competitions`
- elige la `season` mas logica para la fecha pedida
- trae partidos de `matches`
- deriva `roundMeta`
- intenta usar `standings_cache`
- si no sirve, calcula la tabla desde los resultados `FT`
- mezcla snapshot o fallback si hace falta
- expone datos extra para UI:
  - `profile`
  - `regionProfile`
  - `noticeKey`
  - `roundMeta`
  - `knockoutRoundMeta`
  - `knockoutMatches`

## 10. Knockout / llaves eliminatorias

Ya hay una primera capa armada para torneos con fases eliminatorias.

Ejemplo actual:

- `SVNS USA`

Se detectan cosas como:

- `Play Offs`
- `5th-8th places`
- `Semi-finals`
- `Final`

### Como se detecta

El scraper toma metadata del bloque scrapeado y la guarda embebida en `source_url`:

- `rn_phase`
- `rn_stage`

Con eso despues la API puede:

- detectar que una ronda es knockout
- separar ramas
- generar placeholders futuros

Ejemplo:

- semifinal 1
- semifinal 2
- final placeholder `Winner SF1 vs Winner SF2`

Esto hoy ya existe, aunque la parte visual del cuadro puede seguir mejorando.

## 11. Snapshot y fallback

### Snapshot

Archivo:

- `data/supabase-snapshot.json`

Se genera desde:

- `scripts/export-supabase-snapshot.ts`

Incluye:

- `competitions`
- `seasons`
- `teams`
- `matches`
- `standings_cache`

Uso:

- si Supabase falla en runtime
- si Cloudflare no puede usar bien la base
- si queres congelar un backup de datos

### Fallback

Archivo central:

- `lib/fallbackData.ts`

Uso:

- ligas curadas a mano
- parches para partidos o competencias que queres sostener si falla el upstream
- soporte extra en desarrollo

## 12. Scripts de scraping y actualizacion

### Scraper principal

- `scripts/sync-flashscore.ts`

Hace:

- abre Flashscore con `Playwright`
- scrapea `results`, `fixtures`, `live` y `standings`
- detecta score, estado, minuto y round
- resuelve equipos
- hace insert/update en `matches`
- upsert en `standings_cache`

### Scripts auxiliares de live

- `scripts/sync-live-runner.ts`
  - detecta competencias potencialmente activas
  - corre el scraper solo para esas

- `scripts/sync-live-clock-runner.ts`
  - se enfoca solo en ligas con partidos `LIVE/HT`
  - sirve para cambios rapidos de score/minuto

- `scripts/sync-live-finish-runner.ts`
  - busca partidos cerca del final o listos para cerrar
  - sirve para capturar `FT`

### Otros scripts importantes

- `scripts/sync-standings-runner.ts`
  - refresca tablas
- `scripts/rebuild-flashscore.ts`
  - reinicia datos Flashscore y vuelve a construir
- `scripts/ensure-flashscore-competitions.ts`
  - asegura mapeos base
- `scripts/check-supabase.ts`
  - testea Supabase
- `scripts/build-weekly.ts`
  - genera contenido semanal
- `scripts/generate-team-profiles.ts`
  - genera perfiles de equipos

## 13. Scripts npm mas usados

### Desarrollo

- `npm run dev`
- `npm run build`
- `npm run deploy`

### Datos

- `npm run sync:flashscore`
- `npm run sync:live`
- `npm run sync:live:clock`
- `npm run sync:live:finish`
- `npm run sync:standings`
- `npm run export:supabase-snapshot`

## 14. Automatizacion

En `.github/workflows/` hay workflows para:

- `sync-live.yml`
- `sync-live-clock.yml`
- `sync-live-finish.yml`
- `sync-scores.yml`
- `sync-standings.yml`
- `rebuild-flashscore.yml`

Objetivo:

- mantener resultados live
- capturar cierres
- refrescar standings

Nota importante:

- GitHub Actions con `schedule` no es exacto al minuto
- puede demorar corridas
- por eso para live fino se complementa con scripts locales o rafagas internas

## 15. Infraestructura y deploy

### Produccion

La web publica vive en:

- `Cloudflare Workers`
- dominio: `rugby-now.com`

### Como se construye

Se usa `OpenNext` para adaptar Next.js a Cloudflare.

Scripts:

- `npm run build`
  - corre `opennextjs-cloudflare build`
- `npm run deploy`
  - corre `opennextjs-cloudflare build && opennextjs-cloudflare deploy`

Config relevante:

- `open-next.config.ts`
  - define que OpenNext use `npm run build:next`
- `wrangler.jsonc`
  - Worker principal
  - assets
  - binding de imagenes
  - binding de R2 para cache incremental

### Bindings importantes en Cloudflare

- `ASSETS`
- `WORKER_SELF_REFERENCE`
- `NEXT_INC_CACHE_R2_BUCKET`
- `IMAGES`

## 16. Variables de entorno importantes

Minimas para trabajar datos reales:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FLASH_URLS`

Otras usadas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GA_ID`
- `GOOGLE_SITE_VERIFICATION`
- `LIVE_ONLY`
- `DRY_RUN`
- `MATCHES_ONLY`
- `STANDINGS_ONLY`

## 17. Timezone e idioma

### Timezone

La app detecta la timezone del navegador en la primera visita y la guarda en `localStorage`.

Eso vive en:

- `lib/usePrefs.ts`
- `lib/timeZones.ts`
- `lib/timeZoneDate.ts`

### Idiomas

Idiomas soportados:

- `en`
- `es`
- `fr`
- `it`

Traducciones centralizadas en:

- `lib/i18n.ts`

## 18. Team pages y perfiles

Las paginas de equipos hoy salen desde snapshot/fallback de forma bastante segura.

La info viene de:

- `pages/api/teams/[slug].ts`
- `lib/teamProfiles.ts`
- `data/team-profiles.generated.json`

Cada equipo puede tener:

- descripcion corta
- pais
- ciudad
- colores
- informacion institucional
- ultimos resultados
- proximos partidos

## 19. Problemas conocidos o puntos sensibles

### 1. GitHub Actions schedule

No siempre corre exacto cada 5 minutos.

### 2. Flashscore

No siempre expone todos los datos de knockout o la hora de placeholders futuros.

### 3. Timezones cruzando medianoche

Fue un problema real y hay que seguir vigilandolo, sobre todo para Oceania y seven.

### 4. Snapshot vs Supabase

Si no se deduplica bien, pueden aparecer:

- duplicados
- scores viejos
- rondas mezcladas

### 5. Cloudflare

Si una ruta hace demasiado trabajo server-side puede pegar `Error 1102`.

## 20. Como explicarselo a alguien en 30 segundos

`RugbyNow es una web de rugby hecha con Next.js y desplegada en Cloudflare. La fuente principal de datos es Supabase, pero los resultados y fixtures se actualizan con scrapers de Flashscore hechos en Playwright. Si la base falla, la web sigue funcionando con un snapshot exportado y un fallback curado. Tiene paginas por liga, tablas, equipos, soporte multiidioma, zonas horarias y una capa de logica para mostrar estados live, final, cancelado y fases eliminatorias.`

## 21. Como explicarselo a alguien mas tecnico

`La app tiene una capa de UI en Next.js, una capa API propia en pages/api, una base en Supabase con competitions, seasons, teams, matches y standings_cache, y una capa de scraping en Playwright que mantiene la base actualizada desde Flashscore. En runtime, las rutas intentan resolver contra Supabase; si falla, usan snapshot JSON exportado y, si hace falta, fallback manual. La pagina de liga deriva rounds, standings y bracket metadata a partir de matches y source_url enriquecido. El deploy corre sobre Cloudflare Workers usando OpenNext, con R2 como incremental cache.`

## 22. Que le diria a alguien que va a tocar el proyecto

- no asumas que todo viene directo de Supabase
- chequea siempre si una pantalla esta viniendo de `supabase`, `snapshot` o `fallback`
- si algo esta mal en resultados:
  - revisar scraper
  - revisar Supabase
  - revisar export del snapshot
- si algo esta mal solo en UI:
  - revisar `matchStatus`, `matchPresentation`, timezone e i18n
- si algo se ve distinto entre local y produccion:
  - local corre con `next dev`
  - produccion corre en Cloudflare/OpenNext

## 23. Archivos clave para entender rapido el proyecto

- `README.md`
- `package.json`
- `pages/api/home.ts`
- `pages/api/leagues/[slug].ts`
- `pages/api/teams/[slug].ts`
- `lib/serverSupabase.ts`
- `lib/supabaseSnapshot.ts`
- `lib/fallbackData.ts`
- `lib/matchStatus.ts`
- `lib/matchPresentation.ts`
- `scripts/sync-flashscore.ts`
- `scripts/sync-live-runner.ts`
- `scripts/sync-live-clock-runner.ts`
- `scripts/sync-live-finish-runner.ts`
- `scripts/export-supabase-snapshot.ts`
- `wrangler.jsonc`
- `open-next.config.ts`

## 24. Resumen ejecutivo

Si hay que explicarlo simple:

- la web muestra rugby
- la base principal es Supabase
- los datos los trae un scraper de Flashscore
- si la base falla, hay backup local
- la web esta en Cloudflare
- la arquitectura ya soporta:
  - live
  - resultados finales
  - tablas
  - perfiles
  - timezones
  - idiomas
  - torneos knockout
