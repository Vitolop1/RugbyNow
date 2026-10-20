# Contexto de RugbyNOW

Última consolidación: 19 de octubre de 2026, a partir de pedidos del dueño y cambios verificados. Este documento guarda decisiones duraderas; los valores, URLs, credenciales, cifras de cobertura y estados de servicios deben verificarse en sus fuentes actuales.

## Producto y forma de trabajar

RugbyNOW quiere ser una referencia de rugby como Promiedos lo es de fútbol: agenda, resultados, tablas, clubes, noticias y dónde ver partidos. La prioridad es una agenda rápida y confiable de hoy. El dueño quiere crecer internacionalmente y generar ingresos; monetización y micro-SaaS son objetivos a evaluar, no ingresos ni productos ya validados.

Preferencias confirmadas:

- Interfaz verde, deportiva, compacta y legible, inspirada en Promiedos y El Nine: filas alineadas, horarios, marcador, escudos y competiciones reconocibles. Evitar grandes bloques decorativos y tarjetas gigantes. La noticia sí lleva tarjeta compacta con foto.
- Mismo estilo entre todas las páginas. Prioridad de Los Pumas, URBA y rugby argentino junto al internacional; ES/EN/FR/IT y zona horaria independiente del país de transmisión.
- Poder seguir clubes, elegir y ordenar ligas y cambiar la apariencia desde Configuración. Temas verde/claro/oscuro, texto normal/grande y espaciado compacto/cómodo. Preferencias locales funcionales; una cuenta es opcional y todavía no hay sincronización entre dispositivos.
- Noticias con fotografía, fecha, fuente y acceso al original; tablas de puntos y últimos resultados desplegables. No inventar cinco resultados si la edición solo tiene menos disponibles.
- TV, radio y streams es el nombre de la sección. Las alternativas externas actuales fueron indicadas expresamente por el dueño; su lista canónica está en `lib/watchPlaceholderOptions.ts`. Cambiarla allí conserva todos los accesos coherentes y la medición de clics. No volver a dominios históricos de documentación antigua.
- Respuestas en español claro con voseo, actualizaciones breves y decisiones concretas. Trabajar con autonomía dentro del pedido, conservar lo útil, comprobar el resultado y explicar pendientes reales. No detener cada decisión menor para pedir permiso.

Noticias fueron solicitadas e implementadas después del pedido inicial que las reservaba para el futuro. IA dentro de la web, jugadores/lesiones, YouTube y nuevos micro-SaaS siguen siendo ideas; no agregarlos solo por estar mencionados aquí.

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
| Alternativas para ver y medición | `lib/watchPlaceholderOptions.ts`, `app/components/ExternalWatchOptions.tsx`, `lib/analytics.ts` |
| Escudos y recursos | `lib/assets.ts`, `public/team-logos/`, `data/visual-assets.json`, `docs/VISUAL-ASSETS.md` |
| Importación, ejecución y respaldo | `scripts/sync-flashscore.ts`, `scripts/sync-matches.ts`, `scripts/sync-live-runner.ts`, `.github/workflows/`, `scripts/export-supabase-snapshot.ts` |

## Lecciones que no hay que perder

- GitHub había desactivado importaciones por inactividad. Un despliegue verde no demuestra actualización de datos. Revisar workflow, variables de activación, ejecución real y artefactos. Los programas que inventaban reloj/finales no deben reactivarse.
- Una competición terminada puede abrir un cuadro de playoffs en lugar de posiciones. Esperar la tabla, seleccionar su fase regular y resolver el consentimiento que bloquee esa selección. Validar filas completas antes de reemplazar datos.
- Una copia con más partidos no necesariamente es mejor: puede pertenecer a otra edición o a un dump de prueba. No desplazar la temporada y tabla verificadas para rellenar un calendario.
- Supabase limita resultados por defecto; los respaldos y consultas amplias necesitan paginación estable. Una importación puede haber guardado datos aunque un paso posterior falle: inspeccionar la etapa antes de repetir escrituras.
- Los nombres parecidos no identifican el mismo club: Lions no es Old Lions; Lobos de Uruguay no es Lobos de México; un Universitario sin contexto puede ser ambiguo. Conservar IDs, edición y procedencia.
- La grilla de Horacio/Norte Rugby es una referencia editorial fechada, en hora argentina. No es un feed recurrente ni prueba de transmisiones de otra semana o país.

## Límites y pendientes conocidos

El proveedor de resultados activo usa Flashscore; hay un adaptador de evaluación de API-Sports, pero no se comprobó una segunda fuente estructurada con credenciales ni conmutación automática. No afirmar independencia del scraping o cobertura mundial completa. Ver `docs/PROVIDERS-AND-PERSONALIZATION.md` para la auditoría, atendiendo a que sus primeras secciones describen entregas anteriores.

La consulta de pantalla cada 15 segundos durante partidos LIVE no equivale a datos de origen cada 15 segundos: los trabajos de origen tienen una programación distinta y pueden demorarse. Una ejecución sin partidos activos no prueba un marcador cambiando.

Persisten algunas identidades de escudos editoriales sin verificar y límites de historial de resultados; ver `docs/VISUAL-ASSETS.md`. La cobertura de un catálogo verificado no equivale a todos los clubes del mundo.

El control de navegador de Work estaba desactivado en la última revisión y ninguna herramienta disponible exponía cómo encenderlo. Verificar su disponibilidad actual antes de reutilizar ese diagnóstico. Las comprobaciones HTTP no sustituyen una revisión interactiva en computadora y celular.

## Cómo se mantiene esta memoria

Actualizar este contexto cuando el dueño cambie una preferencia duradera o aparezca una lección demostrada; actualizar la documentación técnica cuando cambie el funcionamiento. Conservar decisiones actuales, referencias útiles y pendientes concretos, sin secretos, transcripciones completas ni registros redundantes por turno. No guardar inferencias como preferencias confirmadas. El pedido de recordar contexto no concede permisos permanentes para compras, publicación de cualquier cambio, mensajes ni trabajos en segundo plano.
