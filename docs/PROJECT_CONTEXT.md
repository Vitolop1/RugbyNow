# Contexto de RugbyNOW

Este archivo concentra decisiones duraderas y orientación técnica. Las cifras de cobertura, entregas, PR abiertos y últimas ejecuciones se consultan en [CONTINUATION](CONTINUATION-2026-10-21.md). Los incidentes anteriores están en [RECOVERY](RECOVERY.md). No son autorizaciones para repetir operaciones.

## Producto y preferencias

RugbyNOW busca ser una referencia de rugby comparable a Promiedos: agenda, resultados, tablas, torneos, equipos, jugadores, noticias y dónde ver partidos. Entrar debe permitir entender en segundos qué rugby hay hoy, a qué hora en la zona elegida, quién juega, cómo va/terminó y dónde verlo cuando esté confirmado. Tráfico y monetización son objetivos, sin prometer visitas, ingresos ni cobertura mundial completa.

- Verde, densidad útil y lectura rápida, con referencias [Promiedos](https://www.promiedos.com.ar/) y [El Nine](https://www.elnine.com.ar/). Mismo sistema visual en agenda, competiciones, fichas, noticias y configuración. Filas alineadas, marcadores centrales, escudos proporcionados y competiciones separadas; evitar bloques gigantes y adornos que empujen los partidos.
- Prioridad editorial: Los Pumas, URBA y rugby argentino, junto con internacional relevante. Pro D2 es prioridad explícita; ampliar cobertura por evidencia, no por cantidad aparente.
- ES/EN/FR/IT, banderas en idioma, zona horaria elegible independiente del territorio de TV. Configuración mediante tuerquita compacta; navegación móvil sin scroll horizontal de toda la página. Teclado, foco, tamaños táctiles y movimiento reducido.
- Favoritos, clubes/ligas seguidos y ordenables, guía visible/oculta; temas verde/claro/oscuro, texto normal/grande y densidad compacta/cómoda. Mantener preferencias locales; cuenta y sincronización entre dispositivos no están implementadas.
- Destacados reducido, solicitado contraído inicialmente y con selección equilibrada; agenda diaria primero. Noticias con fotos de procedencia conocida, fecha, fuente y original. Desafíos tienen acceso discreto y progreso separado entre día/práctica. Estados vacíos compactos.
- Pelota compartida: animada solo durante carga, quieta en vacío, sin deformaciones ni costuras de fútbol americano. La referencia más reciente del dueño es verde/azul/blanco (21/10); su rediseño sigue pendiente, no confundirlo con la pelota rojo/azul/blanco implementada anteriormente.
- Escudos auténticos del equipo exacto, contenidos y legibles en todos los temas. Logos pequeños de señales en la fila; el pedido actual busca reunir todos los territorios confirmados, con acceso táctil a país/fuente/fecha. Es una preferencia solicitada, no prueba de que la vista internacional esté publicada.
- «TV, radio y streams» conserva enlaces al canal original y YouTube cuando corresponde. Alternativas externas canónicas en `lib/watchPlaceholderOptions.ts`, separadas de transmisiones verificadas. No volver a dominios históricos ni usar búsquedas como streams confirmados.
- Planteles de temporada, jugadores, entrenadores, lesiones deportivas públicas y movimientos fueron incluidos expresamente el 20/10. No son ideas fuera de alcance del producto, pero cada tarea mantiene su alcance autorizado. IA dentro de la web y nuevos micro-SaaS siguen sujetos a un pedido concreto.
- Publicidad: solo anuncios reales; no restaurar creativos de muestra si no hay entrega. Mantener `/advertise` para consultas directas. Ingresos, aprobación de cuenta y fill requieren evidencia propia.

## Arquitectura y ubicación

Repo [Vitolop1/RugbyNow](https://github.com/Vitolop1/RugbyNow); sitio [rugby-now.com](https://rugby-now.com/). Next.js/React/TypeScript, Supabase, snapshot local y Workers/OpenNext. Versiones y comandos: `package.json`. Rutas App Router en `app/`, API deportiva en `pages/api/`; revisar el archivo real antes de seguir un mapa antiguo.

Recorrido del dato: **fuente → extracción/normalización → validaciones → base o JSON → API/caché → pantalla**. Algunos catálogos oficiales se integran desde JSON y no son filas nuevas en Supabase. Un fallo debe conservar el último dato válido e informar el error; un respaldo no prueba actualidad.

Dos copias conocidas en esta máquina (verificar estado, no asumir actualidad):

- `C:/Users/PC/rugbynow/RugbyNOW`: original con cambios previos del dueño.
- `C:/Users/PC/Documents/ChatGPT/Pagina web de rugby/RugbyNow`: utilizada para publicaciones recientes.

Una rama con cambios o un PR abierto no equivale a `main` ni a producción. No trasladar secretos entre copias/worktrees.

## Mapa de trabajo y pruebas existentes

| Área | Entrada principal | Pruebas/guía que conviene consultar |
| --- | --- | --- |
| Agenda, fechas y actualización | `app/agenda/DailyAgendaClient.tsx`, `lib/dailyAgenda.ts`, `lib/dailyAgendaServer.ts`, `pages/api/agenda.ts` | `tests/dailyAgenda.test.ts`, `tests/agenda.test.ts`, `tests/competitionCalendar.test.ts` |
| Torneos, tablas y fases | `app/leagues/[slug]/CompactLeagueClient.tsx`, `pages/api/leagues/[slug].ts`, `lib/standingsOverlay.ts`, `lib/officialStandings.ts` | `tests/standingsSources.test.ts`, `tests/worldAudit.test.ts` |
| Fechas e identidades de fuente | `lib/scrapedMatchDate.ts`, `lib/sourceTeamIdentity.ts`, `lib/proD2.ts` | `tests/scrapedMatchDate.test.ts`, `tests/sourceTeamIdentity.test.ts`, `tests/proD2.test.ts`, `tests/sourceRound.test.ts` |
| Vivo y concurrencia | `lib/liveRefresh.ts`, `lib/conditionalMatchWrite.ts`, `scripts/sync-live-runner.ts`, `lib/lnrLiveMonitor.ts` | [LIVE-RELIABILITY](LIVE-RELIABILITY.md), `tests/liveRefresh.test.ts`, `tests/coverageContinuation.test.ts` |
| Calendarios oficiales | `lib/proD2CalendarData.ts`, `lib/urbaCalendarData.ts`, `lib/worldCup2027.ts` | `tests/coverageContinuation.test.ts`, `tests/worldAudit.test.ts` |
| Equipos, planteles y staff | `app/teams/[slug]/TeamClient.tsx`, `lib/squads.ts`, `lib/teamSquads.ts`, `lib/clubInformation.ts`, `app/components/TeamSquads.tsx`, `app/players/` | `tests/coverageContinuation.test.ts`, `tests/worldAudit.test.ts` |
| Noticias y movimientos | `lib/news.ts`, `lib/newsServer.ts`, `app/news/NewsClient.tsx`, `lib/playerUpdates.ts` | `tests/news.test.ts`, `tests/coverageContinuation.test.ts` |
| TV exacta | `lib/matchBroadcasts.ts`, `lib/broadcasts.ts`, `data/match-broadcasts.json`, `app/components/MatchBroadcastLink.tsx` | `tests/matchBroadcasts.test.ts`, `tests/providerPolicy.test.ts` |
| Escudos y fotos | `lib/assets.ts`, `data/visual-assets.json`, `public/` | [VISUAL-ASSETS](VISUAL-ASSETS.md), `tests/visualAssets.test.ts` |
| Historial y disciplina | `lib/headToHead.ts`, `lib/headToHeadServer.ts`, `lib/teamDiscipline.ts` | `tests/headToHead.test.ts`, `tests/worldAudit.test.ts` |
| Preferencias y navegación | `app/components/SiteHeader.tsx`, `app/settings/AppearanceSettings.tsx`, `lib/usePrefs.ts`, `lib/usePersonalization.ts` | Comprobar persistencia, temas, idiomas y móvil en el navegador |
| Monetización y SEO | `app/components/AdvertisingPlacement.tsx`, `lib/advertising.ts`, `lib/analytics.ts`, `lib/seo.ts`, `app/robots.ts` | Medición y publicación se verifican por separado; sin clics artificiales en anuncios |
| Respaldo y fuentes | `scripts/export-supabase-snapshot.ts`, `lib/readAllRows.ts`, `lib/supabaseSnapshot.ts` | `tests/readAllRows.test.ts`, [proveedores](PROVIDERS-AND-PERSONALIZATION.md) |

## Importadores y automatización

El flujo principal es `.github/workflows/sync-scores.yml`. Reutiliza `sync:matches` y, en su trabajo `snapshot`, los comandos `sync:official-standings`, `sync:pro-d2-calendar`, `sync:urba-calendar`, `sync:top14-calendar`, `sync:squads`, `sync:club-information`, `sync:news`, `sync:broadcasts` y `export:supabase-snapshot`. Fuente de verdad de comandos: `package.json`; del orden y condiciones: el YAML. No ejecutar importadores de escritura para validar una edición documental.

`data/team-staff.json` y `data/player-updates.json` contienen información fechada; no afirmar que disponen de un recolector automático solo porque se muestran en las fichas. La ampliación de su actualización es un pedido pendiente.

El bot actual publica archivos de datos en `main`; código y cambios de infraestructura requieren el proceso de revisión del dueño. [AGENTS](../AGENTS.md) define permisos, verificación y cierre de tareas. `sync-live.yml` y el monitor Cloudflare son recorridos separados; los trabajos antiguos de reloj/finalización no se deben reactivar.

Consultar ejecuciones/artefactos reales, condiciones y variables de activación sin imprimir sus valores secretos. Un cron configurado no garantiza hora de ejecución. La existencia de una skill no crea un scheduler. La revisión semanal solicitada para Codex es distinta del refresco rutinario de datos y no quedó activada por escribir estas instrucciones.

## Reglas de datos y lecciones duraderas

| Causa comprobada / riesgo del dominio | Regla que conservar | Regresión/evidencia |
| --- | --- | --- |
| Fuente con `Current`, fecha sin año o primer número ambiguo | Exigir edición y fecha explícitas; no derivar año/round de hoy, un día o un marcador | `tests/scrapedMatchDate.test.ts`, `tests/sourceRound.test.ts` |
| Lions confundido con Old Lions; Universitarios ambiguos | Slug/ID y alias exactos en país/competición; no substring. XV/seven y juveniles conservan su categoría | `tests/sourceTeamIdentity.test.ts`, `tests/headToHead.test.ts`, `tests/worldAudit.test.ts` |
| Hora desconocida fusionó regular y playoff de fechas distintas | Sin hora, deduplicar solo en el mismo día; conservar encuentros y IDs distintos | `tests/coverageContinuation.test.ts` |
| Tablas parciales, playoffs abiertos o IDs convergentes | Validar todos los participantes después de resolver IDs; separar temporada/fase/grupo. No recalcular bonus, sanciones o desempates con una fórmula universal; conservar null para PF/PC ausentes | `tests/standingsSources.test.ts`, `tests/worldAudit.test.ts` |
| Lecturas de Supabase limitadas a 1000 | Paginar con orden estable; fallar antes de escribir/exportar un respaldo parcial | `tests/readAllRows.test.ts` |
| Hora de comienzo usada como supuesto estado | Solo la fuente confirma LIVE/HT/FT, minuto, suspensión o prórroga. No simular reloj ni finales; UTC almacenado y zona elegida al mostrar | `tests/liveRefresh.test.ts`, `tests/dailyAgenda.test.ts` |
| Lectura antigua puede pisar una corrección nueva | Comparar observación en la escritura y recepción en pantalla; preservar último dato válido ante fallo | `tests/worldAudit.test.ts`, `tests/liveRefresh.test.ts` |
| Nombres de plataformas sin derechos por encuentro | Exigir equipos, competición/edición, comienzo y territorio de la fuente; distinguir evento, canal, plataforma, directorio externo y guía editorial fechada | `tests/matchBroadcasts.test.ts`, `tests/providerPolicy.test.ts` |
| Grilla de Horacio/Norte Rugby usada fuera de su ventana | Es una referencia argentina fechada, no un feed recurrente ni derechos globales. No trasladar sus señales a otra semana | `tests/agenda.test.ts`, `tests/dailyAgenda.test.ts` |
| Plantilla/directorio confundidos; ID nacional compartido | Edición explícita para plantel; distinguir directorio, convocatoria y formación. Lesiones/movimientos con fuente/fecha, sin diagnóstico, recuperación o confirmación inventados | `tests/coverageContinuation.test.ts`, `tests/worldAudit.test.ts` |
| Recurso local registrado no prueba su carga real | Verificar ruta/case, identidad, inventario, HTML inicial y navegador. Reutilizar assets y conservar procedencia | `tests/visualAssets.test.ts`, [VISUAL-ASSETS](VISUAL-ASSETS.md) |
| Importación guardó datos pero falló el commit posterior | Verificar importación, escritura, exportación y publicación como etapas distintas antes de repetir operaciones | [RECOVERY](RECOVERY.md) |

Para convertir otra corrección en memoria, seguir el procedimiento de [AGENTS](../AGENTS.md#memoria-basada-en-correcciones); no duplicar instrucciones aquí y en la skill.

## Límites que no deben presentarse como resueltos

- El origen productivo de marcadores usa Flashscore. API-Sports es un adaptador de evaluación sin cobertura/credenciales/conmutación verificadas en la entrega documentada. No hay independencia del scraping demostrada.
- Una consulta de pantalla cada 15 s, un job exitoso y un latido `idle` del monitor son evidencias diferentes. Vivo real y latencia extremo a extremo siguen pendientes según [LIVE-RELIABILITY](LIVE-RELIABILITY.md#criterio-de-aceptación-antes-de-llamarlo-vivo-confiable).
- No hay cobertura mundial completa, todas las plantillas argentinas, playoffs completos ni garantía de ingresos. Las cifras comprobadas pertenecen a una edición y una consulta fechadas en CONTINUATION.
- La cobertura del catálogo no abarca todos los clubes editoriales; las ausencias de escudos verificadas se documentan en VISUAL-ASSETS.

## Mantenimiento de esta memoria

Producto/reglas en este archivo; procedimientos especializados en su guía; estado temporal en CONTINUATION; incidentes fechados en RECOVERY. Conservar una sola versión de cada instrucción, enlaces a pruebas y evidencia suficiente. No guardar secretos, transcripciones ni supuestos como hechos. La documentación mantiene continuidad entre sesiones, no entrena el modelo ni amplía permisos.
