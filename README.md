# Canciones de nuestra misa 💍

Página para organizar las canciones de la misa de matrimonio (estructura de la misa católica según el uso habitual en Chile) arrastrando canciones de Spotify a cada momento, y escucharlas en orden.

## Cómo usarla

1. Abre `index.html` (o la versión publicada en GitHub Pages).
2. En Spotify: en una canción, **Compartir → Copiar enlace** y pégalo en el *Banco de canciones*. Puedes pegar varios links a la vez.
   También puedes escribir texto libre (ej. “Ave María – coro en vivo”) para canciones que no están en Spotify.
3. **Arrastra** las canciones del banco a cada momento de la misa (o usa el botón **＋** de cada canción, más cómodo en el celular).
   Un momento puede tener varias candidatas: marca la elegida con **☆**.
4. **▶ Escuchar en orden** reproduce la misa completa, momento a momento. Puedes elegir si suena solo la elegida o todas las candidatas.
   Si tienes sesión iniciada en Spotify en el navegador, las canciones suenan completas; si no, Spotify reproduce vistas previas de 30 s.
5. **Guardar / compartir**: el plan se guarda solo en tu navegador. Para mostrárselo a tu pareja, al coro o al sacerdote usa *Copiar enlace*, descarga un respaldo `.json` o imprime el programa.

### Búsqueda dentro de la página (opcional)

Para buscar canciones o importar playlists completas sin salir de la página, crea una app gratuita en
<https://developer.spotify.com/dashboard>, agrega la dirección de la página como *Redirect URI* (debe ser `https`, como la de GitHub Pages)
y pega el *Client ID* en “Conecta Spotify”. Las apps en modo desarrollo solo funcionan para las cuentas que agregues en *User Management*.

## Publicar en GitHub Pages

Settings → Pages → *Deploy from a branch* → elige la rama y la carpeta `/ (root)`. No requiere compilación.

## Estructura de la misa

- **Ritos iniciales**: entrada del novio, cortejo, entrada de la novia, Señor ten piedad, Gloria
- **Liturgia de la Palabra**: salmo responsorial, aleluya
- **Rito del Matrimonio**: anillos, arras, oración de los fieles
- **Liturgia Eucarística**: ofertorio, Santo, aclamación, Padre Nuestro, paz, Cordero de Dios, comunión, acción de gracias
- **Ritos finales**: saludo a la Virgen, firma de los testigos, salida

Los momentos marcados como *opcional* se pueden omitir (⊘). Los momentos hablados (lecturas, votos, bendición) aparecen como referencia del orden.

Arrastrar y soltar con [SortableJS](https://github.com/SortableJS/Sortable) (MIT, incluido como `sortable.min.js`).
