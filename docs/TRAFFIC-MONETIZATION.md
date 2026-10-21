# Tráfico y monetización — revisión 21/10/2026

## Alcance de esta entrega

Rama `codex/traffic-monetization-review`, para PR y revisión del dueño. No hacer merge ni desplegar código sin esa revisión. La cuenta GA4 existente se conserva; no se compraron servicios ni se reenviaron solicitudes de AdSense.

## Correcciones comprobables en código

- Una liga inexistente respondía 200 con título generado desde el slug. Ahora responde 404; equipos inexistentes ya respondían 404.
- HTTP devolvía contenido de la portada con 200. El Worker redirige 308 a HTTPS en el host canónico conservando parámetros de fecha/atribución. También contempla www si llega al Worker; no crea DNS ni certificados. El acceso www falló en la consulta pública: su disponibilidad requiere comprobar dominio/DNS antes de atribuirle una redirección efectiva.
- El sitemap publicaba 1.794 URLs y asignaba fechas de exportación/consulta a páginas sin cambios editoriales; el core-sitemap usaba la hora de cada petición. Ahora ambos omiten lastmod cuando no existe un registro de cambio significativo. El sitemap principal propone 193 URLs con contenido deportivo o institucional y no promueve directorios de jugadores. Las fichas básicas siguen accesibles desde planteles, con noindex/follow hasta disponer de información original suficiente. Reducir el sitemap no garantiza indexación.
- Metadatos propios de URBA, Los Pumas, Pro D2 y Top 14; se elimina la promesa genérica de vivo de las descripciones de todas las ligas. No se generan rutas idiomáticas ni hreflang ficticios: los idiomas actuales comparten URL.
- Resumen visible y renderizado en servidor con puntos/promedio/empates calculados exclusivamente sobre finales con ambos marcadores disponibles. Indica edición y cobertura; no recalcula posiciones. URBA: 182 finales, 10.906 puntos y dos empates en la fuente disponible.
- BreadcrumbList de competición; no se genera SportsEvent con sedes/horas inventadas ni se promete elegibilidad para resultados enriquecidos.
- Imagen social 1200×630 generada con código propio, sin fotos externas, y compartir/copiar competiciones con temporada. Sin envíos automáticos a redes ni uso de textos libres en Analytics.
- Un espacio de publicidad fuera de pantalla vencía a los 12 segundos de montarse, antes de pedir el anuncio. El plazo empieza al solicitar una unidad visible. Se mantiene una petición por montaje, sin refrescos artificiales ni creativos de muestra. Las unidades no entregadas se ocultan. AdSlot antiguo no se usa en las rutas principales actuales; no se refactorizó código histórico por este pedido.
- Patrocinios: audiencia objetivo explícita, formatos, información necesaria para consultar y solicitud de métricas reales. El mailto mide intención, no correo enviado, cliente ni venta.

## Medición y privacidad

GA4 existente: `G-FXNKQ0MK41`. Consentimiento opcional de estadísticas conservado; sin él no se carga la etiqueta ni se envían eventos de producto. La configuración real del flujo tiene medición de cargas y cambios de historial habilitada; el código no añade page_view manuales. Esto respalda el diseño, pero no sustituye inspeccionar cada solicitud de red en una sesión real.

`competition` se normaliza a `competition_slug`; propiedades limitadas a identificadores controlados. Eventos existentes: match_open, watch_options_open, watch_provider_click, agenda_favorite, agenda_calendar_export, sponsor_contact_click. Nuevos: league_follow, club_follow, share y sponsor_inquiry. sponsor_inquiry está registrado como evento clave, sin valor monetario predeterminado, una vez por sesión; su código requiere aprobar/publicar este PR. Los eventos nuevos no se presentan como recibidos en producción.

La revisión visual detectó que el tema verde imponía texto verde claro sobre los botones blancos del consentimiento. Se corrige el contraste y el foco de ambos botones con el mismo tratamiento visual, sin favorecer aceptar frente a rechazar.

El consentimiento de Analytics no es una CMP publicitaria. La cuenta muestra mensajes europeos activos, pero no se pudo leer su lista embebida para acreditar la asignación específica al dominio. Verificar en Privacidad y mensajería antes de atribuir cobertura europea; no se sustituyó por un diálogo propio. No se modificaron pagos ni términos.

## Comprobaciones externas y límites

Se inspeccionaron las cuentas autorizadas de Search Console, GA4 y AdSense. Métricas y capturas privadas se guardan fuera del repositorio y se entregan al dueño, nunca en este PR como cifras comerciales.

- robots.txt y ads.txt públicos: 200; publisher coincide con las unidades existentes. Google puede tardar en reflejar el rastreo de ads.txt; un archivo publicado no acredita autorización ni entrega.
- Sitemap principal y core registrados con estado correcto. No se reenvía un sitemap modificado que aún no está publicado. Después del merge aprobado, comprobar contenido público y hacer una sola actualización si procede.
- URBA: prueba en tiempo real permite rastreo/indexación. La solicitud de indexación devolvió un error del servicio reCAPTCHA; no quedó confirmada. No se eludió ni reintentó repetidamente.
- Search Console sin datos de campo suficientes de Core Web Vitals. PageSpeed API respondió 429 por cuota: no hay puntuación actual ni LCP/CLS/INP medidos que se puedan atribuir a este cambio.
- Directorios externos de streams permanecen separados de transmisiones confirmadas. Su existencia no verifica derechos ni compatibilidad con políticas; no se presentan como una aprobación de Google.

## Seguimiento después de publicar

Comparar ventanas equivalentes a los 7, 14 y 30 días, anotando fecha de despliegue, retraso de informes y sesiones propias de QA. No crear una automatización de Codex por documentar este calendario.

| Objetivo | Métrica | Desglose |
| --- | --- | --- |
| Descubrimiento | URLs indexadas, impresiones y clics | Portada, URBA, Pumas, Pro D2, Top 14; marca vs consultas genéricas |
| Calidad de búsqueda | CTR y posición | Misma consulta/página y periodo, evitando conclusiones con pocas impresiones |
| Uso real | Usuarios, sesiones con interacción, páginas | País, canal y páginas de destino; separar tráfico propio cuando sea identificable |
| Utilidad | Aperturas de partido/TV, calendario, seguimiento | competition_slug y acción; no confundir clic al canal con reproducción |
| Patrocinio | sponsor_inquiry por sesión | Intención de abrir correo; confirmar contactos reales manualmente |
| Publicidad | Estado del sitio, entrega, impresiones e ingresos | Solo cifras de AdSense, sin equiparar solicitudes con anuncios servidos |

Difusión propuesta, sin publicaciones automáticas: compartir una agenda semanal real con enlace canónico y UTM por canal; una selección de partidos de URBA/Pumas y otra de Pro D2/Top 14 cuando haya calendario confirmado; medir visitas con interacción y retornos antes de aumentar frecuencia. Mensajes, redes y contactos requieren autorización específica. No comprar tráfico, enlaces ni seguidores.

## Referencias

- Sitemap y lastmod: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Pageviews y cambios de historial: https://developers.google.com/analytics/devguides/collection/ga4/views
- CMP publicitaria: https://support.google.com/adsense/answer/13554116

Validación: 86 pruebas correctas, TypeScript y build completo Next/OpenNext. Un segundo build encontró un bloqueo EPERM de archivos generados al mantener el servidor local abierto; al cerrar ese proceso, el build final terminó correctamente. Revisión del build local: ligas inexistentes 404/noindex, jugador básico noindex/follow, metadatos y BreadcrumbList de URBA/Pro D2, ambos sitemaps estables sin lastmod artificial y PNG social 1200×630 con 200. Patrocinio entrega la nueva propuesta en el HTML inicial. Revisión interactiva a 390 px y escritorio: resumen, tabla de 14 clubes y patrocinio, sin desborde de página ni errores de consola observados; enlaces de contacto inspeccionados sin enviar correos. Capturas fuera de Git. Los anuncios locales se mantienen desactivados; no se acredita entrega real ni se simulan clics. No hay promesa de indexación, aprobación, incremento de tráfico ni ingresos.
