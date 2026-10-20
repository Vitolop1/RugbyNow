# Auditoría de vivo y próxima actualización

Fecha: 20/10/2026. Estado de esta revisión: implementación y verificación en curso; las comprobaciones de publicación se registran al cerrar.

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
