import { state } from './state.js';
import { db, doc, setDoc } from './firebase-config.js';
import { RECOMENDACION, MAX_FRASE, leerCategorias, categoriasDeFilas, modelosEnCatalogo, ultimaFotoCategoria, conFoto, sinFoto, conFrase, limpiarFrase, camposPortada, OPCIONES_GUARDAR, miniatura } from './categorias-portada.js';

// ══════════════════════════════════════════
// TARJETA "CATEGORÍAS DE LA PORTADA" en Catálogo y sitio (debajo de "Videos de TikTok"). La lógica pura está en categorias-portada.js.
// Una fila por categoría: miniatura vertical (la foto cargada o, si no hay, la del último producto ingresado, que es la que usa la tienda), frase corta opcional
// (máx. 30 caracteres), botón para subir o cambiar la foto y "Quitar (usar última foto)". Todo se guarda al instante: escribe SOLO
// config_sitio/config › categoriasPortada ({ categoría: { foto, frase } }), reemplazando ese campo entero con mergeFields (el resto de la config no se toca).
// La foto se sube con el mismo uploader de las fotos (window.subirFotoGenerica, catalogo.js). La tienda lee ese campo en el documento de config que ya lee.
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

export function montarCategoriasPortada(cont) {
  cont.innerHTML = `
  <div class="panel cp-adm" id="cp-panel" style="margin-top:18px">
    <div class="panel-head"><h2>🖼️ Categorías de la portada</h2></div>
    <div class="panel-body">
      <p class="cp-adm-ayuda">En la portada de la tienda, la sección «Comprar por categoría» es un carrusel de tarjetas grandes con foto, una por categoría (solo las que tienen productos). Si no cargás una foto, se usa la foto principal del último producto ingresado de esa categoría. La frase es opcional y se ve arriba del nombre.</p>
      <div class="cp-adm-reco" id="cp-reco">📐 ${esc(RECOMENDACION)}</div>
      <div id="cp-lista" class="cp-adm-lista"></div>
      <div class="cp-adm-estado" id="cp-estado" role="status" aria-live="polite"></div>
    </div>
  </div>`;
  $('cp-lista').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-acc]'); if (!b || ocupado) return;
    if (b.dataset.acc === 'quitar') quitar(b.dataset.cat); else if (b.dataset.acc === 'frase') guardarFrase(b.dataset.cat);
  });
  $('cp-lista').addEventListener('input', (e) => { const i = e.target.closest('input[data-frase]'); if (i) { const c = i.closest('.cp-adm-fila').querySelector('.cp-adm-contador'); if (c) c.textContent = `${i.value.length}/${MAX_FRASE}`; } });
  $('cp-lista').addEventListener('keydown', (e) => { const i = e.target.closest('input[data-frase]'); if (i && e.key === 'Enter') { e.preventDefault(); if (!ocupado) guardarFrase(i.dataset.frase); } });
  $('cp-lista').addEventListener('change', (e) => {
    const inp = e.target.closest('input[type="file"][data-cat]'); if (!inp || ocupado) return;
    const f = inp.files && inp.files[0]; inp.value = ''; if (f) subir(inp.dataset.cat, f);
  });
  render();
}

function estado(txt, tipo) { const e = $('cp-estado'); if (!e) return; e.textContent = txt || ''; e.className = 'cp-adm-estado' + (tipo ? ' ' + tipo : ''); }

async function escribir(mapa, mensaje) {
  ocupado = true; pintarBloqueo();
  try { await deps.guardar(camposPortada(mapa), OPCIONES_GUARDAR); estado(mensaje, 'ok'); deps.avisar('Categorías de la portada guardadas', 'success'); }
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
  let mapa; try { mapa = conFoto(leerCategorias(deps.leer()), nombre, url); } catch (e) { estado(e.message, 'mal'); pintarBloqueo(); return; }
  await escribir(mapa, `Foto de ${nombre} guardada ✓ — ya se está actualizando en la tienda.`);
}
async function quitar(nombre) { await escribir(sinFoto(leerCategorias(deps.leer()), nombre), `Se quitó la foto de ${nombre}: la tienda usa la del último producto ingresado ✓`); }
async function guardarFrase(nombre) {
  const inp = [...document.querySelectorAll('#cp-lista input[data-frase]')].find((i) => i.dataset.frase === nombre); if (!inp) return;
  const antes = (leerCategorias(deps.leer())[nombre] || {}).frase || ''; const nueva = limpiarFrase(inp.value);
  if (nueva === antes) { estado('No hay cambios en la frase de ' + nombre + '.'); return; }
  await escribir(conFrase(leerCategorias(deps.leer()), nombre, nueva), nueva ? `Frase de ${nombre} guardada ✓ — ya se está actualizando en la tienda.` : `Frase de ${nombre} quitada ✓`);
}

function pintarBloqueo() { document.querySelectorAll('#cp-lista button, #cp-lista input').forEach((x) => { x.disabled = ocupado; }); }

export function render() {
  const lista = $('cp-lista'); if (!lista) return;
  // No se pisa una frase que se está escribiendo.
  const ae = document.activeElement; const enEdicion = ae && ae.matches && ae.matches('#cp-lista input[data-frase]') ? { cat: ae.dataset.frase, valor: ae.value } : null;
  const datos = leerCategorias(deps.leer()); const filas = deps.filas(); const fp = deps.fotosProductos();
  const cats = categoriasDeFilas(filas, datos);
  lista.innerHTML = cats.length ? cats.map(({ clave, nombre }) => {
    const d = datos[nombre] || {}; const cargada = d.foto; const ultima = cargada ? null : ultimaFotoCategoria(filas, fp, clave); const n = modelosEnCatalogo(filas, clave);
    const mini = cargada || ultima;
    const estadoTxt = cargada ? 'Foto cargada por vos' : ultima ? 'Usa la foto del último producto ingresado' : (n ? 'Sin foto: cargá una (los productos no tienen foto principal)' : 'Sin productos en el catálogo: no se muestra en la tienda');
    const valor = enEdicion && enEdicion.cat === nombre ? enEdicion.valor : (d.frase || '');
    return `<div class="cp-adm-fila" data-cat="${esc(nombre)}">
      <div class="cp-adm-mini">${mini ? `<img src="${esc(miniatura(mini))}" alt="" loading="lazy">` : '<span>Sin foto</span>'}</div>
      <div class="cp-adm-datos"><div class="cp-adm-nombre">${esc(nombre)}</div><div class="cp-adm-origen ${cargada ? 'propia' : ''}">${esc(estadoTxt)}</div>
        <div class="cp-adm-frase"><label>Frase corta (opcional)</label>
          <div class="cp-adm-frase-fila"><input type="text" maxlength="${MAX_FRASE}" value="${esc(valor)}" data-frase="${esc(nombre)}" placeholder="Ej: Las de la temporada" autocomplete="off" aria-label="Frase corta de ${esc(nombre)}"><button type="button" class="btn btn-ghost" data-acc="frase" data-cat="${esc(nombre)}">Guardar frase</button></div>
          <div class="cp-adm-contador">${valor.length}/${MAX_FRASE}</div></div>
        <div class="cp-adm-acc">
          <label class="btn btn-ghost cp-adm-subir">📷 ${cargada ? 'Cambiar foto' : 'Subir foto'}<input type="file" accept="image/*" data-cat="${esc(nombre)}"></label>
          ${cargada ? `<button type="button" class="btn btn-ghost cp-adm-quitar" data-acc="quitar" data-cat="${esc(nombre)}">Quitar (usar última foto)</button>` : ''}
        </div></div>
    </div>`;
  }).join('') : '<div class="cp-adm-vacio">Todavía no hay productos con categoría.</div>';
  if (enEdicion) { const i = [...lista.querySelectorAll('input[data-frase]')].find((x) => x.dataset.frase === enEdicion.cat); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  pintarBloqueo();
}

const root = typeof document !== 'undefined' ? document.getElementById('cp-root') : null;
if (root) montarCategoriasPortada(root);
if (typeof window !== 'undefined') window.cpRender = render;
