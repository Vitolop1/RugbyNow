# Continuación de RugbyNOW — 21/10/2026 UTC

## Agenda completa al entrar — preparado para revisión

Rama `codex/agenda-first-home`, base `84b1b19`; sin merge ni despliegue. El sitio público ya usa el mismo componente en `/` y `/agenda`: comparación interactiva del 17/10 devuelve los mismos 40 IDs, sin límite de vista previa. La jerarquía mostraba publicidad y dos destacados antes de fechas/listado. En el día actual no había partidos cargados; “Ver agenda” cambiaba a una fecha futura y omitía de las sugerencias los dos destacados, por lo que podía saltarse el próximo día disponible.

Se conserva la implementación compartida. Título compacto, barra de fechas con Hoy y controles de 44 px, agenda completa primero; sugerencias solo en el estado vacío, luego Destacados contraído y la misma unidad publicitaria horizontal. Rail conservado. El acceso a próximos indica la fecha y no excluye encuentros destacados. Hoy sigue la zona elegida y el cambio de día; una fecha explícita/manual permanece fija. No se modificaron resultados, importadores, fuentes, IDs publicitarios, Analytics ni el algoritmo editorial pendiente del PR21.

Verificación: 84 pruebas, TypeScript y build Next correctos. HTTP del build: ambos recorridos contienen 40 encuentros en el HTML inicial, títulos distintos y canonical `/`; `/agenda` sale del sitemap para listar la URL canónica sin romper la ruta. Navegador real: portada pública directa, paridad de rutas y comparación local; flechas, Hoy, búsqueda/favoritos y recarga; selección de fecha por teclado, 29/2/2028→1/3; Hoy en Auckland pasa al día 22 mientras Argentina está en 21, y una fecha manual no cambia al elegir otra zona. ES/EN/FR/IT conservados. Destacados permanece abierto al refrescar y comienza cerrado al entrar. Cuarenta filas en móvil y escritorio; sin desbordamiento a 375 y 305 px CSS (francés en la segunda), controles de 44 px, cero imágenes rotas observadas y sin errores/warnings de consola en la navegación local revisada. Capturas y evidencia SSR fuera del repo, en `research/agenda-home-2026-10-21/`.

Límites: local usa el respaldo versionado sin copiar secretos; no valida una escritura LIVE ni entrega real de anuncios. Se comprueba orden de unidades después del listado y se conservan sus identificadores; no se afirma fill/ingresos. La nueva jerarquía no está publicada y requiere aprobar el PR. Los PR21/22 de Destacados/fechas siguen abiertos: esta corrección comparte archivos con ellos y reutiliza los mismos helpers previstos de `agendaNavigation`, sin fusionar ramas; revisar esos solapamientos al integrar. Los pendientes de datos y vivo pertenecen a sus PR separados.

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

81 pruebas y TypeScript correctos. Los builds Next/OpenNext pasaron y los checks Application y Workers del estado final y del merge terminaron con éxito. Revisión interactiva local a 390 y 1440 px: navegación a marzo URBA y ficha de resultado recuperado, 14 filas de tabla, Top 14/fechas pendientes/ficha sin hora inventada, Provence/estadio/staff/59 jugadores y acceso a jugador con temporada explícita. Sin desborde de página ni errores de consola observados. Prueba de runtime local con Wrangler/workerd: `/__scheduled` 200 y `/api/live-monitor` 200, `shadow`, `writesResults=false`, `idle`, `delayed=false` a 00:37:14 UTC. Dieciocho rutas del build respondieron HTTP 200; es una comprobación aparte de la revisión interactiva. Bundle Wrangler dry-run válido, sin cambio de secretos.

## Publicación y comprobación pública

PR19 https://github.com/Vitolop1/RugbyNow/pull/19 publicado mediante merge `31ef6cc`. Workflow posterior https://github.com/Vitolop1/RugbyNow/actions/runs/39523515385 terminado con éxito: pasos de tablas oficiales, ambos calendarios LNR, URBA, 30 planteles, 30 instituciones, noticias, transmisiones, exportación completa y commit comprobados individualmente. Se ejecutó con `standings_only=true`: no demuestra escrituras de un resultado en vivo. El bot `ddc56f3` conserva los nuevos archivos; snapshot 00:50:57.644 UTC con 19 competiciones, 50 temporadas, 166 equipos, 1.980 partidos de base y 306 filas de tablas. Los calendarios oficiales adicionales se integran por separado, sin presentar su cantidad como filas nuevas en Supabase.

API pública contrastada: URBA 184 encuentros, 182 finales y 14 filas de tabla; Top 14 francés 63 encuentros fechados, 119 pendientes y 14 filas de tabla; Provence 59 jugadores de la edición 2026/27, estadio y cinco cargos deportivos. Revisión interactiva pública de los resultados de marzo URBA en escritorio; cuerpo técnico de Los Pumas en móvil, incorporaciones anunciadas etiquetadas y ausencia del staff XV tras cambiar a Seven. Sin desborde de página a 355 px efectivos ni errores de consola observados en esa navegación. Se conservó el tema claro elegido en el navegador. Capturas de comprobación guardadas fuera del repo en research/audit-2026-10-21. No equivale a revisar interactivamente todas las rutas del catálogo.

Cron productivo comprobado por `/api/live-monitor`: `scheduledAt` 05:25:23.754, 05:27:23.754 y 05:28:23.754 UTC del 21/10; recepción aproximadamente 0,65 s después. Las dos últimas observaciones prueban un intervalo de 60 s del scheduler. Todas devuelven `shadow`, `writesResults=false`, `idle`, `sources=[]`, `delayed=false`: no hubo lectura de una fuente deportiva dentro de ventana ni cambios de tanteador. La irregularidad del importador principal de GitHub sigue pendiente. El próximo contraste debe registrar origen → escritura → API → pantalla durante encuentros reales; un latido puntual no demuestra disponibilidad continua.

## Pendientes que no se ocultan

Vivo real y promoción controlada del recolector; calendarios completos y tablas oficiales de los torneos restantes; planteles/staff fuera de Francia; ampliar disponibilidad/movimientos con fuentes nuevas. Los playoffs de URBA y Francia no quedan completos por completar la fase regular. No hay cuenta sincronizada ni ingresos garantizados.


## Rediseño compacto de agenda — 22/10/2026

Implementado en `codex/agenda-competition-clarity`, basado expresamente en PR26 (`codex/agenda-first-home`), sin incorporar las ramas de SEO, vivo, fechas, escudos o selección editorial. Revisar primero PR26 y luego este cambio; no se fusionó ni desplegó código. Se reutilizó el avance local de `internationalBroadcasts.ts` conservando intacto su checkout de origen.

- Competiciones con borde/espacio moderado, acento verde, logo existente, conteo, enlace al torneo y contador LIVE/HT exclusivamente confirmado por estado. Escudos proporcionados y fallback por ruta, incluida falla cacheada antes de hidratación.
- Destacados se abre únicamente desde «Ver destacados», oculto al cargar; sin persistencia nueva. Conserva apertura al refrescar/navegar dentro de la agenda, fecha y filtros. No hay control vacío. Se conserva el selector editorial existente; el algoritmo alternativo del PR21 sigue separado.
- Logos de todas las transmisiones verificadas en la misma fila, deduplicados por proveedor, con detalle táctil de país, fuente, fecha publicada/comprobada y tipo de enlace. Índice exacto por competición/equipos/comienzo UTC y edición compatible; se propaga la temporada existente en la lectura de agenda. Sin derechos nuevos ni cambios de importadores, esquema o escrituras de Supabase. Las fuentes editoriales sin URL siguen identificadas como guía fechada, sin inventar enlaces.

Comprobado: 89 pruebas, TypeScript y build Next. Revisión interactiva local a 355/390/430/1024/1440 px (ancho útil menor por scrollbar), 40 partidos del 17/10 y ningún desborde horizontal ni imagen rota observada; un solo partido Pro D2 del 22/10 y día vacío 21/10. Apertura/cierre por clic y teclado, refresh con panel abierto, navegación y búsqueda; ES/EN/FR/IT y temas verde/claro/oscuro. Detalle Disney+ de Argentina y CANAL+ SPORT de Francia con fuente/fecha/tipo de enlace. LIVE 0–0, HT, FT, hora pendiente y fallback revisados con fixture temporal claramente rotulado en servidor local de desarrollo, retirado antes del build final; no hubo escrituras deportivas. Esto no acredita un vivo real.

Capturas fuera del repo: `../research/agenda-clarity-2026-10-22/` (desktop/mobile-after y states-local-fixture); antes: `../research/agenda-home-2026-10-21/`. El inventario sigue en 212 assets, sin descargas nuevas. Sin errores/warnings observados en consola durante esta revisión. No se verificó entrega de anuncios reales en localhost; IDs y unidades existentes se conservan. Pendiente aprobación del PR y comprobación pública posterior; no llamar publicado a estas capturas locales.

Comprobación adicional del build final servido con Next start: `/` y `/agenda` entregan los mismos 40 IDs de partido en HTML inicial, canonical raíz y Destacados oculto. Hidratación móvil de ese build: 40 filas visibles, panel oculto y sin desborde ni errores/warnings observados. API del día del fixture temporal comprobada sin registros de prueba.
