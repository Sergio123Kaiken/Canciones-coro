/* Organizador de canciones para la misa de matrimonio
 * - Banco de canciones (links de Spotify o texto libre)
 * - Estructura de la misa católica (rito de matrimonio dentro de la misa, uso habitual en Chile)
 * - Arrastrar y soltar con SortableJS
 * - Reproducción en orden con la Spotify iFrame API
 * - Búsqueda opcional en Spotify (requiere un Client ID propio, flujo PKCE)
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Estructura de la misa
  // music:false → momento sin canto (se muestra como referencia del orden)
  // optional:true → momento que muchas parejas omiten; se puede ocultar
  // ---------------------------------------------------------------------------
  const MASS = [
    {
      id: 'iniciales', name: 'Ritos iniciales', moments: [
        { id: 'entrada-novio', name: 'Entrada del novio', hint: 'Con sus padres o padrinos. Suele ser instrumental.', optional: true },
        { id: 'entrada-cortejo', name: 'Entrada del cortejo', hint: 'Pajes, damas de honor y padrinos.', optional: true },
        { id: 'entrada-novia', name: 'Entrada de la novia', hint: 'El momento más esperado. Ej.: Canon de Pachelbel, Ave María, Jesús alegría de los hombres.' },
        { id: 'saludo', name: 'Saludo del sacerdote', music: false },
        { id: 'piedad', name: 'Señor, ten piedad', hint: 'Acto penitencial cantado.' },
        { id: 'gloria', name: 'Gloria', hint: 'Himno de alabanza.' },
      ],
    },
    {
      id: 'palabra', name: 'Liturgia de la Palabra', moments: [
        { id: 'lectura1', name: 'Primera lectura', music: false },
        { id: 'salmo', name: 'Salmo responsorial', hint: 'Ej.: “El Señor es mi pastor”, “Dichosos los que temen al Señor”.' },
        { id: 'lectura2', name: 'Segunda lectura', music: false },
        { id: 'aleluya', name: 'Aclamación al Evangelio (Aleluya)', hint: 'Se canta de pie antes del Evangelio.' },
        { id: 'evangelio', name: 'Evangelio y homilía', music: false },
      ],
    },
    {
      id: 'matrimonio', name: 'Rito del Matrimonio', moments: [
        { id: 'consentimiento', name: 'Consentimiento (los votos)', music: false },
        { id: 'anillos', name: 'Bendición y entrega de anillos', hint: 'Música suave de fondo.' },
        { id: 'arras', name: 'Entrega de las arras', hint: 'Música suave de fondo.', optional: true },
        { id: 'fieles', name: 'Oración de los fieles', hint: 'Respuesta cantada, ej.: “Te rogamos, óyenos”.', optional: true },
      ],
    },
    {
      id: 'eucaristia', name: 'Liturgia Eucarística', moments: [
        { id: 'ofertorio', name: 'Ofertorio (presentación de las ofrendas)', hint: 'Ej.: “Te presentamos el vino y el pan”, “Bendito seas Señor”.' },
        { id: 'santo', name: 'Santo', hint: 'Canto del Sanctus.' },
        { id: 'memorial', name: 'Aclamación memorial', hint: '“Anunciamos tu muerte…”', optional: true },
        { id: 'padrenuestro', name: 'Padre Nuestro', hint: 'Cantado o rezado.', optional: true },
        { id: 'paz', name: 'Saludo de la paz', hint: 'Ej.: “La paz esté con nosotros”.', optional: true },
        { id: 'cordero', name: 'Cordero de Dios', hint: 'Agnus Dei.' },
        { id: 'comunion', name: 'Comunión', hint: 'Puede durar varias canciones. Ej.: “Pescador de hombres”, “Alma misionera”, “Pan de vida”.' },
        { id: 'accion-gracias', name: 'Acción de gracias', hint: 'Después de la comunión, momento de silencio o canto tranquilo.', optional: true },
      ],
    },
    {
      id: 'finales', name: 'Ritos finales', moments: [
        { id: 'bendicion', name: 'Bendición final', music: false },
        { id: 'virgen', name: 'Saludo a la Virgen', hint: 'Muy tradicional en Chile: los novios llevan flores a la Virgen. Ej.: Ave María (Schubert o Gounod).' },
        { id: 'firma', name: 'Firma de los testigos', hint: 'Firma del acta / libreta. Música instrumental de fondo.' },
        { id: 'salida', name: 'Salida de los novios', hint: 'Alegre y triunfal. Ej.: Marcha nupcial de Mendelssohn, Oda a la alegría.' },
      ],
    },
  ];

  const STORAGE_KEY = 'misa-matrimonio-v1';
  const $ = (sel, root = document) => root.querySelector(sel);

  // ---------------------------------------------------------------------------
  // Estado
  // song = { uid, sid (spotify track id | null), title, artist, thumb }
  // ---------------------------------------------------------------------------
  let state = loadState();

  function blankState() {
    const moments = {};
    MASS.forEach(s => s.moments.forEach(m => {
      if (m.music !== false) moments[m.id] = { songs: [], chosen: null, note: '', hidden: false };
    }));
    return { title: 'Nuestra misa de matrimonio', bank: [], moments, playMode: 'chosen' };
  }

  function normalize(s) {
    const base = blankState();
    if (!s || typeof s !== 'object') return base;
    base.title = s.title || base.title;
    base.bank = Array.isArray(s.bank) ? s.bank.filter(Boolean) : [];
    base.playMode = s.playMode === 'all' ? 'all' : 'chosen';
    Object.keys(base.moments).forEach(id => {
      const m = s.moments && s.moments[id];
      if (m) Object.assign(base.moments[id], {
        songs: Array.isArray(m.songs) ? m.songs.filter((x, i, arr) => x && arr.findIndex(y => y && songKey(y) === songKey(x)) === i) : [],
        chosen: m.chosen || null, note: m.note || '', hidden: !!m.hidden,
      });
    });
    return base;
  }

  function loadState() {
    const fromHash = readHash();
    if (fromHash) return fromHash;
    try { return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
    catch { return blankState(); }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ }
  }

  function readHash() {
    const m = location.hash.match(/^#plan=(.+)$/);
    if (!m) return null;
    try {
      const json = decodeURIComponent(escape(atob(decodeURIComponent(m[1]))));
      const s = normalize(JSON.parse(json));
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(() => toast('Plan cargado desde el enlace compartido'), 300);
      return s;
    } catch { return null; }
  }

  const uid = () => Math.random().toString(36).slice(2, 10);
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  // Identidad de una canción: el track de Spotify, o el texto si es una canción sin link
  const songKey = s => s.sid ? `sp:${s.sid}` : `t:${norm(s.title)}`;
  // Misma canción publicada con distinto ID (single, álbum, recopilación…)
  const nameKey = s => (s.artist && s.title && s.title !== 'Cargando…') ? `n:${norm(s.title)}|${norm(s.artist)}` : null;

  // Quita del banco canciones repetidas (mismo link, mismo texto, o mismo nombre y artista)
  function dedupeBank() {
    const seen = new Set();
    const before = state.bank.length;
    state.bank = state.bank.filter(s => {
      const keys = [songKey(s), nameKey(s)].filter(Boolean);
      if (keys.some(k => seen.has(k))) return false;
      keys.forEach(k => seen.add(k));
      return true;
    });
    return before - state.bank.length;
  }
  const inBank = s => { const k = songKey(s), n = nameKey(s); return state.bank.some(b => songKey(b) === k || (n && nameKey(b) === n)); };
  const inMoment = (id, s, exceptUid) => state.moments[id].songs.some(x => x.uid !== exceptUid && songKey(x) === songKey(s));
  const copySong = s => ({ ...s, uid: uid() });

  function findSong(u) {
    const b = state.bank.find(s => s.uid === u);
    if (b) return { song: b, where: 'bank' };
    for (const id in state.moments) {
      const s = state.moments[id].songs.find(x => x.uid === u);
      if (s) return { song: s, where: id };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Spotify: parseo de links y metadatos
  // ---------------------------------------------------------------------------
  function parseSpotify(text) {
    const m = text.match(/(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?|spotify:)(track|playlist|album)[/:]([A-Za-z0-9]{22})/);
    return m ? { type: m[1], id: m[2] } : null;
  }

  async function oembed(type, id) {
    try {
      const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/${type}/${id}`)}`);
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      return { title: j.title || '', thumb: j.thumbnail_url || '' };
    } catch { return null; }
  }

  async function addFromInput(raw) {
    const parts = raw.split(/\s+(?=https?:|spotify:)|\n+/).map(s => s.trim()).filter(Boolean);
    const fresh = [];
    let dupes = 0;
    $('#playlist-help').hidden = true;
    for (const part of parts) {
      const sp = parseSpotify(part);
      if (!sp) { // texto libre (coro en vivo, etc.)
        const song = { uid: uid(), sid: null, title: part, artist: 'Coro / en vivo', thumb: '' };
        if (inBank(song)) { dupes++; continue; }
        state.bank.push(song);
        continue;
      }
      if (sp.type === 'track') {
        if (inBank({ sid: sp.id })) { dupes++; continue; }
        const song = { uid: uid(), sid: sp.id, title: 'Cargando…', artist: '', thumb: '' };
        state.bank.push(song);
        fresh.push(song);
      } else if (spotifyAuth.hasSession()) {
        const tracks = await spotifyAuth.listTracks(sp.type, sp.id);
        let n = 0;
        tracks.forEach(t => { if (!inBank(t)) { state.bank.push(t); n++; } else dupes++; });
        toast(`Importadas ${n} canciones`);
      } else {
        $('#playlist-help').hidden = false;
      }
    }
    const skipped = dupes ? ` · ${dupes} ya ${dupes > 1 ? 'estaban' : 'estaba'} en el banco (no se repiten)` : '';
    if (fresh.length > 1 || (fresh.length && dupes)) toast(`${fresh.length} ${fresh.length > 1 ? 'canciones agregadas' : 'canción agregada'}${skipped}`);
    else if (dupes && !fresh.length) toast(dupes > 1 ? `Esas ${dupes} canciones ya están en el banco` : 'Esa canción ya está en el banco');
    save(); render();
    if (fresh.length) fillMetadata(fresh);
  }

  async function fillMetadata(songs) {
    const ids = songs.filter(s => s.sid).map(s => s.sid);
    if (!ids.length) return;
    let meta = {};
    if (spotifyAuth.token()) meta = await spotifyAuth.tracks(ids);
    await Promise.all(songs.map(async s => {
      if (meta[s.sid]) return Object.assign(s, meta[s.sid], { uid: s.uid });
      const o = await oembed('track', s.sid);
      if (o) Object.assign(s, { title: o.title, thumb: o.thumb });
      else if (s.title === 'Cargando…') s.title = 'Canción de Spotify';
    }));
    // con el nombre y artista ya cargados se detectan repetidas con otro link
    const removed = dedupeBank();
    if (removed) toast(`${removed} ${removed > 1 ? 'canciones repetidas quitadas' : 'canción repetida quitada'} del banco`);
    save(); render();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const bankList = $('#bank-list');
  const massEl = $('#mass');

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function songHTML(song, ctx) {
    const inMoment = ctx !== 'bank';
    const chosen = inMoment && state.moments[ctx].chosen === song.uid;
    const thumb = song.thumb
      ? `<img src="${esc(song.thumb)}" alt="" loading="lazy" />`
      : `<span class="thumb-ph">${song.sid ? '♪' : '🎤'}</span>`;
    const addSelect = !inMoment ? `
      <select class="add-to" data-act="add-to" title="Agregar a un momento">
        <option value="">＋</option>
        ${MASS.map(s => `<optgroup label="${esc(s.name)}">${s.moments.filter(m => m.music !== false).map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</optgroup>`).join('')}
      </select>` : '';
    return `
      <li class="song${chosen ? ' chosen' : ''}${song.sid ? '' : ' manual'}" data-uid="${song.uid}">
        <span class="grip" aria-hidden="true">⋮⋮</span>
        <div class="thumb">${thumb}</div>
        <div class="meta">
          <span class="title">${esc(song.title)}</span>
          <span class="artist">${esc(song.artist || (song.sid ? 'Spotify' : ''))}</span>
        </div>
        <div class="song-actions">
          ${song.sid ? `<button class="mini" data-act="play" title="Escuchar">▶</button>` : ''}
          ${inMoment ? `<button class="mini star" data-act="choose" title="${chosen ? 'Quitar como elegida' : 'Marcar como elegida'}">${chosen ? '★' : '☆'}</button>` : ''}
          ${addSelect}
          <button class="mini" data-act="edit" title="Editar nombre">✎</button>
          ${song.sid ? `<a class="mini" href="https://open.spotify.com/track/${song.sid}" target="_blank" rel="noopener" title="Abrir en Spotify">↗</a>` : ''}
          <button class="mini" data-act="remove" title="Quitar">✕</button>
        </div>
      </li>`;
  }

  function render() {
    $('#mass-title').textContent = state.title;
    document.title = state.title;

    // Banco
    const f = $('#bank-filter').value.trim().toLowerCase();
    const bank = f ? state.bank.filter(s => `${s.title} ${s.artist}`.toLowerCase().includes(f)) : state.bank;
    bankList.innerHTML = bank.map(s => songHTML(s, 'bank')).join('');
    $('#bank-count').textContent = `${state.bank.length} ${state.bank.length === 1 ? 'canción' : 'canciones'}`;
    $('#empty-bank').hidden = state.bank.length > 0;

    // Misa
    let n = 0;
    let filled = 0, total = 0;
    massEl.innerHTML = MASS.map(section => `
      <div class="section">
        <h2 class="section-title">${esc(section.name)}</h2>
        <ol class="moments">
          ${section.moments.map(m => {
            if (m.music === false) return `<li class="moment spoken"><span class="spoken-dot"></span>${esc(m.name)}</li>`;
            const st = state.moments[m.id];
            if (st.hidden) return `<li class="moment hidden-moment"><span>${esc(m.name)} <em>(omitido)</em></span><button class="link" data-act="unhide" data-moment="${m.id}">Incluir</button></li>`;
            n++; total++;
            if (st.songs.length) filled++;
            return `
              <li class="moment${st.songs.length ? ' has-songs' : ''}" data-moment="${m.id}">
                <div class="moment-head">
                  <span class="num">${n}</span>
                  <div class="moment-title">
                    <h3>${esc(m.name)}${m.optional ? ' <span class="tag">opcional</span>' : ''}</h3>
                    <p class="hint">${esc(m.hint || '')}</p>
                  </div>
                  <div class="moment-actions">
                    ${st.songs.some(s => s.sid) ? `<button class="mini" data-act="play-moment" data-moment="${m.id}" title="Escuchar este momento">▶</button>` : ''}
                    ${m.optional ? `<button class="mini" data-act="hide" data-moment="${m.id}" title="Omitir este momento">⊘</button>` : ''}
                  </div>
                </div>
                <ul class="song-list moment-list" data-moment="${m.id}">
                  ${st.songs.map(s => songHTML(s, m.id)).join('')}
                </ul>
                ${st.songs.length > 1 && !st.chosen ? '<p class="decide">Varias opciones: marca con ☆ la elegida.</p>' : ''}
                <input class="note" data-moment="${m.id}" placeholder="Notas (ej.: la canta el coro en vivo, solo instrumental…)" value="${esc(st.note)}" />
              </li>`;
          }).join('')}
        </ol>
      </div>`).join('') + `
      <div class="progress">
        <div class="bar"><span style="width:${total ? Math.round(filled / total * 100) : 0}%"></span></div>
        <p>${filled} de ${total} momentos con canciones</p>
        <label class="mode">Al escuchar en orden:
          <select id="play-mode">
            <option value="chosen"${state.playMode === 'chosen' ? ' selected' : ''}>solo la elegida (o la primera) de cada momento</option>
            <option value="all"${state.playMode === 'all' ? ' selected' : ''}>todas las candidatas</option>
          </select>
        </label>
      </div>`;

    markPlaying();
    initSortables();
  }

  // ---------------------------------------------------------------------------
  // Drag & drop
  // ---------------------------------------------------------------------------
  let sortables = [];
  function initSortables() {
    sortables.forEach(s => s.destroy());
    sortables = [];
    const common = { animation: 160, forceFallback: true, fallbackOnBody: true, fallbackTolerance: 4, scrollSensitivity: 80, bubbleScroll: true, ghostClass: 'ghost', chosenClass: 'dragging', delay: 120, delayOnTouchOnly: true, filter: 'select,button,a', preventOnFilter: false, onEnd: syncFromDOM };
    sortables.push(Sortable.create(bankList, { ...common, group: { name: 'songs', pull: 'clone', put: false }, sort: !$('#bank-filter').value, onEnd: syncFromDOM }));
    massEl.querySelectorAll('.moment-list').forEach(el => {
      sortables.push(Sortable.create(el, { ...common, group: { name: 'songs', pull: true, put: true }, emptyInsertThreshold: 24 }));
    });
  }

  function syncFromDOM() {
    // Reconstruye el estado desde el orden del DOM. Lo que llega desde el banco se copia.
    const lookup = {};
    let rejected = false;
    state.bank.forEach(s => lookup[s.uid] = { song: s, bank: true });
    Object.values(state.moments).forEach(m => m.songs.forEach(s => lookup[s.uid] = { song: s }));

    if (!$('#bank-filter').value) {
      state.bank = [...bankList.children].map(li => lookup[li.dataset.uid]?.song).filter(Boolean);
    }
    massEl.querySelectorAll('.moment-list').forEach(el => {
      const id = el.dataset.moment;
      const seen = new Set();
      state.moments[id].songs = [...el.children].map(li => {
        const hit = lookup[li.dataset.uid];
        if (!hit) return null;
        const k = songKey(hit.song);
        if (seen.has(k)) { rejected = true; return null; }
        seen.add(k);
        return hit.bank ? copySong(hit.song) : hit.song;
      }).filter(Boolean);
    });
    // Si la canción elegida salió de un momento, se limpia la marca
    Object.values(state.moments).forEach(m => {
      if (m.chosen && !m.songs.some(s => s.uid === m.chosen)) m.chosen = null;
    });
    if (rejected) toast('Esa canción ya está en ese momento de la misa');
    save();
    setTimeout(render, 0);
  }

  // ---------------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------------
  $('#add-form').addEventListener('submit', async e => {
    e.preventDefault();
    const input = $('#add-input');
    const v = input.value.trim();
    if (!v) return;
    input.value = '';
    await addFromInput(v);
  });
  $('#add-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#add-form').requestSubmit(); }
  });
  $('#add-input').addEventListener('paste', () => setTimeout(() => {
    if (parseSpotify($('#add-input').value)) $('#add-form').requestSubmit();
  }, 0));

  $('#bank-filter').addEventListener('input', render);

  $('#mass-title').addEventListener('blur', e => {
    state.title = e.target.textContent.trim() || 'Nuestra misa de matrimonio';
    save(); render();
  });
  $('#mass-title').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });

  document.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('[data-act="add-to"]') && t.value) {
      const u = t.closest('.song').dataset.uid;
      const hit = findSong(u);
      const target = state.moments[t.value];
      const name = momentName(t.value);
      if (inMoment(t.value, hit.song)) { t.value = ''; return toast(`Ya está en “${name}”`); }
      target.songs.push(copySong(hit.song));
      if (target.hidden) target.hidden = false;
      save(); render();
      toast(`Agregada a “${name}”`);
    }
    if (t.id === 'play-mode') { state.playMode = t.value; save(); }
  });

  document.addEventListener('input', e => {
    if (e.target.matches('.note')) { state.moments[e.target.dataset.moment].note = e.target.value; save(); }
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.tagName === 'SELECT') return;
    const act = btn.dataset.act;
    const li = btn.closest('.song');
    const u = li?.dataset.uid;
    const momentId = btn.dataset.moment || btn.closest('.moment-list')?.dataset.moment;

    if (act === 'play') {
      const q = buildQueue();
      const idx = q.findIndex(x => x.song.uid === u);
      if (idx >= 0) player.start(q, idx);
      else { const hit = findSong(u); player.start([{ song: hit.song, moment: hit.where === 'bank' ? 'Banco de canciones' : momentName(hit.where) }], 0); }
    }
    if (act === 'play-moment') {
      const songs = state.moments[momentId].songs.filter(s => s.sid);
      player.start(songs.map(s => ({ song: s, moment: momentName(momentId) })), 0);
    }
    if (act === 'choose') {
      const m = state.moments[momentId];
      m.chosen = m.chosen === u ? null : u;
      // la elegida sube al primer lugar
      if (m.chosen) m.songs.sort((a, b) => (b.uid === m.chosen) - (a.uid === m.chosen));
      save(); render();
    }
    if (act === 'remove') {
      if (momentId) {
        const m = state.moments[momentId];
        m.songs = m.songs.filter(s => s.uid !== u);
        if (m.chosen === u) m.chosen = null;
      } else {
        state.bank = state.bank.filter(s => s.uid !== u);
      }
      save(); render();
    }
    if (act === 'edit') {
      const { song } = findSong(u);
      const title = prompt('Nombre de la canción', song.title);
      if (title === null) return;
      const artist = prompt('Artista / intérprete', song.artist || '');
      song.title = title.trim() || song.title;
      if (artist !== null) song.artist = artist.trim();
      save(); render();
    }
    if (act === 'hide') { state.moments[momentId].hidden = true; save(); render(); }
    if (act === 'unhide') { state.moments[momentId].hidden = false; save(); render(); }
  });

  const momentName = id => MASS.flatMap(s => s.moments).find(m => m.id === id)?.name || '';

  // ---------------------------------------------------------------------------
  // Recomendar un orden con las canciones del banco
  // 1) Cantos litúrgicos por palabras clave (Santo, Cordero, Gloria, Ave María…)
  // 2) Canciones reconocibles de boda (Pachelbel, Mendelssohn, Wagner…)
  // 3) El resto se reparte en los momentos "libres" respetando el orden del banco
  //    (que suele ser el orden de la playlist)
  // ---------------------------------------------------------------------------
  const RULES = [
    { id: 'piedad', max: 2, words: ['senor ten piedad', 'senor, ten piedad', 'ten piedad', 'kyrie', 'piedad'] },
    { id: 'gloria', max: 2, words: ['gloria a dios', 'gloria in excelsis', 'gloria'] },
    { id: 'salmo', max: 2, words: ['salmo', 'psalm', 'el senor es mi pastor', 'mi pastor', 'dichosos'] },
    { id: 'aleluya', max: 2, words: ['aleluya', 'alleluia', 'aclamacion al evangelio'] },
    { id: 'fieles', max: 1, words: ['te rogamos', 'oyenos'] },
    { id: 'ofertorio', max: 2, words: ['ofertorio', 'ofrenda', 'ofrecemos', 'te presento', 'te presentamos', 'bendito seas', 'pan y vino', 'el vino y el pan', 'acepta senor'] },
    { id: 'santo', max: 2, words: ['santo, santo', 'santo santo', 'sanctus', 'hosanna', 'santo es el senor', 'santo'] },
    { id: 'memorial', max: 1, words: ['anunciamos tu muerte', 'memorial'] },
    { id: 'padrenuestro', max: 1, words: ['padre nuestro', 'padrenuestro', 'our father', 'pater noster'] },
    { id: 'paz', max: 1, words: ['la paz', 'de paz', 'paz'] },
    { id: 'cordero', max: 2, words: ['cordero de dios', 'agnus dei', 'cordero'] },
    { id: 'comunion', max: 5, words: ['comunion', 'pescador de hombres', 'alma misionera', 'pan de vida', 'pan del cielo', 'cuerpo de cristo', 'vaso nuevo', 'no adoreis', 'ven a mi', 'tu palabra', 'yo soy el pan', 'panis angelicus', 'jesus', 'cristo', 'ubi caritas'] },
    { id: 'accion-gracias', max: 2, words: ['gracias', 'magnificat', 'cuan grande es el', 'how great thou art', 'hallelujah', 'amazing grace', 'sublime gracia'] },
    { id: 'virgen', max: 3, words: ['ave maria', 'salve regina', 'salve', 'virgen', 'maria', 'madre', 'mother mary'] },
    { id: 'entrada-novia', max: 3, words: ['pachelbel', 'canon in d', 'canon en re', 'canon', 'bridal chorus', 'lohengrin', 'wagner', 'here comes the bride', 'jesu, joy', 'jesu joy', 'jesus alegria', 'a thousand years', 'can\'t help falling', 'perfect', 'marry me', 'wedding'] },
    { id: 'entrada-novio', max: 1, words: ['trumpet voluntary', 'prince of denmark', 'clarke', 'queen of sheba', 'reina de saba', 'trumpet tune', 'la rejouissance'] },
    { id: 'firma', max: 3, words: ['vivaldi', 'primavera', 'spring', 'air on the g', 'aria', 'arioso', 'mozart', 'minuet', 'minueto', 'serenata', 'claro de luna', 'clair de lune', 'bach', 'handel', 'haendel', 'violin', 'piano', 'instrumental', 'cello'] },
    { id: 'salida', max: 2, words: ['marcha nupcial', 'wedding march', 'mendelssohn', 'oda a la alegria', 'ode to joy', 'himno a la alegria', 'beethoven', 'celebra', 'all you need is love', 'signed, sealed', 'marry you', 'happy', 'alegria'] },
  ];
  // Momentos que admiten cualquier canción, en el orden en que se rellenan si sobran canciones
  const FLEXIBLE = ['entrada-novia', 'salida', 'firma', 'anillos', 'comunion', 'accion-gracias', 'entrada-novio', 'entrada-cortejo', 'arras', 'ofertorio', 'virgen'];
  const MASS_ORDER = MASS.flatMap(sec => sec.moments.map(m => m.id));

  function scoreSong(song) {
    const text = ` ${norm(`${song.title} ${song.artist}`)} `;
    const scores = [];
    RULES.forEach((r, ri) => {
      r.words.forEach((w, wi) => {
        const re = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`);
        // las frases más largas y las primeras de la lista pesan más
        if (re.test(text)) scores.push({ id: r.id, score: w.length * 2 + (r.words.length - wi), ri });
      });
    });
    // mejor coincidencia por momento
    const best = {};
    scores.forEach(x => { if (!best[x.id] || best[x.id].score < x.score) best[x.id] = x; });
    return Object.values(best).sort((a, b) => b.score - a.score);
  }

  function recommend() {
    const pool = state.bank.filter(s => s.title !== 'Cargando…');
    const plan = {};
    MASS_ORDER.forEach(id => { if (state.moments[id]) plan[id] = []; });
    const maxOf = id => RULES.find(r => r.id === id)?.max ?? 1;
    const used = new Set();

    // 1 y 2: por palabras clave, primero las coincidencias más fuertes
    const matches = [];
    pool.forEach((song, order) => scoreSong(song).forEach((m, rank) => matches.push({ song, order, rank, ...m })));
    matches.sort((a, b) => a.rank - b.rank || b.score - a.score || a.order - b.order);
    matches.forEach(m => {
      if (used.has(m.song.uid) || !plan[m.id] || plan[m.id].length >= maxOf(m.id)) return;
      plan[m.id].push(m.song); used.add(m.song.uid);
    });

    // 3: las canciones sin coincidencia se reparten en los momentos libres vacíos,
    //    manteniendo el orden del banco (= orden de la playlist)
    let rest = pool.filter(s => !used.has(s.uid));
    const empty = MASS_ORDER.filter(id => FLEXIBLE.includes(id) && plan[id] && !plan[id].length);
    empty.forEach(id => { if (rest.length) { const s = rest.shift(); plan[id].push(s); used.add(s.uid); } });
    // si todavía sobran, quedan como alternativas en los momentos libres
    const extraSlots = { 'comunion': 5, 'entrada-novia': 3, 'salida': 3, 'firma': 3, 'anillos': 2, 'accion-gracias': 2 };
    let guard = 0;
    while (rest.length && guard++ < 50) {
      let placed = false;
      for (const id of Object.keys(extraSlots)) {
        if (!rest.length) break;
        if (plan[id].length < extraSlots[id]) { plan[id].push(rest.shift()); placed = true; }
      }
      if (!placed) break;
    }
    return { plan, leftover: rest.length };
  }

  $('#recommend').addEventListener('click', () => {
    const ready = state.bank.filter(s => s.title !== 'Cargando…');
    if (!ready.length) return toast('Primero agrega canciones al banco');
    const hasPlan = Object.values(state.moments).some(m => m.songs.length);
    if (hasPlan && !confirm('Se reemplazará el orden actual de la misa por una recomendación. Podrás deshacerlo. ¿Continuar?')) return;
    const backup = JSON.stringify(state);
    const { plan, leftover } = recommend();
    let filled = 0;
    Object.entries(plan).forEach(([id, songs]) => {
      const m = state.moments[id];
      m.songs = songs.map(copySong);
      m.chosen = null;
      if (songs.length) { m.hidden = false; filled++; }
    });
    save(); render();
    massEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast(`Orden sugerido en ${filled} momentos${leftover ? ` · ${leftover} canciones quedaron solo en el banco` : ''}`, {
      label: 'Deshacer', run: () => { state = normalize(JSON.parse(backup)); save(); render(); },
    });
  });

  // Menú
  $('#play-all').addEventListener('click', () => {
    const q = buildQueue();
    if (!q.length) return toast('Primero arrastra canciones de Spotify a los momentos de la misa');
    player.start(q, 0);
  });
  $('#share-link').addEventListener('click', async () => {
    const data = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    const url = `${location.origin}${location.pathname}#plan=${encodeURIComponent(data)}`;
    try { await navigator.clipboard.writeText(url); toast('Enlace copiado. Quien lo abra verá este plan.'); }
    catch { prompt('Copia este enlace:', url); }
    closeMenu();
  });
  $('#export-json').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'canciones-misa.json' });
    a.click(); URL.revokeObjectURL(a.href); closeMenu();
  });
  $('#import-json').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try { state = normalize(JSON.parse(await file.text())); save(); render(); toast('Respaldo cargado'); }
    catch { toast('No se pudo leer el archivo'); }
    e.target.value = ''; closeMenu();
  });
  $('#print').addEventListener('click', () => { closeMenu(); window.print(); });
  $('#reset').addEventListener('click', () => {
    if (!confirm('¿Borrar todas las canciones y empezar de cero?')) return;
    state = blankState(); save(); render(); closeMenu();
  });
  const closeMenu = () => $('.menu').removeAttribute('open');
  document.addEventListener('click', e => { if (!e.target.closest('.menu')) closeMenu(); });

  let toastTimer;
  function toast(msg, action) {
    const t = $('#toast');
    t.textContent = msg;
    if (action) {
      const b = Object.assign(document.createElement('button'), { className: 'toast-action', textContent: action.label });
      b.addEventListener('click', () => { t.classList.remove('show'); action.run(); });
      t.append(b);
    }
    t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), action ? 8000 : 3200);
  }

  // ---------------------------------------------------------------------------
  // Reproductor en orden
  // ---------------------------------------------------------------------------
  function buildQueue() {
    const q = [];
    MASS.forEach(section => section.moments.forEach(m => {
      const st = state.moments[m.id];
      if (!st || st.hidden) return;
      const songs = st.songs.filter(s => s.sid);
      if (!songs.length) return;
      const pick = state.playMode === 'all' ? songs : [songs.find(s => s.uid === st.chosen) || songs[0]];
      pick.forEach(s => q.push({ song: s, moment: m.name }));
    }));
    return q;
  }

  function markPlaying() {
    document.querySelectorAll('.song.playing').forEach(el => el.classList.remove('playing'));
    const cur = player.current();
    if (cur) document.querySelectorAll(`.song[data-uid="${cur.song.uid}"]`).forEach(el => el.classList.add('playing'));
  }

  const player = (() => {
    let api = null, controller = null, queue = [], idx = -1, pendingPlay = false, advanced = false, fallbackTimer;
    const el = $('#player');

    window.onSpotifyIframeApiReady = IFrameAPI => { api = IFrameAPI; };

    function ensureController(uri, cb) {
      if (controller) { cb(); return; }
      if (!api) { // la API aún no carga: iframe simple
        $('#embed').innerHTML = `<iframe src="https://open.spotify.com/embed/track/${uri.split(':').pop()}?utm_source=generator" width="100%" height="80" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
        return;
      }
      api.createController($('#embed'), { uri, width: '100%', height: 80 }, c => {
        controller = c;
        c.addListener('ready', () => { if (pendingPlay) { pendingPlay = false; c.play(); } });
        c.addListener('playback_update', e => {
          const { isPaused, position, duration } = e.data;
          if (!isPaused && position > 0) advanced = false;
          if (!advanced && duration > 0 && position >= duration - 900 && $('#autoplay').checked) {
            advanced = true;
            setTimeout(next, 700);
          }
        });
        cb();
      });
    }

    function load(i) {
      if (i < 0 || i >= queue.length) return;
      idx = i;
      const item = queue[idx];
      const uri = `spotify:track:${item.song.sid}`;
      el.hidden = false;
      document.body.classList.add('with-player');
      $('#now-moment').textContent = `${item.moment} · ${item.song.title}`;
      $('#now-pos').textContent = queue.length > 1 ? `${idx + 1} / ${queue.length}` : '';
      advanced = true;
      const wasNew = !controller;
      ensureController(uri, () => {
        pendingPlay = true;
        if (!wasNew) controller.loadUri(uri);
        clearTimeout(fallbackTimer);
        fallbackTimer = setTimeout(() => { if (pendingPlay) { pendingPlay = false; controller.play(); } }, 1500);
      });
      markPlaying();
      const li = document.querySelector(`.moment-list .song[data-uid="${item.song.uid}"]`);
      li?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function next() { if (idx < queue.length - 1) load(idx + 1); else toast('Fin de la misa 💍'); }
    function prev() { if (idx > 0) load(idx - 1); }

    $('#next').addEventListener('click', next);
    $('#prev').addEventListener('click', prev);
    $('#close-player').addEventListener('click', () => {
      controller?.pause?.();
      el.hidden = true; document.body.classList.remove('with-player');
      queue = []; idx = -1; markPlaying();
    });

    return {
      start(q, i) { queue = q; load(i); },
      current: () => (idx >= 0 ? queue[idx] : null),
    };
  })();

  // ---------------------------------------------------------------------------
  // Búsqueda en Spotify (opcional). Requiere crear una app gratuita en
  // https://developer.spotify.com/dashboard y registrar esta página como Redirect URI.
  // ---------------------------------------------------------------------------
  const spotifyAuth = (() => {
    const K = { client: 'sp-client-id', token: 'sp-token', verifier: 'sp-verifier' };
    const redirectUri = location.origin + location.pathname;
    const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
    const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { } };

    function token() {
      try {
        const t = JSON.parse(get(K.token));
        return t && t.expires > Date.now() ? t.access : null;
      } catch { return null; }
    }

    async function refresh() {
      try {
        const t = JSON.parse(get(K.token));
        if (!t?.refresh) return null;
        const r = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: get(K.client) }),
        });
        if (!r.ok) return null;
        storeToken(await r.json(), t.refresh);
        return token();
      } catch { return null; }
    }

    function storeToken(j, oldRefresh) {
      set(K.token, JSON.stringify({ access: j.access_token, refresh: j.refresh_token || oldRefresh, expires: Date.now() + (j.expires_in - 60) * 1000 }));
    }

    const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    async function login(clientId) {
      set(K.client, clientId);
      const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
      set(K.verifier, verifier);
      const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
      const q = new URLSearchParams({
        client_id: clientId, response_type: 'code', redirect_uri: redirectUri,
        code_challenge_method: 'S256', code_challenge: challenge,
        scope: 'playlist-read-private playlist-read-collaborative',
      });
      location.href = `https://accounts.spotify.com/authorize?${q}`;
    }

    async function handleRedirect() {
      const p = new URLSearchParams(location.search);
      if (!p.has('code') && !p.has('error')) return;
      history.replaceState(null, '', redirectUri + location.hash);
      if (p.has('error')) { toast('No se conectó Spotify'); return; }
      try {
        const r = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: redirectUri, client_id: get(K.client), code_verifier: get(K.verifier) }),
        });
        if (!r.ok) throw new Error(await r.text());
        storeToken(await r.json());
        toast('Spotify conectado ✓');
      } catch { toast('Error al conectar Spotify. Revisa el Client ID y el Redirect URI.'); }
    }

    async function api(path) {
      let t = token() || await refresh();
      if (!t) throw new Error('sin sesión');
      const r = await fetch(`https://api.spotify.com/v1/${path}`, { headers: { Authorization: `Bearer ${t}` } });
      if (r.status === 401) { set(K.token, null); renderSearch(); throw new Error('sesión expirada'); }
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }

    const toSong = t => ({ uid: uid(), sid: t.id, title: t.name, artist: t.artists.map(a => a.name).join(', '), thumb: (t.album?.images?.at(-2) || t.album?.images?.[0])?.url || '' });

    async function search(q) { return (await api(`search?type=track&market=CL&limit=12&q=${encodeURIComponent(q)}`)).tracks.items.map(toSong); }
    async function tracks(ids) {
      try {
        const j = await api(`tracks?ids=${ids.slice(0, 50).join(',')}&market=CL`);
        const out = {};
        j.tracks.filter(Boolean).forEach(t => { const s = toSong(t); delete s.uid; out[t.id] = s; });
        return out;
      } catch { return {}; }
    }
    async function listTracks(type, id) {
      try {
        if (type === 'album') {
          const a = await api(`albums/${id}?market=CL`);
          return a.tracks.items.map(t => toSong({ ...t, album: a }));
        }
        const out = [];
        let path = `playlists/${id}/tracks?limit=100&market=CL`;
        while (path && out.length < 300) {
          const j = await api(path);
          j.items.forEach(it => { if (it.track?.id) out.push(toSong(it.track)); });
          path = j.next ? j.next.replace('https://api.spotify.com/v1/', '') : null;
        }
        return out;
      } catch { toast('No se pudo leer esa playlist/álbum'); return []; }
    }

    function hasSession() {
      try { return !!token() || !!JSON.parse(get(K.token))?.refresh; } catch { return false; }
    }

    return { token, hasSession, login, handleRedirect, search, tracks, listTracks, logout: () => set(K.token, null), clientId: () => get(K.client) || '', redirectUri };
  })();

  function renderSearch() {
    const box = $('#spotify-search');
    if (spotifyAuth.hasSession()) {
      box.innerHTML = `
        <form class="search-form" id="search-form">
          <input type="search" id="search-q" placeholder="Buscar en Spotify: Ave María, Pescador de hombres…" />
          <button class="btn" type="submit">Buscar</button>
        </form>
        <ul class="song-list results" id="results"></ul>
        <button class="link small" id="sp-logout">Desconectar Spotify</button>`;
      $('#search-form').addEventListener('submit', async e => {
        e.preventDefault();
        const q = $('#search-q').value.trim();
        if (!q) return;
        const ul = $('#results');
        ul.innerHTML = '<li class="loading">Buscando…</li>';
        try {
          const items = await spotifyAuth.search(q);
          ul.innerHTML = items.map(s => `
            <li class="result" data-sid="${s.sid}">
              <img src="${esc(s.thumb)}" alt="" />
              <div class="meta"><span class="title">${esc(s.title)}</span><span class="artist">${esc(s.artist)}</span></div>
              <button class="mini" data-preview="${s.sid}" title="Escuchar">▶</button>
              <button class="btn small" data-add='${esc(JSON.stringify(s))}'>＋ Banco</button>
            </li>`).join('') || '<li class="loading">Sin resultados</li>';
        } catch (err) { ul.innerHTML = `<li class="loading">Error: ${esc(err.message)}</li>`; }
      });
      $('#results').addEventListener('click', e => {
        const add = e.target.closest('[data-add]');
        if (add) {
          const s = JSON.parse(add.dataset.add);
          if (state.bank.some(b => b.sid === s.sid)) return toast('Ya está en el banco');
          state.bank.push({ ...s, uid: uid() }); save(); render();
          add.textContent = '✓'; add.disabled = true;
        }
        const pv = e.target.closest('[data-preview]');
        if (pv) {
          const li = pv.closest('.result');
          player.start([{ song: { uid: 'preview', sid: pv.dataset.preview, title: li.querySelector('.title').textContent }, moment: 'Vista previa' }], 0);
        }
      });
      $('#sp-logout').addEventListener('click', () => { spotifyAuth.logout(); renderSearch(); });
    } else {
      box.innerHTML = `
        <details class="connect">
          <summary>🔍 ¿Quieres buscar canciones sin salir de aquí? Conecta Spotify</summary>
          <ol>
            <li>Entra a <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">developer.spotify.com/dashboard</a> y crea una app (gratis).</li>
            <li>En <em>Redirect URIs</em> agrega exactamente:<br /><code>${esc(spotifyAuth.redirectUri)}</code></li>
            <li>Marca <em>Web API</em>, guarda y copia el <em>Client ID</em> aquí:</li>
          </ol>
          <form class="search-form" id="connect-form">
            <input id="client-id" placeholder="Client ID" value="${esc(spotifyAuth.clientId())}" />
            <button class="btn" type="submit">Conectar</button>
          </form>
        </details>`;
      $('#connect-form').addEventListener('submit', e => {
        e.preventDefault();
        const id = $('#client-id').value.trim();
        if (id) spotifyAuth.login(id);
      });
    }
  }

  // ---------------------------------------------------------------------------
  (async () => {
    await spotifyAuth.handleRedirect();
    if (dedupeBank()) save();
    renderSearch();
    render();
    // Completa metadatos que hayan quedado pendientes
    const pending = [...state.bank, ...Object.values(state.moments).flatMap(m => m.songs)].filter(s => s.sid && (s.title === 'Cargando…' || !s.thumb));
    if (pending.length) fillMetadata(pending);
  })();
})();
