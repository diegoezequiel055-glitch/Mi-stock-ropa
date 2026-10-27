import { state } from './state.js';
import { db, doc, setDoc } from './firebase-config.js';
import { RECOMENDACION, leerFotos, categoriasDeFilas, modelosEnCatalogo, ultimaFotoCategoria, conFoto, sinFoto, camposFotos, OPCIONES_GUARDAR, miniatura } from './fotos-categorias.js';

// ══════════════════════════════════════════
// TARJETA "FOTOS DE CATEGORÍAS" en Catálogo y sitio (debajo de "Videos de TikTok"). La lógica pura está en fotos-categorias.js.
// Una fila por categoría: miniatura (la foto cargada o, si no hay, la del último producto ingresado, que es la que usa la tienda), botón para subir o
// cambiar la foto y "Quitar (usar última foto)". Subir/Quitar se guarda al instante: escribe SOLO config_sitio/config › fotosCategorias (reemplazando
// ese campo entero con mergeFields; el resto de la config no se toca). La foto se sube con el mismo uploader de las fotos de productos
// (window.subirFotoGenerica, catalogo.js). La tienda lee ese campo en el documento de config que ya lee: sin lecturas extra.
// ══════════════════════════════════════════
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (id) => document.getElementById(id);

// Dependencias (se reemplazan en las pruebas del navegador sin tocar Firestore ni Cloudinary reales).
export const deps = {
  leer: () => state.configSitio || {},
  filas: () => state.stockData || [],
  fotosProductos: () => state.productoFotos || {},
  guardar: (data, opciones) => setDoc(doc(db, 'config_sitio', 'config'), data, opciones),
  subir: (archivo) => window.subirFotoGenerica(archivo),
  avisar: (msg, tipo) => window.toast && window.toast(msg, tipo),
};

let ocupado = false;

export function montarFotosCategorias(cont) {
  cont.innerHTML = `
  <div class="panel cf-adm" id="cf-panel" style="margin-top:18px">
    <div class="panel-head"><h2>🖼️ Fotos de categorías</h2></div>
    <div class="panel-body">
      <p class="cf-adm-ayuda">En la portada de la tienda, la sección «Comprar por categoría» muestra una tarjeta con foto por categoría (solo las que tienen productos). Si no cargás una foto, se usa la foto principal del último producto ingresado de esa categoría.</p>
      <div class="cf-adm-reco" id="cf-reco">📐 ${esc(RECOMENDACION)}</div>
      <div id="cf-lista" class="cf-adm-lista"></div>
      <div class="cf-adm-estado" id="cf-estado" role="status" aria-live="polite"></div>
    </div>
  </div>`;
  $('cf-lista').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-acc]'); if (!b || ocupado) return;
    if (b.dataset.acc === 'quitar') quitar(b.dataset.cat);
  });
  $('cf-lista').addEventListener('change', (e) => {
    const inp = e.target.closest('input[type="file"][data-cat]'); if (!inp || ocupado) return;
    const f = inp.files && inp.files[0]; inp.value = ''; if (f) subir(inp.dataset.cat, f);
  });
  render();
}

function estado(txt, tipo) { const e = $('cf-estado'); if (!e) return; e.textContent = txt || ''; e.className = 'cf-adm-estado' + (tipo ? ' ' + tipo : ''); }

async function escribir(mapa, mensaje) {
  ocupado = true; pintarBloqueo();
  try { await deps.guardar(camposFotos(mapa), OPCIONES_GUARDAR); estado(mensaje, 'ok'); deps.avisar('Fotos de categorías guardadas', 'success'); }
  catch (e) { estado('No se guardó: ' + (e && e.message || e), 'mal'); ocupado = false; pintarBloqueo(); return false; }
  ocupado = false; render(); return true;
}

async function subir(nombre, archivo) {
  estado(`Subiendo la foto de ${nombre}…`);
  ocupado = true; pintarBloqueo();
  let url;
  try { url = await deps.subir(archivo); }
  catch (e) { ocupado = false; pintarBloqueo(); estado('No se pudo subir la foto: ' + (e && e.message || e), 'mal'); return; }
  ocupado = false;
  let mapa; try { mapa = conFoto(leerFotos(deps.leer()), nombre, url); } catch (e) { estado(e.message, 'mal'); pintarBloqueo(); return; }
  await escribir(mapa, `Foto de ${nombre} guardada ✓ — ya se está actualizando en la tienda.`);
}
async function quitar(nombre) { await escribir(sinFoto(leerFotos(deps.leer()), nombre), `Se quitó la foto de ${nombre}: la tienda usa la del último producto ingresado ✓`); }

function pintarBloqueo() { document.querySelectorAll('#cf-lista button, #cf-lista input').forEach((x) => { x.disabled = ocupado; }); }

export function render() {
  const lista = $('cf-lista'); if (!lista) return;
  const fotos = leerFotos(deps.leer()); const filas = deps.filas(); const fp = deps.fotosProductos();
  const cats = categoriasDeFilas(filas, fotos);
  lista.innerHTML = cats.length ? cats.map(({ clave, nombre }) => {
    const cargada = fotos[nombre]; const ultima = cargada ? null : ultimaFotoCategoria(filas, fp, clave); const n = modelosEnCatalogo(filas, clave);
    const mini = cargada || ultima;
    const estadoTxt = cargada ? 'Foto cargada por vos' : ultima ? 'Usa la foto del último producto ingresado' : (n ? 'Sin foto: cargá una (los productos no tienen foto principal)' : 'Sin productos en el catálogo: no se muestra en la tienda');
    return `<div class="cf-adm-fila" data-cat="${esc(nombre)}">
      <div class="cf-adm-mini">${mini ? `<img src="${esc(miniatura(mini))}" alt="" loading="lazy">` : '<span>Sin foto</span>'}</div>
      <div class="cf-adm-datos"><div class="cf-adm-nombre">${esc(nombre)}</div><div class="cf-adm-origen ${cargada ? 'propia' : ''}">${esc(estadoTxt)}</div>
        <div class="cf-adm-acc">
          <label class="btn btn-ghost cf-adm-subir">📷 ${cargada ? 'Cambiar foto' : 'Subir foto'}<input type="file" accept="image/*" data-cat="${esc(nombre)}"></label>
          ${cargada ? `<button type="button" class="btn btn-ghost cf-adm-quitar" data-acc="quitar" data-cat="${esc(nombre)}">Quitar (usar última foto)</button>` : ''}
        </div></div>
    </div>`;
  }).join('') : '<div class="cf-adm-vacio">Todavía no hay productos con categoría.</div>';
  pintarBloqueo();
}

const root = typeof document !== 'undefined' ? document.getElementById('cf-root') : null;
if (root) montarFotosCategorias(root);
if (typeof window !== 'undefined') window.cfRender = render;
