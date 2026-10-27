import { state } from './state.js';
import { db, doc, setDoc } from './firebase-config.js';
import { MAX_VIDEOS, MAX_TITULO, validarLinkTiktok, armarVideo, prepararParaGuardar, leerGuardados, mover, quitar, hayCambios, camposVideos } from './videos-tiktok.js';

// ══════════════════════════════════════════
// TARJETA "VIDEOS DE TIKTOK" en Catálogo y sitio (debajo de la configuración del sitio). La lógica pura está en videos-tiktok.js.
// Agregar un video (link + portada + título opcional), reordenar, borrar y guardar. Escribe SOLO el campo `videosTiktok` de
// config_sitio/config, con merge (hasta 6; la tienda ya lee ese documento: sin lecturas extra). La portada se sube a Cloudinary con el mismo
// uploader de las fotos (window.subirFotoGenerica, catalogo.js). Los cambios quedan en un borrador hasta tocar "Guardar videos".
// ══════════════════════════════════════════
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (id) => document.getElementById(id);

// Dependencias (se reemplazan en las pruebas del navegador sin tocar Firestore ni Cloudinary reales).
export const deps = {
  leer: () => state.configSitio || {},
  guardar: (data) => setDoc(doc(db, 'config_sitio', 'config'), data, { merge: true }),
  subir: (archivo) => window.subirFotoGenerica(archivo),
  avisar: (msg, tipo) => window.toast && window.toast(msg, tipo),
};

let borrador = [];          // lo que se está editando
let guardado = [];          // lo último que hay en Firestore
let iniciado = false;
let portadaNueva = '';      // portada ya subida del video que se está por agregar
let subiendo = false, guardando = false;

// La misma tarjeta que ve el cliente en la tienda (vertical 9:16, play centrado, título y "Ver en TikTok"), en chico.
const tarjeta = (v) => `<div class="vid-prev-card"><div class="vid-prev-portada">${v.portada ? `<img src="${esc(v.portada)}" alt="">` : '<span class="vid-prev-vacia">Sin portada</span>'}<span class="vid-prev-play" aria-hidden="true">▶</span></div>${v.titulo ? `<div class="vid-prev-titulo">${esc(v.titulo)}</div>` : ''}<div class="vid-prev-ver">Ver en TikTok</div></div>`;

export function montarVideos(cont) {
  cont.innerHTML = `
  <div class="panel vid-adm" id="vid-panel" style="margin-top:18px">
    <div class="panel-head">
      <h2>🎬 Videos de TikTok</h2>
      <span class="vid-adm-contador" id="vid-contador" role="status" aria-live="polite">0 / ${MAX_VIDEOS}</span>
    </div>
    <div class="panel-body">
      <p class="vid-adm-ayuda">Aparecen en la tienda como la sección «Nuestros videos» (al final de la portada). Cada tarjeta abre el video en TikTok en una pestaña nueva. Hasta ${MAX_VIDEOS}; el orden es el de esta lista. Si no hay ninguno, la sección no se muestra.</p>
      <div id="vid-lista" class="vid-adm-lista"></div>
      <div class="vid-adm-nuevo">
        <div class="vid-adm-sub">Agregar un video</div>
        <div class="field"><label for="vid-link">Link del video</label>
          <input type="url" id="vid-link" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://www.tiktok.com/@tiendapremium.ok/video/…">
          <div class="vid-adm-nota" id="vid-link-nota"></div></div>
        <div class="field"><label for="vid-titulo">Título corto (opcional)</label>
          <input type="text" id="vid-titulo" maxlength="${MAX_TITULO}" autocomplete="off" placeholder="Ej: Nuevos ingresos de la semana"></div>
        <div class="field"><label for="vid-file">Portada (imagen)</label>
          <input type="file" id="vid-file" accept="image/*">
          <div class="vid-adm-nota" id="vid-file-nota">Mejor vertical (9:16). Se sube a Cloudinary como las fotos de los productos.</div></div>
        <div class="vid-adm-vista" id="vid-vista-caja"><div class="vid-adm-sub">Así se ve en la tienda</div><div id="vid-vista"></div></div>
        <div class="vid-adm-error" id="vid-error" role="alert"></div>
        <button type="button" class="btn btn-gold" id="vid-agregar" style="min-height:44px">➕ Agregar a la lista</button>
      </div>
      <div class="vid-adm-pie">
        <button type="button" class="btn btn-gold" id="vid-guardar" style="min-height:44px">💾 Guardar videos</button>
        <span class="vid-adm-estado" id="vid-estado" role="status" aria-live="polite"></span>
      </div>
    </div>
  </div>`;
  $('vid-link').addEventListener('input', notaLink);
  $('vid-titulo').addEventListener('input', pintarVista);
  $('vid-file').addEventListener('change', alElegirPortada);
  $('vid-agregar').addEventListener('click', agregar);
  $('vid-guardar').addEventListener('click', guardar);
  $('vid-lista').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-acc]'); if (!b) return; const i = Number(b.dataset.i);
    if (b.dataset.acc === 'sube') borrador = mover(borrador, i, -1); else if (b.dataset.acc === 'baja') borrador = mover(borrador, i, 1); else if (b.dataset.acc === 'borra') borrador = quitar(borrador, i);
    estado(''); pintar();
  });
  render();
}

function notaLink() {
  const n = $('vid-link-nota'); const v = $('vid-link').value;
  if (!v.trim()) { n.textContent = ''; n.className = 'vid-adm-nota'; return; }
  const r = validarLinkTiktok(v);
  if (r.ok) { n.textContent = '✓ Link válido. Se guarda como: ' + r.url; n.className = 'vid-adm-nota ok'; }
  else { n.textContent = r.error; n.className = 'vid-adm-nota mal'; }
}

function pintarVista() {
  const cont = $('vid-vista'); if (!cont) return;
  const hay = portadaNueva || $('vid-titulo').value.trim();
  $('vid-vista-caja').style.display = hay ? '' : 'none';
  cont.innerHTML = tarjeta({ portada: portadaNueva, titulo: $('vid-titulo').value.trim() });
}

async function alElegirPortada() {
  const f = $('vid-file').files && $('vid-file').files[0]; const nota = $('vid-file-nota'); if (!f) return;
  subiendo = true; nota.textContent = 'Subiendo portada…'; nota.className = 'vid-adm-nota'; $('vid-agregar').disabled = true;
  try { portadaNueva = await deps.subir(f); nota.textContent = '✓ Portada subida.'; nota.className = 'vid-adm-nota ok'; }
  catch (e) { portadaNueva = ''; nota.textContent = 'No se pudo subir: ' + (e && e.message || e); nota.className = 'vid-adm-nota mal'; }
  subiendo = false; $('vid-agregar').disabled = false; pintarVista();
}

function agregar() {
  if (subiendo) return;
  const r = armarVideo({ link: $('vid-link').value, portada: portadaNueva, titulo: $('vid-titulo').value }, borrador);
  const err = $('vid-error');
  if (!r.ok) { err.textContent = r.error; return; }
  err.textContent = ''; borrador = borrador.concat([r.video]);
  $('vid-link').value = ''; $('vid-titulo').value = ''; $('vid-file').value = ''; portadaNueva = ''; $('vid-link-nota').textContent = ''; $('vid-file-nota').textContent = 'Mejor vertical (9:16). Se sube a Cloudinary como las fotos de los productos.'; $('vid-file-nota').className = 'vid-adm-nota';
  estado('Falta guardar los cambios.', 'aviso'); pintar(); pintarVista();
}

function estado(txt, tipo) { const e = $('vid-estado'); if (!e) return; e.textContent = txt || ''; e.className = 'vid-adm-estado' + (tipo ? ' ' + tipo : ''); }

async function guardar() {
  if (guardando) return;
  const r = prepararParaGuardar(borrador);
  if (!r.ok) { estado(r.error, 'mal'); return; }
  if (!hayCambios(r.lista, guardado)) { estado('No hay cambios para guardar.', 'aviso'); return; }
  guardando = true; $('vid-guardar').disabled = true; estado('Guardando…');
  try {
    await deps.guardar(camposVideos(r.lista));
    guardado = r.lista; borrador = r.lista.slice(); estado('Guardado ✓ — ya se está actualizando en la tienda.', 'ok'); deps.avisar('Videos guardados', 'success'); pintar();
  } catch (e) { estado('No se guardó: ' + (e && e.message || e), 'mal'); }
  guardando = false; $('vid-guardar').disabled = false;
}

function pintar() {
  const lista = $('vid-lista'); if (!lista) return;
  $('vid-contador').textContent = `${borrador.length} / ${MAX_VIDEOS}`;
  lista.innerHTML = borrador.length ? borrador.map((v, i) => `<div class="vid-adm-item">
      ${tarjeta(v)}
      <div class="vid-adm-datos"><div class="vid-adm-num">Video ${i + 1}</div><a class="vid-adm-link" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.url.replace('https://www.tiktok.com/', ''))}</a>
        <div class="vid-adm-acc"><button type="button" class="btn btn-ghost" data-acc="sube" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir el video ${i + 1}">↑</button><button type="button" class="btn btn-ghost" data-acc="baja" data-i="${i}" ${i === borrador.length - 1 ? 'disabled' : ''} aria-label="Bajar el video ${i + 1}">↓</button><button type="button" class="btn btn-ghost vid-adm-borrar" data-acc="borra" data-i="${i}" aria-label="Borrar el video ${i + 1}">🗑 Borrar</button></div></div>
    </div>`).join('') : '<div class="vid-adm-vacio">Todavía no hay videos: la sección «Nuestros videos» no se muestra en la tienda.</div>';
  const lleno = borrador.length >= MAX_VIDEOS; $('vid-agregar').disabled = lleno || subiendo;
  if (lleno) $('vid-error').textContent = `Ya hay ${MAX_VIDEOS} videos (el máximo). Borrá uno para agregar otro.`; else if ($('vid-error').textContent.startsWith('Ya hay')) $('vid-error').textContent = '';
}

// La redibuja config.js cuando llega config_sitio/config. Si hay cambios sin guardar no los pisa.
export function render() {
  if (!$('vid-panel')) return;
  const g = leerGuardados(deps.leer());
  if (!iniciado || !hayCambios(borrador, guardado)) borrador = g.slice();
  guardado = g; iniciado = true; pintar(); pintarVista();
}

const root = typeof document !== 'undefined' ? document.getElementById('vid-root') : null;
if (root) montarVideos(root);
if (typeof window !== 'undefined') window.vidRender = render;
