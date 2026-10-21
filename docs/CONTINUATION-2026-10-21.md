# Continuación de RugbyNOW — 21/10/2026 UTC

## Base y alcance

Base main 50f8bd9, original eff631a con cambios del dueño preservada. Rama `codex/coverage-live-continuation`. Se retoman los cinco pendientes del dueño. Sin reparaciones masivas en Supabase ni traslado de entornos.

## Datos incorporados

| Cobertura | Fuente / evidencia | Alcance |
| --- | --- | --- |
| URBA Top 14 2026 | https://urba.org.ar/fixture?id=2025176&view=results y endpoint público usado por su cliente | 26 jornadas / 182 resultados, 70 antes ausentes; coherencia exacta con PJ/G/E/P/PF/PC. Dos cruces posteriores conservados. |
| Top 14 Francia 2026/27 | https://top14.lnr.fr/calendrier-et-resultats/2026-2027/j1 hasta j26 | 182 regular, 63 días confirmados, 119 pendientes. No playoffs inventados. |
| Tablas existentes | URBA, LNR y EPCR originales refrescados | 86 filas; no se amplía esta cifra como si hubiera nuevas tablas. |
| Planteles 2026/27 | Páginas `/effectif-staff` de 30 clubes Pro D2 / Top 14, edición en meta description conservada como seasonEvidence | 1.590 jugadores distintos, IDs LNR estables, posición y país de la fuente; no disponibilidad inferida. |
| Estadios | Páginas `/informations` de los mismos 30 clubes | Nombre/capacidad/dirección cuando publicada. No inferir ciudad ni domicilio personal. |
| Cuerpo técnico | https://www.provencerugby.com/lequipe-pro/ | Cinco cargos deportivos de Provence, consultados 21/10. Los Pumas XV añade Contepomi y las incorporaciones anunciadas de Ledesma/Edwards del comunicado UAR 9/10: https://uar.com.ar/mario-ledesma-y-shaun-edwards-se-suman-al-cuerpo-tecnico-de-los-pumas/ . No se presentan los anuncios como funciones ya iniciadas ni se muestran en Seven. |
| Disponibilidad | https://www.stadetoulousain.fr/actualite/equipe-pro/119299-st-exeter-le-point-infirmerie | Parte 16/10, nueve registros fechados; web abierta en navegador porque el fetch de investigación respondió 403. No eludir controles. |
| Préstamo | https://www.provencerugby.com/nadir-bouhedjeur-prete-a-soyaux-angouleme/ | Nadir Bouhedjeur, 16/9, inmediato hasta fin de temporada; fuente compartida en ambos clubes. |

## Corrección adicional encontrada

La deduplicación consideraba cualquier hora desconocida suficiente para juntar partidos de los mismos clubes en días distintos. Se reprodujo con URBA: desaparecía un resultado regular ante un playoff posterior. Ahora la ausencia de hora solo permite comparar el mismo día. El respaldo público debe devolver 184 encuentros URBA con sus dos cruces posteriores.

Se agregan siete transmisiones francesas oficiales del Top 14; aliases exactos, logo CANAL+ de LNR y URL del catálogo de rugby. No se trasladan señales a otros países ni fechas.

## Vivo

Persisten intervalos de horas en GitHub. Nuevo monitor Cloudflare por minuto en modo observación, sin escribir resultados. Ver LIVE-RELIABILITY.md. API de agenda real sin activos al revisar; no se puede acreditar retraso con un partido en curso.

## Verificación

81 pruebas y TypeScript correctos. Los builds Next/OpenNext pasaron durante la implementación; se recompila el estado final antes de publicación. Revisión interactiva local a 390 y 1440 px: navegación a marzo URBA y ficha de resultado recuperado, 14 filas de tabla, Top 14/fechas pendientes/ficha sin hora inventada, Provence/estadio/staff/59 jugadores y acceso a jugador con temporada explícita. Sin desborde de página ni errores de consola observados. Prueba de runtime local con Wrangler/workerd: `/__scheduled` 200 y `/api/live-monitor` 200, `shadow`, `writesResults=false`, `idle`, `delayed=false` a 00:37:14 UTC. No se confunde esa ejecución local con el cron productivo. Dieciocho rutas del build respondieron HTTP 200; es una comprobación aparte de la revisión interactiva. Bundle Wrangler dry-run válido, sin autenticación ni cambio de secretos. El monitor no debe llamarse operativo hasta recibir informes públicos.

## Pendientes que no se ocultan

Vivo real y promoción controlada del recolector; calendarios completos y tablas oficiales de los torneos restantes; planteles/staff fuera de Francia; ampliar disponibilidad/movimientos con fuentes nuevas. Los playoffs de URBA y Francia no quedan completos por completar la fase regular. No hay cuenta sincronizada ni ingresos garantizados.
