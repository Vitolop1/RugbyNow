# Desafío diario de RugbyNOW

Biblioteca inicial revisada el 20 de octubre de 2026. Las preguntas y explicaciones son textos originales breves en ES/EN/FR/IT, apoyados en las fuentes oficiales enlazadas en cada entrada de `rugby-quiz.ts`.

Alcance: rugby union XV de mayores e historia fechada. Se excluyen récords cambiantes, calendarios, estadísticas actuales y tiempos de sanciones o acciones sujetos a pruebas de leyes. La sección no pretende reemplazar el reglamento completo.

Fuentes de reglas, consultadas en World Rugby Passport:

- [2.1, pelota](https://passport.world.rugby/laws-of-the-game/laws-by-number/2-ball/).
- [3.1, equipos](https://passport.world.rugby/laws-of-the-game/laws-by-number/3-team/).
- [5.1, duración](https://passport.world.rugby/laws-of-the-game/laws-by-number/5-time/).
- [6.5c, marcador](https://passport.world.rugby/laws-of-the-game/laws-by-number/6-match-officials/).
- [7.1, ventaja](https://passport.world.rugby/laws-of-the-game/laws-by-number/7-advantage/).
- [8.1, valor del try](https://passport.world.rugby/laws-of-the-game/laws-by-number/8-scoring/).
- [9.14, tackle sin pelota](https://passport.world.rugby/laws-of-the-game/laws-by-number/9-foul-play/).
- [10.1, offside](https://passport.world.rugby/laws-of-the-game/laws-by-number/10-offside-and-onside-in-open-play/).
- [11.7, pase hacia adelante](https://passport.world.rugby/laws-of-the-game/laws-by-number/11-knock-forward-or-throw-forward/).
- [12.1, kick-off](https://passport.world.rugby/laws-of-the-game/laws-by-number/12-kick-off-and-restart-kicks/).
- [14.1, definición de tackle](https://passport.world.rugby/laws-of-the-game/laws-by-number/14-tackle/).
- [15.2, formación de ruck](https://passport.world.rugby/laws-of-the-game/laws-by-number/15-ruck/).
- [16.2, formación de maul](https://passport.world.rugby/laws-of-the-game/laws-by-number/16-maul/).
- [17.3, mark](https://passport.world.rugby/laws-of-the-game/laws-by-number/17-mark/).
- [18.11, mínimo para lineout](https://passport.world.rugby/laws-of-the-game/laws-by-number/18-touch-quick-throw-and-lineout/).
- [19.5, primera línea del scrum](https://passport.world.rugby/laws-of-the-game/laws-by-number/19-scrum/).

Historia:

- Archivo oficial de Rugby World Cup: [1987](https://www.rugbyworldcup.com/2027/en/past-tournaments/1987), [1995](https://www.rugbyworldcup.com/2027/en/past-tournaments/1995) y [2003](https://www.rugbyworldcup.com/2027/en/past-tournaments/2003).
- [Historia olímpica oficial de World Rugby](https://www.world.rugby/tournaments/olympics/history): debut de seven en Río 2016.

La referencia [Futbol11](https://futbol11.com/) se consultó para entender su enfoque de desafíos diarios; no se copiaron sus juegos, marca, textos ni datos.

## Continuidad y límites

`lib/rugbyQuiz.ts` selecciona cinco preguntas y ordena sus opciones con una semilla común por fecha UTC y versión. El idioma no afecta la selección ni la puntuación. La fecha se resuelve por solicitud y se revisa al recuperar la pestaña y cada treinta segundos; la zona horaria de la agenda no la modifica.

El progreso diario se guarda solo en el navegador, con una clave distinta por fecha y versión. Se validan IDs de preguntas, opciones, secuencia y finalización antes de recuperarlo. Las respuestas ya enviadas se bloquean; reiniciar limpia únicamente el desafío actual. Práctica genera otra combinación y no sobrescribe el desafío diario. La puntuación es personal: no hay tabla de clasificación, racha inventada, cuenta ni sincronización entre dispositivos.

Si cambia la biblioteca, el orden de opciones de una entrada o sus respuestas correctas, aumentar `QUIZ_VERSION` para no reutilizar una puntuación incompatible. Mantener IDs estables cuando solo se ajusta una errata de redacción. Revisar las fuentes al cambiar una pregunta y actualizar la fecha de verificación.

El teclado usa botones nativos, foco al avanzar y explicaciones anunciadas; las marcas ✓/× acompañan al color. El estilo usa variables del tema y respeta movimiento reducido. Falta la comprobación interactiva en computadora y celular mientras Work tenga el navegador desactivado.
