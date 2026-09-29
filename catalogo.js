import { state } from './state.js';
import { db, collection, doc, setDoc, writeBatch, onSnapshot } from './firebase-config.js';
import { armarModelos, claveModelo } from './matching.js';

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

// Sube una foto a Cloudinary (directo desde el navegador) y la guarda como la foto
// de ESE MODELO (todos sus talles la comparten). Devuelve la URL final.
window.subirFotoProducto = async function (prod, file) {
  if (!file) return null;
  if (!file.type.startsWith('image/')) throw new Error('El archivo tiene que ser una imagen.');
  if (file.size > 8 * 1024 * 1024) throw new Error('La imagen pesa más de 8 MB. Achicala e intentá de nuevo.');
  const key = claveModelo(prod);
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || 'No se pudo subir la foto.');
  await setDoc(doc(db, 'producto_fotos', key), { url: j.secure_url, actualizado: Date.now() });
  return j.secure_url;
};

// Talles con stock disponible para vender (descuenta lo reservado, nunca negativo).
function tallesDisponibles(modelo) {
  return modelo.filas.map((f) => {
    const reservado = state.reservasData.filter((r) => r.prodId === f.id && r.estado !== 'cancelada').reduce((a, r) => a + (r.cant || 1), 0);
    return { talle: f.talle, stock: Math.max(0, f.qty - reservado) };
  }).filter((t) => t.stock > 0);
}

function armarFicha(modelo) {
  const precio = modelo.filas.find((f) => f.pventa > 0)?.pventa || null;
  return {
    nombre: modelo.color ? `${modelo.modelo} (${modelo.color})` : modelo.modelo,
    categoria: modelo.cat,
    color: modelo.color || null,
    precio,
    talles: tallesDisponibles(modelo),
    foto: state.productoFotos[modelo.key] || null,
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
  }, () => {}); // si todavía no existe la colección o no hay permiso, no rompe nada
  onSnapshot(collection(db, 'producto_fotos'), (snap) => {
    state.productoFotos = Object.fromEntries(snap.docs.map((d) => [d.id, d.data().url]));
    if (document.getElementById('prod-modal')?.classList.contains('open')) actualizarFotoModal();
    catalogoRefresh();
  }, () => {});
};
