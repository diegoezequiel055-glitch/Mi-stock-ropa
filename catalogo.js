import { state } from './state.js';
import { db, collection, doc, setDoc, writeBatch, onSnapshot } from './firebase-config.js';
import { armarModelos, claveModelo, compararTalles } from './matching.js';

// ══════════════════════════════════════════
// CATÁLOGO PÚBLICO — sincroniza sola la colección "catalogo_publico" con los
// talles marcados "Mostrar en catálogo". Corre en el navegador cada vez que
// cambia stock, precios o reservas; no depende de un servidor.
// Nunca lee ni escribe costo, mayorista ni curva — esos campos no existen acá.
// ══════════════════════════════════════════

// Cuenta gratuita de Cloudinary (sin tarjeta). Datos públicos: el "cloud name" y el
// nombre del preset no son secretos, están pensados para usarse desde el navegador.
const CLOUDINARY_CLOUD = 'd5fzjp10';
const CLOUDINARY_PRESET = 'stock mgr';

let publicadosIds = new Set(); // ids que existen HOY en catalogo_publico (para saber qué borrar)
let escuchando = false;
let timer = null;

const leerComoDataURL = (file) => new Promise((resolve, reject) => {
  const lector = new FileReader();
  lector.onload = () => resolve(lector.result);
  lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
  lector.readAsDataURL(file);
});

const MAX_FOTOS = 6; // por modelo

// Sube una foto a Cloudinary (directo desde el navegador) y la AGREGA a la galería
// de ESE MODELO (todos sus talles la comparten). Devuelve la URL final.
// El archivo se manda como texto (base64), no como binario: algunos celulares
// (con algún filtro de seguridad o proxy del operador de por medio) corrompen el
// formulario cuando lleva un archivo binario y pierden el campo del preset.
window.subirFotoProducto = async function (prod, file) {
  if (!file) return null;
  if (!file.type.startsWith('image/')) throw new Error('El archivo tiene que ser una imagen.');
  if (file.size > 8 * 1024 * 1024) throw new Error('La imagen pesa más de 8 MB. Achicala e intentá de nuevo.');
  const key = claveModelo(prod);
  const actuales = state.productoFotos[key] || [];
  if (actuales.length >= MAX_FOTOS) throw new Error(`Ya tiene ${MAX_FOTOS} fotos, el máximo por producto. Borrá alguna para agregar otra.`);
  const dataUrl = await leerComoDataURL(file);
  const fd = new FormData();
  fd.append('upload_preset', CLOUDINARY_PRESET);
  fd.append('file', dataUrl);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || 'No se pudo subir la foto.');
  await setDoc(doc(db, 'producto_fotos', key), { fotos: [...actuales, j.secure_url], actualizado: Date.now() });
  return j.secure_url;
};

// Saca una foto de la galería de un modelo (no borra nada en Cloudinary, solo deja de usarla).
window.borrarFotoProducto = async function (prod, url) {
  const key = claveModelo(prod);
  const actuales = state.productoFotos[key] || [];
  await setDoc(doc(db, 'producto_fotos', key), { fotos: actuales.filter((u) => u !== url), actualizado: Date.now() });
};

// Talles con stock disponible para vender (descuenta lo reservado, nunca negativo), de chico a grande.
function tallesDisponibles(modelo) {
  return modelo.filas.map((f) => {
    const reservado = state.reservasData.filter((r) => r.prodId === f.id && r.estado !== 'cancelada').reduce((a, r) => a + (r.cant || 1), 0);
    return { talle: f.talle, stock: Math.max(0, f.qty - reservado) };
  }).filter((t) => t.stock > 0).sort((a, b) => compararTalles(a.talle, b.talle));
}

// Diego pidió sumar mayorista y curva al sitio público (antes estaban excluidos a propósito).
// Costo nunca se incluye acá, ni se lee en esta función.
function armarFicha(modelo) {
  const precio = modelo.filas.find((f) => f.pventa > 0)?.pventa || null;
  const precioMayorista = modelo.filas.find((f) => f.pmayorista > 0)?.pmayorista || null;
  const precioCurva = modelo.filas.find((f) => f.pcurva > 0)?.pcurva || null;
  return {
    nombre: modelo.color ? `${modelo.modelo} (${modelo.color})` : modelo.modelo,
    categoria: modelo.cat,
    color: modelo.color || null,
    precio,
    precioMayorista,
    precioCurva,
    talles: tallesDisponibles(modelo),
    fotos: state.productoFotos[modelo.key] || [],
    actualizado: Date.now(),
  };
}

window.catalogoSync = async function () {
  const marcados = state.stockData.filter((p) => p.catalogo === true);
  const modelos = armarModelos(marcados); // agrupa por cat+modelo+color, como el resto de la app
  const deseados = new Map(modelos.map((m) => [m.key, armarFicha(m)]));

  const batch = writeBatch(db);
  let cambios = 0;
  for (const [key, ficha] of deseados) { batch.set(doc(db, 'catalogo_publico', key), ficha); cambios++; }
  for (const idViejo of publicadosIds) if (!deseados.has(idViejo)) { batch.delete(doc(db, 'catalogo_publico', idViejo)); cambios++; }
  if (cambios) await batch.commit();
};

window.catalogoRefresh = function () {
  clearTimeout(timer);
  timer = setTimeout(() => { catalogoSync().catch((e) => console.error('Error sincronizando catálogo:', e)); }, 500);
};

// Escucha la colección pública para saber qué hay publicado hoy (y así poder borrar lo que sobra).
window.catalogoIniciar = function () {
  if (escuchando) return;
  escuchando = true;
  onSnapshot(collection(db, 'catalogo_publico'), (snap) => {
    publicadosIds = new Set(snap.docs.map((d) => d.id));
    state.catalogoPublico = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (document.getElementById('tab-catalogo')?.classList.contains('active')) renderVistaCatalogo();
  }, () => {}); // si todavía no existe la colección o no hay permiso, no rompe nada
  onSnapshot(collection(db, 'producto_fotos'), (snap) => {
    state.productoFotos = Object.fromEntries(snap.docs.map((d) => [d.id, d.data().fotos || []]));
    if (document.getElementById('prod-modal')?.classList.contains('open')) actualizarFotoModal();
    catalogoRefresh();
  }, () => {});
};

// ══════════════════════════════════════════
// VISTA PREVIA — solo para Diego, logueado. Muestra exactamente lo que va a ver
// un cliente en el catálogo público (mismos campos, ningún precio de costo).
// ══════════════════════════════════════════
const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

window.catalogoSetBusqueda = function (v) { state.catalogoBusqueda = v; renderVistaCatalogo(); };
window.catalogoSetCat = function (v) { state.catalogoCat = v; renderVistaCatalogo(); };

window.renderVistaCatalogo = function () {
  const cont = document.getElementById('catalogo-grid'); if (!cont) return;
  const items = state.catalogoPublico;
  const cats = [...new Set(items.map((i) => i.categoria))].sort();
  const selCat = document.getElementById('catalogo-cat-sel');
  if (selCat && selCat.innerHTML.split('<option').length - 1 !== cats.length + 1) {
    selCat.innerHTML = '<option value="">Todas las categorías</option>' + cats.map((c) => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
    selCat.value = state.catalogoCat;
  }
  document.getElementById('catalogo-total').textContent = `${items.length} producto${items.length !== 1 ? 's' : ''} en el catálogo`;

  const q = state.catalogoBusqueda.toLowerCase().trim();
  const filtrados = items.filter((i) => (!q || i.nombre.toLowerCase().includes(q)) && (!state.catalogoCat || i.categoria === state.catalogoCat))
    .sort((a, b) => a.categoria.localeCompare(b.categoria, 'es') || a.nombre.localeCompare(b.nombre, 'es'));

  if (!items.length) {
    cont.innerHTML = `<div class="empty" style="padding:30px"><div class="empty-icon">🛍️</div><p>Todavía no marcaste ningún producto para el catálogo.<br>Andá a Stock → Editar producto → "Mostrar en catálogo".</p></div>`;
    return;
  }
  if (!filtrados.length) {
    cont.innerHTML = `<div class="empty" style="padding:24px"><p>Ningún producto coincide con la búsqueda.</p></div>`;
    return;
  }
  cont.innerHTML = filtrados.map((i) => `<div class="catalogo-card">
    <div class="catalogo-card-foto">${i.foto ? `<img src="${escHtml(i.foto)}" loading="lazy" alt="${escHtml(i.nombre)}" onerror="this.outerHTML='<div class=&quot;catalogo-sin-foto&quot;>📷 Sin foto</div>'">` : '<div class="catalogo-sin-foto">📷 Sin foto</div>'}</div>
    <div class="catalogo-card-body">
      <div class="catalogo-card-cat">${escHtml(i.categoria)}</div>
      <div class="catalogo-card-nombre">${escHtml(i.nombre)}</div>
      <div class="catalogo-card-precio">${i.precio ? '$' + fmt(i.precio) : '<span style="color:var(--muted)">Sin precio cargado</span>'}</div>
      <div class="catalogo-card-talles">${i.talles.length ? i.talles.map((t) => `<span class="badge b-ok" style="font-size:.65rem">${escHtml(t.talle)} · ${t.stock}</span>`).join('') : '<span style="font-size:.7rem;color:var(--danger)">Sin stock disponible</span>'}</div>
    </div>
  </div>`).join('');
};
