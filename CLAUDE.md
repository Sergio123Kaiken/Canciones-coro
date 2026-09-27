# Canciones de nuestra misa — notas para Claude

Página estática (sin build) para que Sergio y su pareja organicen las canciones de la misa de su matrimonio (misa católica, uso en Chile), arrastrando canciones de Spotify a cada momento y escuchándolas en orden. Todo en español.

## Archivos
- `index.html` — estructura; carga `styles.css?v=N` y `app.js?v=N` (subir N al cambiar esos archivos, para evitar caché).
- `app.js` — toda la lógica: estructura de la misa (`MASS`), estado en `localStorage` (`misa-matrimonio-v1`), drag & drop con SortableJS (`forceFallback: true`), reproductor en orden con Spotify iFrame API, búsqueda opcional con Spotify Web API (PKCE, Client ID del usuario), recomendación de orden por palabras clave (`RULES`, `FLEXIBLE`).
- `sortable.min.js` — SortableJS 1.15.2 incluido localmente.

## Decisiones ya tomadas
- Sin repetidas: el banco no acepta el mismo link, mismo texto o mismo nombre+artista; un momento de la misa no puede tener la misma canción dos veces (sí puede estar en momentos distintos).
- No usar `confirm()` / `prompt()` / `alert()`: el navegador integrado de apps del celular los bloquea. Usar el helper `ask()` de `app.js`.
- Botón "✨ Recomendar orden": reemplaza el plan con opción de Deshacer.
- El usuario usa mucho el celular: probar a 390 px de ancho sin scroll horizontal.

## Rama y publicación
- Rama de trabajo: `claude/wedding-mass-song-organizer-3o97nj`.
- Link rápido: `https://raw.githack.com/Sergio123Kaiken/Canciones-coro/<commit>/index.html` (con el hash del último commit).
- Link definitivo si se activa GitHub Pages: https://sergio123kaiken.github.io/Canciones-coro/

## Pendiente
- Precargar en el banco las canciones de la playlist del usuario:
  https://open.spotify.com/playlist/6I1q8WZgMqa8COVe0ZXvfD
  (requiere un entorno con acceso de red a `open.spotify.com` / `api.spotify.com`; la sesión original no lo tenía).
  Idea: guardar la lista (id, título, artista, portada) en un archivo como `playlist.json` y agregarla al banco al cargar la página, sin duplicar las que ya estén y sin volver a agregar las que el usuario haya borrado.
