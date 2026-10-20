import { RATIO_BASE, ZOOM_MIN, ZOOM_MAX, CALIDAD_RECORTE, clampZoom, rectDeVista, rectCentrado, arrastrar, zoomEn, tamanoSalida } from './recorte.js';

// ══════════════════════════════════════════
// RECORTE DE FOTOS — pantalla (arrastrar + zoom con dedo o mouse, vistas previas en vivo, recorte con canvas).
// Los cálculos están en recorte.js; los estilos en recorte.css. fotos-ui.js la abre al elegir fotos (recorteAbrir) y
// recibe el resultado con fotosAplicarRecorte / fotosUsarOriginal. El original nunca se modifica ni se sube si se recorta.
// Si el recorte falla o se cancela, la foto queda como "original" y se sube como siempre.
// ══════════════════════════════════════════
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let items = []; // [{ id, file, thumb, recorte: undefined | 'recortada' | 'original' }] (mismos objetos que usa fotos-ui.js)
let k = 0; // foto que se está viendo
let fuente = null; // imagen decodificada (ya con la orientación EXIF aplicada)
let dim = { w: 0, h: 0 };
let vista = { zoom: 1, cx: 0, cy: 0 };
const guardado = new Map(); // id → vista (para volver a una foto y encontrarla como la dejaste)
let token = 0; // evita que una foto lenta pise a la siguiente
let ocupado = false;
const punteros = new Map();
let pellizco = null;

// ── Armado de la pantalla (una sola vez) ──
function armar() {
  if ($('recorte-modal')) return;
  const d = document.createElement('div');
  d.className = 'overlay'; d.id = 'recorte-modal';
  d.innerHTML = `<div class="modal rc-modal">
    <button class="modal-close" onclick="recorteCancelar()" title="Cerrar">✕</button>
    <div class="modal-title" id="rc-titulo">Recortar foto</div>
    <div class="rc-sub" id="rc-sub"></div>
    <div class="rc-cuerpo">
      <div class="rc-izq">
        <div class="rc-marco" id="rc-marco"><canvas id="rc-canvas"></canvas><div class="rc-rejilla"></div></div>
        <div class="rc-zoom"><span>−</span><input type="range" id="rc-zoom" min="${ZOOM_MIN}" max="${ZOOM_MAX}" step="0.01" value="1" oninput="recorteZoom(this.value)" aria-label="Zoom"><span>+</span></div>
        <div class="rc-ayuda">Arrastrá la foto para moverla. Zoom con la barra, la rueda del mouse o pellizcando.</div>
      </div>
      <div class="rc-der">
        <div class="rc-prev-t">Así se ve en la tienda</div>
        <div class="rc-previews">
          <div class="rc-prev"><div class="rc-prev-card"><canvas id="rc-p-tarjeta"></canvas></div><span>Tarjeta de la portada</span></div>
          <div class="rc-prev"><div class="rc-prev-ficha"><canvas id="rc-p-ficha"></canvas></div><span>Ficha de producto</span></div>
          <div class="rc-prev"><div class="rc-prev-mini"><canvas id="rc-p-mini"></canvas></div><span>Carrito</span></div>
        </div>
      </div>
    </div>
    <div class="rc-tira" id="rc-tira"></div>
    <div class="rc-msg" id="rc-msg"></div>
    <div class="rc-botones">
      <button class="btn btn-gold rc-btn" id="rc-aplicar" onclick="recorteAplicar()">✂ Aplicar recorte</button>
      <button class="btn btn-outline rc-btn" onclick="recorteOriginal()">Usar sin recortar</button>
      <div class="rc-nav"><button class="btn btn-ghost rc-btn" id="rc-ant" onclick="recorteIr(-1)">◀ Anterior</button><button class="btn btn-ghost rc-btn" id="rc-sig" onclick="recorteIr(1)">Siguiente ▶</button></div>
      <button class="btn btn-outline rc-btn" id="rc-todas" onclick="recorteCentrarTodas()">Centrar automático en todas las que faltan</button>
    </div>
  </div>`;
  document.body.appendChild(d);
  const marco = $('rc-marco');
  marco.addEventListener('pointerdown', alPuntero);
  marco.addEventListener('pointermove', alMover);
  marco.addEventListener('pointerup', alSoltar);
  marco.addEventListener('pointercancel', alSoltar);
  marco.addEventListener('wheel', (e) => { e.preventDefault(); cambiarZoom(vista.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), ...fraccion(e)); }, { passive: false });
}

// ── Decodificar (misma que usa la compresión: respeta la orientación EXIF) ──
async function abrirFuente(file) {
  if (window.fotosDecodificar) return window.fotosDecodificar(file);
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}
const medidas = (f) => ({ w: f.width || f.naturalWidth, h: f.height || f.naturalHeight });

// ── Dibujo ──
function pintar(canvas, rect, lado) {
  const c = canvas; const rw = lado, rh = Math.round(lado / RATIO_BASE);
  if (c.width !== rw) c.width = rw; if (c.height !== rh) c.height = rh;
  c.getContext('2d').drawImage(fuente, rect.x, rect.y, rect.w, rect.h, 0, 0, rw, rh);
}
function dibujar() {
  if (!fuente) return;
  const r = rectDeVista({ ...dim, ...vista });
  const marco = $('rc-marco'); const dpr = Math.min(2, window.devicePixelRatio || 1);
  pintar($('rc-canvas'), r, Math.max(120, Math.round(marco.clientWidth * dpr)));
  pintar($('rc-p-tarjeta'), r, 200); pintar($('rc-p-ficha'), r, 240);
  // Carrito: cuadrado (cover) con el centro del recorte
  const lado = Math.min(r.w, r.h), mini = $('rc-p-mini');
  if (mini.width !== 96) { mini.width = 96; mini.height = 96; }
  mini.getContext('2d').drawImage(fuente, r.x + (r.w - lado) / 2, r.y + (r.h - lado) / 2, lado, lado, 0, 0, 96, 96);
  const z = $('rc-zoom'); if (Number(z.value) !== vista.zoom) z.value = vista.zoom;
  const o = tamanoSalida(r); $('rc-sub').textContent = `Foto ${k + 1} de ${items.length} · archivo final ${o.ancho}×${o.alto} px (4:5)`;
}

// ── Gestos: arrastrar con 1 dedo/mouse, pellizcar con 2, rueda en compu ──
const fraccion = (e) => { const b = $('rc-marco').getBoundingClientRect(); return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]; };
function cambiarZoom(z, fx = 0.5, fy = 0.5) { if (!fuente) return; vista = zoomEn({ ...dim, ...vista }, clampZoom(z), fx, fy); dibujar(); }
function alPuntero(e) {
  if (!fuente) return;
  try { $('rc-marco').setPointerCapture(e.pointerId); } catch (err) { /* puntero ya liberado: no pasa nada */ }
  punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (punteros.size === 2) { const [a, b] = [...punteros.values()]; pellizco = { d: Math.hypot(a.x - b.x, a.y - b.y), z: vista.zoom }; }
}
function alMover(e) {
  const p = punteros.get(e.pointerId); if (!p || !fuente) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (punteros.size === 1) { vista = { ...vista, ...arrastrar({ ...dim, ...vista }, dx, dy, $('rc-marco').clientWidth) }; dibujar(); }
  else if (punteros.size === 2 && pellizco) {
    const [a, b] = [...punteros.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pellizco.d > 0) { const m = $('rc-marco').getBoundingClientRect(); cambiarZoom(pellizco.z * d / pellizco.d, ((a.x + b.x) / 2 - m.left) / m.width, ((a.y + b.y) / 2 - m.top) / m.height); }
  }
}
function alSoltar(e) { punteros.delete(e.pointerId); if (punteros.size < 2) pellizco = null; }
window.recorteZoom = (v) => cambiarZoom(Number(v));

// ── Cargar una foto en la pantalla ──
function mensaje(t, color = 'var(--muted)') { const m = $('rc-msg'); if (m) { m.textContent = t; m.style.color = color; } }
function tira() {
  $('rc-tira').innerHTML = items.map((n, i) => {
    const marca = n.recorte === 'recortada' ? '✓' : n.recorte === 'original' ? '○' : '';
    return `<button class="rc-mini${i === k ? ' act' : ''}" onclick="recorteVer(${i})" title="${n.recorte === 'recortada' ? 'Recortada' : n.recorte === 'original' ? 'Sin recortar' : 'Sin revisar'}"><img src="${esc(n.thumbOriginal || n.thumb)}" alt=""><b>${marca}</b></button>`;
  }).join('');
  $('rc-ant').disabled = k === 0; $('rc-sig').disabled = k === items.length - 1;
  const faltan = items.filter((n) => !n.recorte).length;
  $('rc-todas').style.display = faltan > 1 || (faltan === 1 && !items[k].recorte) ? '' : 'none';
  $('rc-todas').textContent = `Centrar automático en las ${faltan} que faltan`.replace('las 1 que faltan', 'la que falta');
}
async function ver(i) {
  if (ocupado) return;
  guardar(); k = i; const mi = ++token; fuente = null; mensaje('Abriendo foto…'); tira();
  let f;
  try { f = await abrirFuente(items[i].file); }
  catch (e) {
    if (mi !== token) return;
    mensaje('No se pudo abrir esta foto para recortarla. Se subirá la original.', 'var(--warning)');
    window.fotosUsarOriginal?.(items[i]); items[i].recorte = 'original'; tira(); return;
  }
  if (mi !== token) { f.close?.(); return; }
  fuente = f; dim = medidas(f);
  const g = guardado.get(items[i].id);
  vista = g || (() => { const r = rectCentrado(dim.w, dim.h); return { zoom: 1, cx: r.x + r.w / 2, cy: r.y + r.h / 2 }; })();
  mensaje(''); $('rc-titulo').textContent = 'Recortar foto'; dibujar(); tira();
}
function guardar() { if (fuente && items[k]) guardado.set(items[k].id, { ...vista }); }
window.recorteVer = (i) => ver(i);
window.recorteIr = (d) => { const i = k + d; if (i >= 0 && i < items.length) ver(i); };

// ── Generar el archivo recortado (canvas → JPEG calidad alta, 4:5, máx. 1600 px, sin agrandar) ──
async function generar(f, v, nombre) {
  const d = medidas(f); const r = rectDeVista({ ...d, ...v }); const o = tamanoSalida(r);
  const c = document.createElement('canvas'); c.width = o.ancho; c.height = o.alto;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, o.ancho, o.alto);
  g.drawImage(f, r.x, r.y, r.w, r.h, 0, 0, o.ancho, o.alto);
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', CALIDAD_RECORTE));
  if (!blob) throw new Error('No se pudo generar el recorte.');
  const file = new File([blob], (nombre || 'foto').replace(/\.[^.]+$/, '') + '-recorte.jpg', { type: 'image/jpeg' });
  file.anchoFinal = o.ancho; file.altoFinal = o.alto;
  return file;
}
function siguientePendiente(desde) {
  for (let j = 1; j <= items.length; j++) { const i = (desde + j) % items.length; if (!items[i].recorte) return i; }
  return -1;
}
async function terminarUna(i) {
  const sig = siguientePendiente(i);
  if (sig === -1) { cerrar(); return; }
  await ver(sig);
}
window.recorteAplicar = async function () {
  if (ocupado || !fuente) return;
  ocupado = true; mensaje('Recortando…');
  try {
    const file = await generar(fuente, vista, items[k].file.name);
    guardar(); window.fotosAplicarRecorte(items[k], file); items[k].recorte = 'recortada';
  } catch (e) {
    mensaje('No se pudo recortar: ' + e.message + ' Se subirá la original.', 'var(--warning)');
    if (items[k].recortada) items[k].recorte = 'recortada'; // si ya tenía un recorte anterior, se conserva
    else { window.fotosUsarOriginal?.(items[k]); items[k].recorte = 'original'; }
  }
  ocupado = false; await terminarUna(k);
};
window.recorteOriginal = async function () {
  if (ocupado) return;
  window.fotosUsarOriginal?.(items[k]); items[k].recorte = 'original'; await terminarUna(k);
};
// Centrado automático en todas las que faltan (la que estás viendo usa el encuadre que ves ahora).
window.recorteCentrarTodas = async function () {
  if (ocupado) return; ocupado = true; guardar();
  const faltan = items.map((n, i) => i).filter((i) => !items[i].recorte);
  let hechas = 0;
  for (const i of faltan) {
    mensaje(`Recortando ${++hechas} de ${faltan.length}…`);
    try {
      const f = i === k && fuente ? fuente : await abrirFuente(items[i].file);
      const d = medidas(f); const c = rectCentrado(d.w, d.h);
      const v = i === k ? vista : (guardado.get(items[i].id) || { zoom: 1, cx: c.x + c.w / 2, cy: c.y + c.h / 2 });
      const file = await generar(f, v, items[i].file.name);
      window.fotosAplicarRecorte(items[i], file); items[i].recorte = 'recortada';
      if (f !== fuente) f.close?.();
    } catch (e) { window.fotosUsarOriginal?.(items[i]); items[i].recorte = 'original'; }
  }
  ocupado = false; cerrar();
};

// ── Abrir / cerrar ──
window.recorteAbrir = function (lista) {
  if (!lista || !lista.length) return;
  armar(); items = lista; k = 0; guardado.clear(); fuente = null; ocupado = false; punteros.clear();
  items.forEach((n) => { n.thumbOriginal = n.thumbOriginal || n.thumb; });
  $('recorte-modal').classList.add('open');
  const m = $('recorte-modal').querySelector('.modal'); if (m) m.scrollTop = 0;
  ver(0);
};
window.recorteAbierto = () => !!$('recorte-modal')?.classList.contains('open');
function cerrar() {
  token++; fuente?.close?.(); fuente = null; items.forEach((n) => { if (!n.recorte) n.recorte = 'original'; });
  $('recorte-modal')?.classList.remove('open');
  window.fotosRender?.();
}
// Cancelar: las fotos que no se recortaron quedan como originales y se suben como siempre.
window.recorteCancelar = function () { if (!ocupado) cerrar(); };
window.recorteCerrarTodo = function () { if ($('recorte-modal')) { token++; fuente?.close?.(); fuente = null; ocupado = false; $('recorte-modal').classList.remove('open'); } };
