# Observabilidad de RugbyNOW

## Ejecución y alcance

`npm run audit:health` genera `logs/operational-health/report.json` y `report.md`, ignorados por Git. `npm run audit:health -- --strict` termina con código 1 si detecta degradación, conservando el informe. `--samples=1` reduce consultas; el máximo permitido es 3 por endpoint. `--out=...` permite archivar una medición separada. `--base=http://localhost:3002` sirve para el sitio local, pero `/api/live-monitor` pertenece al Worker y no existe en Next start: ese 404 no demuestra un fallo productivo.

El workflow **Operational health (read only)** está preparado para ejecución manual después de aprobar este PR. No añade cron, importador, agente de IA, despliegue, secretos ni escrituras. Usa permisos `contents: read` y `actions: read`, Job Summary y artefactos por 14 días incluso cuando fallan comprobaciones. No confundir su archivo en una rama con una ejecución efectiva de GitHub.

Cada corrida realiza como máximo 27 GET al sitio, secuenciales, sin reintentos, con timeout de 12 segundos y límite de 2 MB por respuesta. Consulta tres endpoints públicos de GitHub, incluida una muestra de hasta 100 runs. No ejecuta JavaScript de Analytics ni solicita anuncios: las pruebas HTTP no generan pageviews o impresiones publicitarias del navegador.

## Lectura de los resultados

- Cada métrica registra área, nombre, valor/unidad, período, fuente, momento de consulta, verificación y notas. `null` significa no disponible, nunca cero.
- Latencias incluyen red y descarga del cuerpo. Media/p50/p95/máximo son empíricos y llevan cantidad de muestras. Tres solicitudes no prueban uptime mensual ni un SLO; con n=3, p95 coincide con el máximo.
- Un HTTP 200 necesita además una forma básica válida: agenda, partido, tabla, equipo, preferencias, catálogo o informe de monitor. XML, robots y ads.txt se distinguen de una página HTML de error. Esto no revalida deportivamente cada resultado o tabla.
- El origen `snapshot` de una ficha de equipo es intencional y no cuenta como caída de Supabase. Se registran por separado los respaldos en endpoints que pueden consultar la base.
- La exportación versionada no equivale a un conteo directo de Supabase. Sus fechas pueden ser provisionales. Los calendarios oficiales se cuentan por separado para no sumar duplicados ni confundir ventanas con fechas publicadas.
- Planteles usan el modelo existente `season-squad`: no contar directorios ni convocatorias como plantel de temporada. Las relaciones jugador/temporada no son necesariamente personas únicas entre varias ediciones.
- `checkedAt` es una consulta; `snapshotAt/generatedAt` fecha la exportación; `updated_at` fecha una escritura. El cambio real en origen no se infiere de ninguno. Una fecha futura por desfase de relojes produce edad desconocida, no edad cero.
- Las fuentes guardadas conservan último chequeo, intento cuando está disponible y éxito conocido; una modificación real del contenido de origen sigue desconocida si no existe evidencia. No se reemplaza por el timestamp del reporte.
- Un monitor `idle` confirma un latido, sin medir demora de tanteadores. No hay percentiles deportivos sin partidos reales contrastados.

`status=degraded` identifica contratos fallidos, monitor demorado, respaldo de más de 24 horas, feed de noticias fallido, ausencia de ejecuciones observables o último run programado de un workflow activo de 5 minutos con más de 15 minutos. Los umbrales son controles operativos explícitos, no garantías de GitHub ni una medición de retraso del marcador. No se reactivan workflows antiguos deshabilitados. `checks_passed` solo cubre los controles disponibles, no datos privados o un vivo real.

## Línea base pública — 22/10/2026, 13:08:13–13:08:22 UTC

27 observaciones: 26 cumplieron su contrato. El caso que falla es `/api/matches/16913oops`, que producción resuelve como partido 16913 con 200. La corrección de esta rama exige un ID completo, entero seguro y no nulo; conserva la sintaxis negativa de fixtures oficiales. La API corregida se comprobó localmente: sufijos/decimales → 400; ID válido con competición → 200 desde snapshot. No se alteraron resultados.

| Endpoint representativo | Muestras | p50 | p95/máximo |
| --- | ---: | ---: | ---: |
| Agenda | 3 | 191 ms | 326 ms |
| Competiciones | 3 | 136 ms | 146 ms |
| Pro D2, calendario y tabla | 3 | 753 ms | 764 ms |
| Montauban | 3 | 43 ms | 50 ms |
| Partido 16913 con competición | 3 | 534 ms | 562 ms |
| Preferencias | 3 | 26 ms | 27 ms |
| Monitor | 3 | 96 ms | 124 ms |

Agenda, catálogo, competición y partido respondieron desde base; equipo desde snapshot intencional. Robots, sitemap, ads.txt y noticias respondieron 200. El sitemap público contiene 1.794 URLs; no son páginas indexadas. Monitor productivo: shadow, sin escrituras, idle; no se comprobó latencia deportiva. La lectura de R2 del informe funciona; no se accedió a telemetría histórica de Cloudflare, consumo, facturación ni políticas/índices efectivos de la base.

Exportación `2026-10-22T12:25:48.418Z`: 19 competiciones, 50 temporadas, 166 equipos y 1.980 partidos; 1.271 con hora registrada. 1.292 fechas anteriores al día UTC y 688 actuales/futuras; 37 registros anteriores sin FT/CANC confirmado, cero FT sin ambos marcadores. No completar esos 37 por estimación. Cinco tablas con procedencia oficial almacenada; 30 clubes y 1.590 relaciones de plantel de temporada; 15 confirmaciones territoriales de TV. Noticias: 24 titulares, uno publicado en las 24 horas anteriores; no es el número de artículos nuevos importados.

Calendarios separados: Pro D2 2026/27, 240 cruces/88 días/32 horas publicadas; Top 14 2026/27, 182/63/21; URBA 2026, 182 regulares con día, sin hora en esa fuente; Mundial masculino XV 2027, 52 con fecha/hora publicada, incluidos cruces condicionales. No sumar estos overlays a los 1.980 registros.

La muestra acotada de Actions contiene 27 runs programados generales (uno fallido) y 13 de vivo. Separación máxima entre creaciones: 291,92 y 301,68 minutos respectivamente; medianas 118,03 y 243 minutos. La cola visible no explica ejecuciones que no llegaron a crearse. La actualización completa 39777846733 terminó con éxito, incluido snapshot; 39728134058 omitió snapshot porque no correspondía al evento de actualización independiente. Un run general verde no demuestra éxito de todas las fuentes: el snapshot de noticias registra ESPN fallido y UAR correcto. El reporte nuevo señala el fallo en vez de ocultarlo detrás del HTTP 200.

## Continuidad y PR existentes

Base auditada: `main` af5a567, exportación de datos automática. El código de los PR #20–#27 seguía abierto y sin fusionar al consultar. No se incorporan ni duplican:

- #20: SEO, sitemaps, contenido y medición comercial; corrige soft 404 y temporización de publicidad fuera de pantalla. Revisarlo antes de otra corrección de esas áreas.
- #21/#22/#23: selección editorial, fechas y escudos.
- #24: memoria operativa; contenido instalado de `rugbynow-quality` coincide con su versión propuesta. No modificar otra vez esa skill.
- #25: descubrimiento, recuperación de fuentes y reportes de importaciones. No activar el monitor como escritor; sigue pendiente aceptación con tres partidos reales.
- #26/#27: portada y diseño de agenda; #27 depende de #26.

Las métricas privadas de Search Console, GA4 y AdSense se consultaron en la interfaz autorizada y se entregan al dueño fuera de Git. El runner marca esas métricas como no disponibles porque no dispone de una integración privada; no copia credenciales ni publica cifras de las cuentas en Actions.

## Pendientes y seguimiento

1. Revisar #20 y #25 y comprobar cada despliegue aprobado; este diagnóstico no corrige por sí solo la cadencia ni acredita indexación.
2. Validar el vivo según LIVE-RELIABILITY, incluidos recepción/escritura/API/pantalla y errores, antes de autorizar escritura Cloudflare.
3. Investigar el feed ESPN con una alternativa permitida y conservar el último contenido válido. No eludir bloqueos.
4. Verificar RLS, permisos e índices efectivos con acceso de solo lectura al plano de control; el código/migraciones disponibles no los acreditan. Revisar telemetría histórica de Cloudflare y trazas de red de GA4 antes de afirmar ausencia de duplicados o de tráfico interno.
5. Ejecutar este informe periódicamente tras aprobación. Una revisión semanal de Codex puede consumir el JSON y elegir un único fallo reproducible; no analizar todo el repo ni usar IA para cada marcador. No se encontró una configuración semanal en la ubicación local habitual y no se activó una tarea en esta entrega. Las tareas locales requieren máquina/app disponibles; ver [documentación oficial](https://learn.chatgpt.com/docs/automations?surface=app).

El consentimiento de Analytics no acredita consentimiento publicitario regional. La asignación de CMP al dominio debe comprobarse aparte, conforme a los [requisitos de Google](https://support.google.com/adsense/answer/13554116?hl=en). No se modificaron políticas, pagos ni solicitudes de revisión.

Validación de código: 90 pruebas, TypeScript y build Next correctos. La CLI se ejecutó realmente y terminó degradada/código 1 al medir producción, donde la corrección todavía no está publicada; eso es detección correcta, no una prueba verde ficticia. El workflow manual permanece propuesto hasta revisión y ejecución efectiva. No se fusionó ni desplegó este código.
