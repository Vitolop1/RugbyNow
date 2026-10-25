# Auditoría de vivo y próxima actualización

Fecha: 20/10/2026. Implementación revisada en [PR #14](https://github.com/Vitolop1/RugbyNow/pull/14). La publicación se verifica aparte de la salud del origen.

## Lo que se comprobó

- A las 05:18 UTC, `/api/agenda?date=2026-10-20` respondió desde la base de datos y no contenía estados LIVE/HT. No se observó un marcador real cambiando durante esta revisión.
- GitHub devolvió el workflow `sync-live.yml` como `active`, pero la prueba manual 39359653728 seguía `queued` desde las 02:34 UTC, sin jobs asignados. La ejecución programada más reciente devuelta era del 04/06/2026. Esto NO demuestra servicio de vivo operativo. Los últimos imports generales manuales sí habían terminado correctamente.
- La agenda consulta cada 15 s con LIVE/HT y cada 60 s sin ellos. El origen se programa cada 5 minutos y puede acumular demora. `checkedAt` significa consulta de la base, no actualización de la fuente; `updated_at` corresponde a la escritura del importador, no al instante del try en el estadio.
- El importador de vivo solo abría `/live`. Un encuentro que desaparece de esa vista al terminar podía quedar sin final hasta la importación general. Ahora consulta también `/results`, con actualización restringida a encuentros ya identificados dentro de la ventana activa; no reimporta todo el archivo histórico en cada pasada.
- Existían dos ventanas de selección distintas (130/180 min). Ahora comparten la misma función, sin asumir medianoche si no hay hora de inicio y sin convertir un comienzo pasado en LIVE.

## Mejoras incluidas

- Navegación de cuatro destinos, configuración mediante icono y menú secundario. Sin desplazamiento horizontal en la cabecera; desafío de agenda vacío reducido a un enlace discreto. Pelota compartida de paneles rojo/azul/blanco, giro plano sin aplastamiento 3D y movimiento reducido respetado.
- Consultas de agenda en serie, con lectura al volver a la pestaña. Una respuesta/respaldo más antiguo no reemplaza una lectura más reciente del mismo encuentro. Una corrección nueva sí puede bajar el marcador.
- La ficha LIVE/HT informa cuándo se recibió el marcador y señala datos demorados. No avanza minutos artificialmente y conserva el último dato ante errores.
- El runner espera el proceso real, conserva informes por fuente y verifica que los encuentros previamente LIVE/HT hayan recibido una escritura reciente durante la ejecución. Un proceso vacío no se presenta como una validación del origen. `idle` significa sin candidatos; `validated_sources` significa lectura sin escritura; `completed` no prueba por sí mismo latencia respecto del estadio. Una importación general concurrente también puede actualizar el timestamp, por lo que este control mide frescura en base y no atribución exclusiva a una pasada.
- Artefacto de GitHub `live-source-health`, retención 14 días, con `run.json` y reportes por fuente. Un fallo de fuente/cobertura deja fallo de ejecución; los artefactos no son un sistema de alertas independiente ni detectan un trabajo que nunca arrancó.
- Programación de vivo movida a minutos 2,7,12… para evitar el inicio de la hora. Esto reduce una causa posible de cola; no convierte GitHub Actions en un servicio en tiempo real.

## Actualización recomendada, todavía no activada

1. Validar un proveedor estructurado autorizado para los torneos prioritarios: Pro D2, Top 14, URBA, selecciones y Super Rugby. API-Sports es un candidato porque su catálogo incluye Pro D2 y ya existe un adaptador de lectura; el catálogo no garantiza livescore, edición actual, rapidez, formaciones ni cobertura de cada partido. No hay una clave de evaluación configurada/comprobada en esta revisión. No se contrató ningún plan.
2. Separar un actualizador ligero del sitio y de los imports generales. Primera versión: Worker de Cloudflare una vez por minuto durante la ventana de encuentros, con límites de llamadas, timeout, reintentos acotados y exclusión de pasadas simultáneas. El objetivo de recepción de 30–60 s depende de la frecuencia real de la fuente; si se necesita menos de un minuto, usar un proceso continuo o una arquitectura de alarmas, no afirmar que un cron de un minuto lo hace.
3. Mapear IDs de proveedor, edición y equipos a IDs existentes antes de escribir. Actualizar atómicamente por versión/instante de observación para que una lectura anterior no pise una nueva. El frontend ya rechaza respaldos anteriores, pero eso no reemplaza el control de concurrencia en base ni una migración del importador general.
4. Mantener el último marcador confirmado. Si pasan dos minutos sin recepción con la nueva fuente, mostrar demora y disparar aviso operativo desde un monitor independiente del actualizador. Fuente secundaria solo con equivalencias verificadas y trazabilidad; no mezclar campos de dos fuentes ni inventar minutos/finales.
5. Dejar GitHub Actions para calendario, tablas, noticias y respaldos; no depender de él para latencia de segundos.

## Criterio de aceptación antes de llamarlo vivo confiable

Observar al menos tres partidos reales, en más de una competición prioritaria, comparando hora de cambio en origen, recepción, escritura y pantalla. Incluir 0–0, cambio de tanteador, entretiempo y final; medir p50/p95 y máximos. Probar corrección de tanteador y respuestas desordenadas mediante replay aislado, sin escribir datos inventados en producción. Simular timeout, 429, caída de fuente y ausencia de scheduler: conservar marcador, etiquetar demora, emitir aviso y recuperarse sin duplicados. Validar también el final después de desaparecer de `/live`.

Las pruebas de parser/reconciliación pasan de forma aislada; no sustituyen observar un partido real ni garantizan disponibilidad permanente.

## Fuentes oficiales consultadas

- GitHub: intervalo mínimo 5 minutos y posibles demoras: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax y https://docs.github.com/en/actions/how-tos/troubleshoot-workflows
- Cloudflare: cron con resolución de minutos: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- API-Sports: catálogo de rugby y plan PRO publicado de 7.500 solicitudes/día a 15,00 en la modalidad mensual visible: https://api-sports.io/sports/rugby . Confirmar moneda, impuestos, condiciones y cobertura efectiva al contratar; no usar la frecuencia publicitaria general como garantía específica de rugby.

## Verificación de esta entrega

59 pruebas pasan; TypeScript, build Next y empaquetado OpenNext completos. Revisión interactiva a 1440 px y a 390/320 px: cabecera sin desbordamiento, menú/Escape, idiomas con banderas y acceso a configuración; francés comprobado a 320 px. Pelota del banner y estado vacío revisados en escritorio. La fuente /results de Pro D2 mostraba 56 encuentros reales, sin observar un encuentro en curso.

[Prueba de vivo 39375484676](https://github.com/Vitolop1/RugbyNow/actions/runs/39375484676) terminada con éxito. Su artefacto live-source-health contiene status=idle, dryRun=true, candidates=0, entre 05:33:48.264 y 05:33:48.996 UTC: verifica la consulta/selección y el informe, no el scraping de un vivo ni escrituras. La prueba antigua 39359653728 devolvía queued pero GitHub rechazó cancel y force-cancel con HTTP 409; no afirmar que fue cancelada. Esto no impidió ejecutar la nueva prueba.

Los checks de aplicación y Cloudflare de 442a3db terminaron con success. Estos checks y el informe idle no son una medición del retraso de un marcador en producción. La cadencia programada y una actualización real deben observarse después de la publicación, según el criterio de aceptación anterior.


## Auditoría ampliada — 20/10/2026

Run programado 39407746051: informe 10:25:35.810–10:25:36.961 UTC, status=idle, candidates=0, dryRun=false. General 39412099072: 11:02–11:09 UTC, 18 informes; Pro D2 168 encuentros y URBA 114. Se observaron intervalos superiores a los cinco minutos nominales. Estas ejecuciones no validan latencia de un partido real.

`conditionalMatchWrite.ts` aplica updated_at <= observedAt (o null) en el UPDATE y bloquea vuelta de FT a estados no finales. Scores activos/finales requieren enteros >=0; una suspensión sin marcador conserva el último marcador. POSTP, DELAY, SUSP, abandono, W/O, adjudicado, ET/AET y penales se guardan como calificador en source_url junto con los metadatos de fase existentes. No requieren ampliar la restricción instalada de estados. Pruebas controladas verifican filtros de escritura, ceros y preservación de calificadores; no sustituyen una escritura observada en producción.

Consulta de pantalla, ejecución del job, observación de proveedor y edad del dato siguen siendo tiempos diferentes. Pendiente: encuentro real con varias lecturas consecutivas fuente → base/API → pantalla, error/reintento real y medición de demora. Continúa la dependencia del scraping; no se activó una API paga ni un segundo proveedor automático.

Publicación PR16 d14fa07 y comprobación pública completadas. Refresh 39481169649 comprobó 16 filas de Pro D2 en modo standings_only, fuentes oficiales y snapshot, sin actualización de partidos reportada. No es evidencia de un marcador en vivo. DATA_SYNC_ENABLED y LIVE_SYNC_ENABLED=true; trabajos clock/finish antiguos permanecen deshabilitados.

Nueva ejecución automática observada después de publicar: 39481862468, schedule creado 19:15:14 UTC; informe 19:16:04.907–19:16:05.366 UTC, dryRun=false, idle, candidates=0. Las dos últimas ejecuciones schedule devueltas por GitHub fueron 15:12:59 y 19:15:14 UTC: este intervalo observado supera cuatro horas. No considerar GitHub Actions un reloj confiable de cinco minutos. Hace falta un recolector independiente con fuente estructurada validada y medir un partido real; no se contrató ni activó una API nueva.

## Monitor independiente de observación — 21/10/2026 UTC

Las ejecuciones `schedule` 39481862468 (19:15:14 UTC) y 39507171133 (22:18:47 UTC) siguen separadas por más de tres horas. API pública consultada a 00:08 UTC del 21/10: ningún partido LIVE/HT. No se validó demora de un resultado real.

`custom-worker.ts` conserva el fetch/exportaciones de OpenNext y agrega cron de un minuto. `lnrLiveMonitor.ts` guarda el latido en el R2 existente y consulta solo ventanas con hora/día oficial; no altera estados por esa ventana. `lnrLiveObservation.ts` valida dominio, temporada, ronda completa e identidades, acepta solamente `not-started`, `live`, `finished` del payload público LNR. NS conserva marcadores nulos; no se copia el reloj de su cliente (que calcula minutos a partir de timestamps). Un fallo de fuente reintenta una vez y conserva el último archivo válido. El latido informa fallo, cantidad de lecturas y cantidad de activos, separado del último payload válido.

Modo inicial **shadow / writesResults=false**. No es un reemplazo ya validado del importador Flashscore: las observaciones no alimentan Supabase ni la pantalla. Sirve para comprobar frecuencia y contrastar el proveedor oficial sin contaminar marcadores. La siguiente aceptación requiere observar tres encuentros reales, comparar fuente/API/pantalla y medir transiciones, retrasos y final antes de activar escrituras. La activación de Cloudflare se comprueba por los informes públicos posteriores al despliegue, no por el YAML/config local. No se copiaron claves ni contrataron servicios.

Fuentes de implementación: https://opennext.js.org/cloudflare/howtos/custom-worker y https://developers.cloudflare.com/workers/configuration/cron-triggers/ . No se modifica el cron viejo ni se reactivan los finalizadores sintéticos.

Comprobación productiva posterior a PR19: `/api/live-monitor` devolvió informes con `scheduledAt` 2026-10-21T05:25:23.754Z, 05:27:23.754Z y 05:28:23.754Z, recibidos aproximadamente 0,65 s después. Las dos últimas ejecuciones observadas están separadas por 60 s. Todas fueron `idle`, `sources=[]`, `writesResults=false`, sin retraso del latido: confirma ejecución real del cron, no lectura de un marcador ni latencia fuente/base/pantalla. El importador productivo sigue siendo Flashscore/GitHub y su irregularidad no queda resuelta por este monitor. No se observó un partido real LIVE/HT en esta etapa.

## LIVE 2.0 — correcciones preparadas el 21/10/2026

Rama `codex/live-reliability-v2`, base `84b1b19`. Esta sección describe un PR para revisión, **no una publicación**. Se preservaron el checkout original con cambios del dueño, la rama de transmisiones y los PR abiertos de SEO/interfaz/memoria. No hubo escrituras en Supabase, cambios de secretos ni activación de un segundo proveedor.

### Fallos comprobados

- [Ejecución 39645508948](https://github.com/Vitolop1/RugbyNow/actions/runs/39645508948): SRA leyó cero filas entre 17:39:21.698 y 17:39:50.370 UTC, salió con error y conservó la tabla anterior. URC, en el mismo grupo, obtuvo 16 filas. Los otros tres grupos pasaron. El `needs.sync_scores.result == 'success'` del snapshot omitió todas sus tareas independientes al fallar el grupo 3.
- La página SRA volvió a mostrar ocho filas en el navegador y el importador sin escrituras. Los selectores siguen funcionando. **No se reprodujo la causa exacta de la respuesta vacía**; no se atribuye a un cambio de HTML probado. Se observó que Main ya estaba seleccionado (`aria-current=page`); el importador antes lo pulsaba igualmente. Ahora evita esa navegación innecesaria y hace, como máximo, una segunda carga completa ante tabla vacía. Una edición incorrecta o una tabla parcial sigue siendo rechazada, sin reemplazo.
- El vivo programado sigue separado por horas: ejecuciones creadas el 21/10 a 05:17:58, 10:15:45 y 15:17:26 UTC, frente a cinco minutos nominales. Fueron iniciadas sin una cola larga después de crearse: el intervalo observado no prueba que todas las invocaciones omitidas estuvieran en cola. El artefacto de [39624271781](https://github.com/Vitolop1/RugbyNow/actions/runs/39624271781) contiene `idle`, cero candidatos, 15:18:14.140–15:18:14.799 UTC; no consultó fuentes deportivas.
- Por código, el runner de vivo abandonaba toda consulta cuando Supabase no contenía candidatos. El descubrimiento general existía en `sync-scores`, pero el runner de vivo no podía encontrar por sí mismo un próximo encuentro ausente.

### Flujo y cambios implementados

1. **Descubrimiento:** el runner reutiliza `sync-matches`/`sync-flashscore` con `DISCOVERY_ONLY=1`, después de la pasada urgente de vivo. Selecciona una competición configurada por pasada, con rotación determinista por intervalo de cinco minutos, y lee únicamente su primera página de fixtures, sin expandir archivos históricos. No garantiza una vuelta completa si GitHub omite ejecuciones; el importador general conserva su cobertura más amplia.
2. Solo admite NS con ID de evento de origen, edición identificada, fecha explícita entre hoy UTC y los siguientes 14 días, y ambos equipos ya resueltos y vinculados a esa competición/temporada en los registros existentes. No crea clubes por nombre, ni participantes desconocidos, ni modifica encuentros existentes o próximos con identidad coincidente. Usa las claves/deduplicación existentes para insertar; un conflicto concurrente puede producir un fallo visible, nunca se reintenta como escritura ciega. Un club no identificado deja error y listado para revisión. Una edición sin participantes previamente identificados requiere revisión de su integración antes de este descubrimiento automático.
3. **Seguimiento:** LIVE/HT e inminentes conocidos continúan por `/live` y `/results`; la hora programada solo selecciona consultas. `conditionalMatchWrite` conserva sus condiciones atómicas de observación reciente y FT. No se inventan minutos ni finales. Una URL fallida deja la pasada parcial aunque otra URL aporte filas válidas.
4. **Recuperación:** navegación de origen con timeout de 30 s y hasta dos intentos. Se reintentan errores de red, 429 y 5xx con espera acotada; 401/403/404 no se rodean. Un `Retry-After` superior a cinco segundos detiene el reintento inmediato y se deja para otra ejecución. Tablas vacías permiten una recarga, no una sustitución vacía. Cada subproceso tiene límite de 120 s para vivo/descubrimiento y 240 s para importación general; los demás feeds pueden continuar tras su fallo.
5. **Snapshot:** solo en main y en las ocasiones que ya exportaban, continúa si el matrix terminó success o failure, pero no si prepare falló o el matrix fue cancelado/omitido. El exportador paginado completo sigue siendo obligatorio antes del commit. El job fallido mantiene el workflow rojo. El artefacto `source-import-summary` y el resumen de Actions distinguen fuentes correctas, fallidas y sin informe, escrituras reportadas, exportación y paso de commit/push; no afirman despliegue. No se ejecutó esta modificación en producción.
6. **Cloudflare:** sigue `shadow`, `writesResults=false`, sin conexión nueva a Supabase. Informa intentos, HTTP, duración de recolección (incluye esperas/reintentos), Age de caché, observación válida anterior, datos conservados, IDs nuevos/cambios y encuentros todavía sin reconciliar con la base. Rechaza un mismo ID que cambie equipos/edición y una regresión FT. Conserva el payload previo si falla la fuente. Un timestamp inválido del latido ahora indica demora. `sourceUpdatedAt` y latencia fuente→base permanecen null porque no están medidos.

### Evidencia de lectura y pruebas

| Comprobación | Resultado real | Límite |
| --- | --- | --- |
| SRA standings dry-run, 18:00 UTC | Ocho filas completas; Dogos XV 61, Pampas XV 54; código de salida 0 | Lectura sin escrituras; el fallo original no se reprodujo |
| Pro D2 discovery dry-run, 18:15:20 UTC | 112 filas de origen, 16 encuentros elegibles en 14 días, identidades del catálogo y edición versionados | No son 16 altas nuevas comprobadas: dry-run no compara con la base actual |
| LNR oficial, 18:09:13.902 / 18:09:14.920 UTC | Ocho Pro D2 y siete Top 14, IDs/equipos/edición validados, todos NS y minuto null | Duraciones de recolección 956 / 1.017 ms; no latencia de un tanteador |
| Monitor público, 18:09:23.754 / 18:10:23.754 UTC | Dos latidos separados por 60 s, idle, sin fuentes activas, sin demora | Código productivo anterior; no lectura deportiva ni garantía continua |
| Worker local/workerd, 18:08:42 UTC | Sin latido: delayed=true; ejecución `/__scheduled` 200; lectura posterior shadow/idle/0 escrituras, delayed=false | R2 local, no escritura remota |
| Artefactos originales reproducidos en el nuevo resumen | SRA failed, URC success, estado degraded | Ensayo local del informe; no ejecución productiva del workflow modificado |
| Controles técnicos | 89 pruebas, TypeScript, Next, OpenNext, YAML y bundle Wrangler dry-run correctos | Sin merge ni deploy; compatibilidad local de workerd retrocede un día respecto de wrangler.jsonc con la versión instalada |

Las pruebas incluyen vacío transitorio/persistente, backoff/429/restricciones, rotación sin candidatos, fechas/año/horizonte, deduplicación del plan, fallos parciales/artefactos faltantes, error y recuperación del monitor, caché vieja, identidad, FT y correcciones. Se mantienen los replays existentes de 0–0, HT/FT, respuestas antiguas y condiciones de escritura. No hubo revisión visual nueva: no se cambió la interfaz. La API de agenda conserva `no-store`, `checkedAt` de consulta y `updated_at` de recepción de origen; no se renombra una consulta como frescura deportiva.

### Proveedores y siguientes puertas de validación

- **Flashscore:** lectura comprobada de tabla SRA y próximos Pro D2, no marcador cambiando. No se amplió la cobertura verificada a todas las competiciones configuradas. Una página de fixtures vacía sigue como fuente no verificada; todavía no se distingue automáticamente fin de temporada de una respuesta vacía defectuosa.
- **LNR:** payload público estructurado y parser comprobados con las dos competiciones francesas. La raíz publica la jornada seleccionada por LNR; falta comprobar durante encuentros que esa selección incluye todos los activos esperados, sus transiciones y retrasos. El payload aceptado no distingue HT; no se deduce del reloj del navegador. Falta reconciliación exacta ID LNR↔partido/temporada de Supabase antes de escribir.
- **API-Sports:** [catálogo y precios](https://api-sports.io/sports/rugby) consultados el 21/10: Pro D2, Top 14, Premiership y URC listados; Top 12 argentino y nomenclaturas históricas no prueban cobertura URBA/SRA actual. Free anuncia 100 solicitudes/día; PRO 7.500/día, precio mensual visible 15,00 (confirmar moneda/impuestos al evaluar contratación). Un seguimiento cada minuto durante dos horas ya supera el cupo gratuito si requiere una consulta por minuto. No se encontró `API_SPORTS_KEY` configurada en el entorno ni en los archivos de entorno de las dos copias conocidas. Sin clave no se comprobaron catálogo API, temporadas, partidos reales, estados ni cadencia; el adaptador continúa desactivado. No se contrató nada.

**Pendiente antes de promoción:** observar tres partidos reales de más de una competición con el criterio anterior; medir cambio de fuente, recepción, escritura, API y pantalla por separado; obtener p50/p95/máximo y porcentaje de éxito. Hoy no existe una medida válida de demora de marcador y no se resolvió la cadencia de GitHub. Preparar después el writer LNR con mapa de identidades, bloqueo/exclusión entre recolectores, trazabilidad persistida y pruebas de corrección/desorden/caídas. Requiere revisión de esa evidencia y aprobación del dueño. Este PR no implementa ni habilita ese writer, alertas externas o un failover automático. El endpoint público permite detectar un cron ausente al consultarlo; no hay un vigilante externo que notifique su ausencia.

Para operar tras aprobar el PR: revisar artefactos `live-source-health` (subdirectorios sources/discovery y run.json) y `source-import-summary` del workflow general; contrastar con `/api/live-monitor`. Reintentar solo la fuente fallida después de revisar el informe, no repetir escrituras ya confirmadas porque falló exportación o publicación. Una importación parcialmente fallida puede haber escrito otros registros válidos.
