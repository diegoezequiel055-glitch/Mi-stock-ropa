import { state } from './state.js';
import { db, collection, doc, writeBatch, onSnapshot } from './firebase-config.js';
import { armarModelos } from './matching.js';

// ══════════════════════════════════════════
// CATÁLOGO PÚBLICO — sincroniza sola la colección "catalogo_publico" con los
// talles marcados "Mostrar en catálogo". Corre en el navegador cada vez que
// cambia stock, precios o reservas; no depende de un servidor.
// Nunca lee ni escribe costo, mayorista ni curva — esos campos no existen acá.
// ══════════════════════════════════════════

let publicadosIds = new Set(); // ids que existen HOY en catalogo_publico (para saber qué borrar)
let escuchando = false;
let timer = null;

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
    foto: null, // se completa cuando esté conectado el hosting de fotos
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
};
