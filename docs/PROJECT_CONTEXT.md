# Contexto de RugbyNOW

Última consolidación: 20 de octubre de 2026, a partir de pedidos del dueño y cambios verificados. Este documento guarda decisiones duraderas; los valores, URLs, credenciales, cifras de cobertura y estados de servicios deben verificarse en sus fuentes actuales.

## Producto y forma de trabajar

RugbyNOW quiere ser una referencia de rugby como Promiedos lo es de fútbol: agenda, resultados, tablas, clubes, noticias y dónde ver partidos. La prioridad es una agenda rápida y confiable de hoy. El dueño quiere crecer internacionalmente y generar ingresos; monetización y micro-SaaS son objetivos a evaluar, no ingresos ni productos ya validados.

Preferencias confirmadas:

- Sección inicial compacta de Destacados: partidos reales recomendados para ver, con horario local y transmisión solo cuando esté confirmada. Selección progresiva sin agrandar la portada.

- Interfaz verde, deportiva, compacta y legible, inspirada en Promiedos y El Nine: filas alineadas, horarios, marcador, escudos y competiciones reconocibles. Evitar grandes bloques decorativos y tarjetas gigantes. La noticia sí lleva tarjeta compacta con foto.
- Referencia visual más reciente: navegación lateral de competiciones, resultados centrados y banner publicitario vertical como El Nine; mantener el verde y la densidad de Promiedos. Monetización híbrida con AdSense existente y consulta de patrocinio directo; rendimiento y entrega de anuncios todavía no verificados.
- Pro D2 de Francia es una prioridad explícita, con sus 16 clubes, partidos y tabla. Mostrar el logo de la señal real por encuentro y país (ej. Disney+, ESPN o CANAL+), sin asignar derechos por la sola pertenencia a una liga. Rugbyrama es un medio, no una señal confirmada.
- Pelota de rugby giratoria durante carga y quieta cuando no hay encuentros; respetar movimiento reducido. Dibujar un óvalo suave con paneles rojo/azul/blanco parecido a la referencia del dueño; evitar la pelota de fútbol americano con costuras gruesas y el aplastamiento del giro 3D. Configuración lleva una tuerquita compacta en la cabecera y el selector de idioma muestra banderas. En teléfono/vertical la navegación no debe requerir desplazamiento horizontal.
- Historial entre ambos equipos con resultados reales y cobertura explícita. El dueño también pidió formaciones: publicarlas cuando exista una fuente verificable, no como predicción inventada. Desafíos de rugby inspirados en Futbol11: primera versión con preguntas diarias, práctica y explicaciones; acceso discreto desde la agenda vacía y menú secundario. El pedido más reciente baja su protagonismo: agenda y resultados primero, interfaz minimalista para visitantes nuevos; no sumar funciones visibles por cantidad.
- Mismo estilo entre todas las páginas. Prioridad de Los Pumas, URBA y rugby argentino junto al internacional; ES/EN/FR/IT y zona horaria independiente del país de transmisión.
- Poder seguir clubes, elegir y ordenar ligas y cambiar la apariencia desde Configuración. Temas verde/claro/oscuro, texto normal/grande y espaciado compacto/cómodo. Preferencias locales funcionales; una cuenta es opcional y todavía no hay sincronización entre dispositivos.
- Noticias con fotografía, fecha, fuente y acceso al original; tablas de puntos y últimos resultados desplegables. No inventar cinco resultados si la edición solo tiene menos disponibles.
- El aviso de día sin partidos debe ocupar poco alto; no una tarjeta grande que empuje los próximos encuentros. Iconos de configuración y pelota con formas simétricas y limpias. En TV, radio y streams, mostrar accesos al canal original en la propia fila y el logo de YouTube cuando corresponda; no esconderlos solo dentro del desplegable de TV ni usar búsquedas como si fueran canales.
- TV, radio y streams es el nombre de la sección. Las alternativas externas actuales fueron indicadas expresamente por el dueño; su lista canónica está en `lib/watchPlaceholderOptions.ts`. Cambiarla allí conserva todos los accesos coherentes y la medición de clics. No volver a dominios históricos de documentación antigua.
- Respuestas en español claro con voseo, actualizaciones breves y decisiones concretas. Trabajar con autonomía dentro del pedido, conservar lo útil, comprobar el resultado y explicar pendientes reales. No detener cada decisión menor para pedir permiso.

Plantillas de temporada, fichas deportivas de jugadores, lesiones públicas verificadas y fichajes/renovaciones/préstamos/salidas están expresamente incluidos en el pedido del 20/10/2026. Diferenciar convocatorias, plantel de temporada y formación de partido; separar confirmaciones de rumores y fechar cada fuente. Los canales de YouTube verificados forman parte de los accesos de streams. IA y nuevos micro-SaaS no quedan autorizados por estas ampliaciones.

## Repo y orientación rápida

Repositorio: https://github.com/Vitolop1/RugbyNow. Sitio: https://rugby-now.com/. Next.js 16, React 19 y TypeScript; Supabase; empaquetado OpenNext para Cloudflare Workers. Comprobá versiones y comandos en `package.json`, no en esta nota.

En esta máquina existen dos copias:

- `C:/Users/PC/rugbynow/RugbyNOW`: checkout original con cambios previos del dueño que no se deben sobrescribir.
- `C:/Users/PC/Documents/ChatGPT/Pagina web de rugby/RugbyNow`: checkout usado para las reparaciones y publicaciones de esta conversación.

No es una regla universal de ubicación: verificá el checkout y su estado en cada sesión. No copies archivos de entorno ni sus secretos para trasladar contexto.

Mapa de entrada:

| Necesidad | Archivos principales |
| --- | --- |
| Agenda diaria, fechas y guía editorial | `app/agenda/DailyAgendaClient.tsx`, `lib/dailyAgenda.ts`, `data/rugbyAgenda.ts`, `pages/api/home.ts` |
| Calendario y tablas de competiciones | `app/leagues/[slug]/CompactLeagueClient.tsx`, `pages/api/leagues/[slug].ts`, `lib/supabaseSnapshot.ts` |
| Tabla oficial URBA y bonus | `lib/officialStandings.ts`, `lib/standingsOverlay.ts`, `scripts/update-official-standings.ts` |
| Noticias y fotos originales | `lib/news.ts`, `lib/newsServer.ts`, `scripts/update-news.ts`, `app/news/NewsClient.tsx` |
| Navegación, preferencias y apariencia | `app/components/SiteHeader.tsx`, `app/settings/AppearanceSettings.tsx`, `lib/usePrefs.ts`, `lib/usePersonalization.ts`, `app/components/AppearanceSync.tsx` |
| TV exacta por encuentro y país | `lib/matchBroadcasts.ts`, `data/match-broadcasts.json`, `scripts/update-match-broadcasts.ts`, `app/components/BroadcasterLogo.tsx` |
| Historial entre equipos | `lib/headToHead.ts`, `lib/headToHeadServer.ts`, `app/components/HeadToHead.tsx`, `pages/api/matches/[id].ts` |
| Desafíos diarios y práctica | `app/games/`, `lib/rugbyQuiz.ts`, `data/rugby-quiz.ts` |
| Publicidad | `app/components/AdvertisingPlacement.tsx`, `lib/advertising.ts`, `app/advertise/` |
| Alternativas para ver y medición | `lib/watchPlaceholderOptions.ts`, `app/components/ExternalWatchOptions.tsx`, `lib/analytics.ts` |
| Escudos y recursos | `lib/assets.ts`, `public/team-logos/`, `data/visual-assets.json`, `docs/VISUAL-ASSETS.md` |
| Importación, ejecución y respaldo | `scripts/sync-flashscore.ts`, `scripts/sync-matches.ts`, `scripts/sync-live-runner.ts`, `.github/workflows/`, `scripts/export-supabase-snapshot.ts` |

## Lecciones que no hay que perder

- GitHub había desactivado importaciones por inactividad. Un despliegue verde no demuestra actualización de datos. Revisar workflow, variables de activación, ejecución real y artefactos. Los programas que inventaban reloj/finales no deben reactivarse.
- Una competición terminada puede abrir un cuadro de playoffs en lugar de posiciones. Esperar la tabla, seleccionar su fase regular y resolver el consentimiento que bloquee esa selección. Validar filas completas antes de reemplazar datos.
- Una copia con más partidos no necesariamente es mejor: puede pertenecer a otra edición o a un dump de prueba. No desplazar la temporada y tabla verificadas para rellenar un calendario.
- Supabase limita resultados por defecto; los respaldos y consultas amplias necesitan paginación estable. Una importación puede haber guardado datos aunque un paso posterior falle: inspeccionar la etapa antes de repetir escrituras.
- Validar también los IDs resueltos antes de guardar una tabla: 16 filas de fuente pueden convertirse en 15 si falla un club o dos aliases convergen. Pro D2 rechaza escrituras incompletas antes del upsert.
- El bootstrap de competiciones debe recibir los mismos FLASH_URLS seleccionados para el importador; el workflow ya pasa esa variable a Ensure configured competitions.
- Un día del mes o un marcador no identifica una fecha de competición: el parser debe exigir un encabezado explícito o una fuente oficial por encuentro. Pro D2 usa la fecha de LNR si coincide la identidad y el comienzo UTC.
- Los nombres parecidos no identifican el mismo club: Lions no es Old Lions; Lobos de Uruguay no es Lobos de México; un Universitario sin contexto puede ser ambiguo. Conservar IDs, edición y procedencia.
- La grilla de Horacio/Norte Rugby es una referencia editorial fechada, en hora argentina. No es un feed recurrente ni prueba de transmisiones de otra semana o país.

## Ampliación comprobada del 20/10/2026

- Tablas oficiales por edición: URBA 2026 (14), Pro D2 2026/27 (16), Top 14 francés 2026/27 (14), Champions (4 grupos de 6) y Challenge (3 de 6). LNR publica bonus total; EPCR publica diferencia, BO y BD, pero no PF/PC: conservar desconocidos como null. No recalcular puntos ni desempates oficiales.
- Pro D2: 240 cruces de fase regular, 30 jornadas verificadas. 88 con día publicado y 152 con ventana de fechas; no presentar las fechas provisionales de otro proveedor como confirmadas. Los encabezados de día de LNR prevalecen sobre la ventana nominal de jornada (J7 incluye sábado 17/10).
- Mundial masculino XV 2027: 52 encuentros del PDF oficial, 16 cruces condicionales, UTC según la ciudad anfitriona y su DST. La edición archivada 2025/2026 contiene el clasificatorio final para 2027 disputado en noviembre de 2025; no es la fase final.
- Directorios LNR de los 16 clubes de Pro D2: 791 jugadores con ID público estable. La fuente no indica temporada: etiquetar directorio, nunca plantilla actual confirmada. Lesiones y movimientos tienen fecha, fuente y clasificación; un registro viejo no demuestra disponibilidad actual.
- Algunos países comparten ID entre XV y seven. Fichas, estadísticas y resultados se separan por disciplina, con selector visible; no fusionar categorías por el nombre del país. El generador de perfiles no debe identificar seven por la presencia de una sola competición SVNS.
- Las escrituras de resultados se condicionan a la fecha de observación dentro del UPDATE, evitando que una extracción anterior sobrescriba otra más nueva. Un FT no vuelve a LIVE/NS. Aplazamiento/suspensión/prórroga conservan calificadores explícitos de fuente, sin inventar reloj.

## Límites y pendientes conocidos

El proveedor de resultados activo usa Flashscore; hay un adaptador de evaluación de API-Sports, pero no se comprobó una segunda fuente estructurada con credenciales ni conmutación automática. No afirmar independencia del scraping o cobertura mundial completa. Ver `docs/PROVIDERS-AND-PERSONALIZATION.md` para la auditoría, atendiendo a que sus primeras secciones describen entregas anteriores.

La consulta de pantalla cada 15 segundos durante partidos LIVE no equivale a datos de origen cada 15 segundos: los trabajos de origen tienen una programación distinta y pueden demorarse. Una ejecución sin partidos activos no prueba un marcador cambiando. La prioridad explícita más reciente es comprobar el vivo y recomendar una arquitectura confiable, con evidencia de origen, recepción y pantalla. Ver `docs/LIVE-RELIABILITY.md` para auditoría, correcciones y la migración propuesta; no afirmar que una tarea activa o un informe verde equivalen a latencia comprobada.

Persisten algunas identidades de escudos editoriales sin verificar y límites de historial de resultados; ver `docs/VISUAL-ASSETS.md`. La cobertura de un catálogo verificado no equivale a todos los clubes del mundo.

El control del navegador volvió a estar disponible el 20 de octubre de 2026. Se comprobó la agenda vacía, la ficha con historial, el selector de idiomas y los desafíos en computadora y en una vista de 390 px; la práctica no reemplaza el progreso diario y una recarga lo recupera. Comprobar la disponibilidad actual al retomar: las verificaciones HTTP no sustituyen una revisión interactiva.

## Cómo se mantiene esta memoria

Actualizar este contexto cuando el dueño cambie una preferencia duradera o aparezca una lección demostrada; actualizar la documentación técnica cuando cambie el funcionamiento. Conservar decisiones actuales, referencias útiles y pendientes concretos, sin secretos, transcripciones completas ni registros redundantes por turno. No guardar inferencias como preferencias confirmadas. El pedido de recordar contexto no concede permisos permanentes para compras, publicación de cualquier cambio, mensajes ni trabajos en segundo plano.
