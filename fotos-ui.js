import { state } from './state.js';
import { db, doc, setDoc } from './firebase-config.js';
import { MAX_FOTOS, LADO_MAX, CALIDAD_JPEG, PARALELO, tamanoFinal, limitarSeleccion, mover, listaFinal, contador, correrCola } from './fotos.js';

// ══════════════════════════════════════════
// FOTOS DE PRODUCTO (carga múltiple) — pantalla dentro de la ficha de "Catálogo y sitio" (modal #foto-modal).
// Las reglas y cuentas están en fotos.js. Acá: elegir varias fotos, comprimir en el navegador, subir en paralelo,
// ordenar (◀ ▶ y arrastrar), quitar (solo del producto, no de Cloudinary) y UNA sola escritura en producto_fotos al terminar.
// catalogo.js llama a fotosAbrir / fotosPuedeCerrar / fotosCerrar. Después de escribir, catalogoSync actualiza la ficha y la tienda.
// ══════════════════════════════════════════
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let sesion = 0; // sube cada vez que se abre o cierra la pantalla: lo que termine de una sesión vieja se descarta
let clave = null;
let guardadas = []; // fotos del producto (orden actual; la primera es la principal)
let conocidas = []; // las que ya vimos en Firestore (para no pisar lo que otro dispositivo agregue mientras tanto)
let nuevas = []; // [{ id, file, thumb, estado: 'cola'|'subiendo'|'lista'|'error', url, error, comprimido }]
let quitando = null; // url que está pidiendo confirmación para quitar
let aviso = { texto: '', color: 'var(--muted)' };
let subiendo = false;
let cadenaEscrituras = Promise.resolve();
let seq = 0;

const urlsDe = () => state.productoFotos[clave] || [];

function decir(texto, color = 'var(--muted)') { aviso = { texto, color }; const e = $('fo-aviso'); if (e) { e.textContent = texto; e.style.color = color; } }

// ── Compresión: lado mayor 1600 px, JPEG 0,85, respeta la orientación EXIF y nunca agranda ──
async function decodificar(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* cae al método con <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode(); // los navegadores actuales ya aplican la orientación EXIF
    return img;
  } finally { URL.revokeObjectURL(url); }
}
window.fotosDecodificar = decodificar; // la usa la pantalla de recorte (recorte-ui.js)
window.fotosComprimir = async function (file) {
  let fuente;
  try { fuente = await decodificar(file); } catch (e) { throw new Error('No se pudo leer la foto (formato no soportado).'); }
  const w0 = fuente.width || fuente.naturalWidth, h0 = fuente.height || fuente.naturalHeight;
  const { ancho, alto } = tamanoFinal(w0, h0, LADO_MAX);
  const c = document.createElement('canvas'); c.width = ancho; c.height = alto;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, ancho, alto); // PNG con transparencia → fondo blanco
  g.drawImage(fuente, 0, 0, ancho, alto);
  if (fuente.close) fuente.close();
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', CALIDAD_JPEG));
  if (!blob) throw new Error('No se pudo comprimir la foto.');
  const nombre = (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
  const f = new File([blob], nombre, { type: 'image/jpeg' }); f.anchoFinal = ancho; f.altoFinal = alto;
  return f;
};
// Subida de UNA foto (misma subida a Cloudinary de siempre). Se puede reemplazar para pruebas.
window.fotosSubirUna = (file) => window.subirFotoGenerica(file);

// ── Escrituras en producto_fotos (una sola por acción, en fila para no pisarse) ──
function escribir(lista) {
  const k = clave, s = sesion;
  const p = cadenaEscrituras.then(() => setDoc(doc(db, 'producto_fotos', k), { fotos: lista, actualizado: Date.now() }));
  cadenaEscrituras = p.catch(() => {});
  return p.then(() => { if (s === sesion) conocidas = lista.slice(); });
}

// ── Pantalla ──
function tileGuardada(url, i) {
  const u = esc(url), ult = i === guardadas.length - 1;
  const btn = (txt, onclick, dis, title) => `<button ${dis ? 'disabled' : ''} onclick="${onclick}" title="${title}" style="flex:1;min-width:0;height:30px;border:1px solid var(--border2);background:var(--surface2);color:${dis ? 'var(--muted)' : 'var(--text)'};border-radius:6px;font-size:.8rem;cursor:${dis ? 'default' : 'pointer'};opacity:${dis ? .4 : 1}">${txt}</button>`;
  const conf = quitando === url
    ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,.88);border-radius:8px;display:flex;flex-direction:column;gap:4px;align-items:center;justify-content:center;padding:4px;text-align:center"><div style="font-size:.62rem;line-height:1.2">¿Quitar? No se borra de Cloudinary</div><div style="display:flex;gap:4px"><button onclick="fotosQuitar(${i})" style="background:var(--danger);color:#fff;border:none;border-radius:5px;padding:4px 8px;font-size:.7rem;cursor:pointer">Quitar</button><button onclick="fotosNoQuitar()" style="background:var(--surface3);color:var(--text);border:none;border-radius:5px;padding:4px 8px;font-size:.7rem;cursor:pointer">No</button></div></div>` : '';
  return `<div class="fo-tile" draggable="true" data-i="${i}" ondragstart="fotosDragInicio(event,${i})" ondragover="event.preventDefault()" ondrop="fotosDrop(event,${i})" style="width:84px;flex-shrink:0">
    <div style="position:relative;width:84px;height:84px">
      <img src="${u}" alt="" draggable="false" style="width:100%;height:100%;object-fit:cover;border-radius:8px;border:1px solid ${i === 0 ? 'var(--accent)' : 'var(--border2)'}">
      ${i === 0 ? '<span style="position:absolute;left:4px;bottom:4px;background:var(--accent);color:#000;font-size:.58rem;font-weight:700;border-radius:4px;padding:1px 5px">Principal</span>' : ''}
      <button onclick="fotosPedirQuitar(${i})" title="Quitar" style="position:absolute;top:-6px;right:-6px;width:24px;height:24px;border-radius:50%;background:var(--danger);color:#fff;border:none;font-size:.7rem;cursor:pointer;line-height:1">✕</button>
      ${conf}
    </div>
    <div style="display:flex;gap:4px;margin-top:5px">${btn('◀', `fotosMover(${i},-1)`, i === 0, 'Mover a la izquierda')}${btn('▶', `fotosMover(${i},1)`, ult, 'Mover a la derecha')}</div>
  </div>`;
}
const ETIQ = { cola: ['En cola', 'var(--muted)'], subiendo: ['Subiendo…', 'var(--blue)'], lista: ['Lista ✓', 'var(--success)'], error: ['Error', 'var(--danger)'] };
// ── Recorte (recorte-ui.js): el archivo recortado reemplaza al que se comprime y sube; si no hay, se sube el original como siempre ──
function revocar(n) { if (n.thumbOriginal && n.thumbOriginal !== n.thumb) URL.revokeObjectURL(n.thumbOriginal); URL.revokeObjectURL(n.thumb); }
window.fotosAplicarRecorte = function (n, file) {
  if (n.thumbOriginal && n.thumb !== n.thumbOriginal) URL.revokeObjectURL(n.thumb);
  n.comprimido = file; n.thumb = URL.createObjectURL(file); n.recortada = true; render();
};
window.fotosUsarOriginal = function (n) {
  if (n.thumbOriginal && n.thumb !== n.thumbOriginal) { URL.revokeObjectURL(n.thumb); n.thumb = n.thumbOriginal; }
  n.comprimido = undefined; n.recortada = false; render();
};
window.fotosRecortarUna = function (id) {
  const n = nuevas.find((x) => x.id === id); if (!n || subiendo || !window.recorteAbrir) return;
  n.recorte = undefined; recorteAbrir([n]);
};
function tileNueva(n) {
  const [txt, col] = ETIQ[n.estado];
  const puedeQuitar = n.estado !== 'subiendo' && n.estado !== 'lista';
  return `<div style="width:84px;flex-shrink:0">
    <div style="position:relative;width:84px;height:84px">
      <img src="${esc(n.thumb)}" alt="" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;border-radius:8px;border:1px dashed var(--border2);background:var(--surface2)">
      ${puedeQuitar && !subiendo ? `<button onclick="fotosSacarNueva(${n.id})" title="Sacar" style="position:absolute;top:-6px;right:-6px;width:24px;height:24px;border-radius:50%;background:var(--danger);color:#fff;border:none;font-size:.7rem;cursor:pointer;line-height:1">✕</button>` : ''}
    </div>
    ${(n.estado === 'cola' || n.estado === 'error') && !subiendo && window.recorteAbrir ? `<button class="rc-tile-btn" onclick="fotosRecortarUna(${n.id})">${n.recortada ? '✂ Recortada ✓<br>cambiar' : '✂ Recortar'}</button>` : ''}
    <div style="font-size:.68rem;color:${col};margin-top:4px;line-height:1.25">${txt}${n.estado === 'error' ? `<div style="color:var(--text2)">${esc(n.error || '')}</div><button onclick="fotosReintentar(${n.id})" style="margin-top:3px;background:var(--surface3);color:var(--text);border:1px solid var(--border2);border-radius:6px;padding:4px 8px;font-size:.7rem;cursor:pointer">Reintentar</button>` : ''}</div>
  </div>`;
}
function render() {
  const raiz = $('fo-root'); if (!raiz || !clave) return;
  const pend = nuevas.filter((n) => n.estado !== 'lista');
  const cont = contador(nuevas.map((n) => n.estado));
  const quedaLugar = guardadas.length + nuevas.length < MAX_FOTOS;
  const lab = 'font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px';
  const hayError = nuevas.some((n) => n.estado === 'error'), hayListas = nuevas.some((n) => n.estado === 'lista');
  raiz.innerHTML = `
    <div style="${lab};margin-bottom:6px">Fotos del producto (${guardadas.length} de ${MAX_FOTOS})</div>
    <div id="fo-guardadas" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">${guardadas.length ? guardadas.map(tileGuardada).join('') : '<div style="font-size:.78rem;color:var(--muted)">Todavía no tiene fotos.</div>'}</div>
    ${guardadas.length > 1 ? '<div style="font-size:.7rem;color:var(--muted);margin-bottom:10px">La primera es la principal (la que se ve en el listado de la tienda). Ordená con ◀ ▶ o arrastrando.</div>' : ''}
    ${quedaLugar ? `<label class="btn btn-gold" style="display:block;text-align:center;cursor:pointer;margin-bottom:6px;${subiendo ? 'opacity:.5;pointer-events:none' : ''}">📷 Elegir fotos<input type="file" id="fo-input" accept="image/*" multiple onchange="fotosElegidas(this)" style="display:none"></label>` : ''}
    ${nuevas.length ? `<div style="${lab};margin:12px 0 6px">Para subir${subiendo || hayListas ? ` <span id="fo-contador" style="text-transform:none;letter-spacing:0;color:var(--text);font-weight:600">— ${cont.texto}</span>` : ''}</div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">${nuevas.map(tileNueva).join('')}</div>` : ''}
    ${pend.length && !subiendo ? `<button class="btn btn-gold" style="width:100%;margin-bottom:6px" onclick="fotosSubir()">⬆ Subir ${pend.length === 1 ? 'la foto' : `las ${pend.length} fotos`} y guardar</button>` : ''}
    ${hayError && hayListas && !subiendo ? `<button class="btn btn-ghost" style="width:100%;margin-bottom:6px" onclick="fotosGuardarListas()">Guardar solo las que ya subieron (${nuevas.filter((n) => n.estado === 'lista').length})</button>` : ''}
    <div id="fo-aviso" style="font-size:.74rem;margin-top:4px;color:${aviso.color}">${esc(aviso.texto)}</div>
    <div style="font-size:.7rem;color:var(--muted);margin-top:8px">Hasta ${MAX_FOTOS} fotos por producto; las comparten todos los talles. Se achican solas (máx. ${LADO_MAX} px) antes de subir.</div>`;
}
window.fotosRender = render;

window.fotosAbrir = function (modelo) {
  sesion++; clave = modelo.key; nuevas = []; quitando = null; subiendo = false; aviso = { texto: '', color: 'var(--muted)' };
  guardadas = urlsDe().slice(); conocidas = guardadas.slice();
  render();
};
window.fotosPuedeCerrar = function () {
  if (!clave || !nuevas.length) return true;
  return window.confirm(subiendo ? 'Se están subiendo fotos. Si salís ahora se cancela y no se guarda nada. ¿Salir igual?' : 'Hay fotos elegidas que todavía no se subieron. Si salís se descartan. ¿Salir igual?');
};
window.fotosCerrar = function () {
  sesion++; // cualquier subida en curso termina sola pero ya no escribe nada
  if (window.recorteCerrarTodo) recorteCerrarTodo();
  nuevas.forEach(revocar);
  nuevas = []; quitando = null; subiendo = false; clave = null;
  const raiz = $('fo-root'); if (raiz) raiz.innerHTML = '';
};

// ── Elegir fotos ──
window.fotosElegidas = function (input) {
  if (!clave) return;
  const todos = [...(input.files || [])];
  input.value = '';
  const imagenes = todos.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name));
  const salteadas = todos.length - imagenes.length;
  const lim = limitarSeleccion(guardadas.length + nuevas.length, imagenes.length, MAX_FOTOS);
  const agregadas = imagenes.slice(0, lim.tomar).map((file) => { const n = { id: ++seq, file, thumb: URL.createObjectURL(file), estado: 'cola' }; nuevas.push(n); return n; });
  const partes = [];
  if (lim.aviso) partes.push(lim.aviso);
  if (salteadas) partes.push(`${salteadas} ${salteadas === 1 ? 'archivo no era una imagen y se salteó' : 'archivos no eran imágenes y se saltearon'}.`);
  decir(partes.join(' '), partes.length ? 'var(--warning)' : 'var(--muted)');
  render();
  if (agregadas.length && window.recorteAbrir) recorteAbrir(agregadas); // paso de recorte antes de subir (recorte-ui.js)
};
window.fotosSacarNueva = function (id) {
  const n = nuevas.find((x) => x.id === id); if (!n || subiendo) return;
  revocar(n); nuevas = nuevas.filter((x) => x.id !== id); decir(''); render();
};

// ── Subir (en paralelo, máx. 3) y guardar con UNA escritura ──
async function subirLista(items) {
  const s = sesion;
  subiendo = true; render();
  await correrCola(items, async (n) => {
    n.comprimido = n.comprimido || await window.fotosComprimir(n.file);
    return await window.fotosSubirUna(n.comprimido);
  }, {
    paralelo: PARALELO,
    cancelado: () => s !== sesion,
    onEstado: (i, estado, dato) => {
      if (s !== sesion) return;
      const n = items[i]; n.estado = estado;
      if (estado === 'lista') { n.url = dato; n.error = null; }
      if (estado === 'error') n.error = dato?.message || 'No se pudo subir.';
      render();
    },
  });
  if (s !== sesion) return; // se cerró la pantalla: no se guarda nada
  subiendo = false;
  if (nuevas.some((n) => n.estado === 'error')) { decir('Alguna foto no se pudo subir. Las que subieron no se pierden: podés reintentar la que falló o guardar solo las listas.', 'var(--warning)'); render(); return; }
  await guardarListas();
}
window.fotosSubir = function () { if (subiendo || !clave) return; decir(''); subirLista(nuevas.filter((n) => n.estado === 'cola' || n.estado === 'error')); };
window.fotosReintentar = function (id) {
  const n = nuevas.find((x) => x.id === id); if (!n || subiendo) return;
  decir(''); n.estado = 'cola'; subirLista([n]);
};
window.fotosGuardarListas = function () { if (!subiendo) guardarListas(); };
async function guardarListas() {
  const s = sesion;
  const listas = nuevas.filter((n) => n.estado === 'lista');
  if (!listas.length) { render(); return; }
  const final = listaFinal({ guardadas, nuevas: listas.map((n) => n.url), remoto: urlsDe(), conocidas });
  try { await escribir(final); }
  catch (e) { if (s === sesion) { decir('No se pudo guardar: ' + e.message + '. Las fotos subidas siguen acá; probá de nuevo.', 'var(--danger)'); render(); } return; }
  if (s !== sesion) return;
  guardadas = final;
  listas.forEach(revocar);
  nuevas = nuevas.filter((n) => n.estado !== 'lista');
  decir(`${listas.length === 1 ? 'Foto guardada' : `${listas.length} fotos guardadas`} ✓ — la ficha y la tienda se actualizan solas.`, 'var(--success)');
  render();
}

// ── Ordenar y quitar (fotos ya guardadas): una escritura por acción ──
async function aplicarLista(nueva) {
  const antes = guardadas; guardadas = nueva; render();
  try { await escribir(nueva); }
  catch (e) { guardadas = antes; decir('No se pudo guardar el cambio: ' + e.message, 'var(--danger)'); render(); }
}
window.fotosMover = function (i, dir) { if (!clave) return; const r = mover(guardadas, i, i + dir); if (r.some((u, k) => u !== guardadas[k])) { quitando = null; aplicarLista(r); } };
let arrastrando = null;
window.fotosDragInicio = function (ev, i) { arrastrando = i; if (ev.dataTransfer) { ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', String(i)); } catch (e) {} } };
window.fotosDrop = function (ev, j) {
  ev.preventDefault(); const i = arrastrando; arrastrando = null;
  if (i == null || i === j) return;
  quitando = null; aplicarLista(mover(guardadas, i, j));
};
window.fotosPedirQuitar = function (i) { quitando = guardadas[i]; render(); };
window.fotosNoQuitar = function () { quitando = null; render(); };
window.fotosQuitar = function (i) { const u = guardadas[i]; if (u === undefined || quitando !== u) return; quitando = null; aplicarLista(guardadas.filter((x) => x !== u)); };
