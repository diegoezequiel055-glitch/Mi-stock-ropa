// ══════════════════════════════════════════
// CATEGORÍAS DE LA PORTADA — lógica pura (sin DOM ni Firestore). Se prueba con `node test-categorias-portada.mjs`.
//
// La tienda muestra, en la portada, "Comprar por categoría": un carrusel de tarjetas grandes con foto, una por categoría (tienda-premium › categorias-portada.js).
// Lo que se carga acá (Catálogo y sitio › "Categorías de la portada") se guarda en config_sitio/config › categoriasPortada:
//     { "Camisetas": { foto: "https://res.cloudinary.com/...jpg", frase: "Las de la temporada" }, ... }
//   (nombre de la categoría en PLURAL → foto y frase corta, ambas opcionales). Va dentro del documento de config que la tienda ya lee: sin colecciones
//   nuevas, sin lecturas extra, sin tocar las reglas.
// FOTO de cada categoría, por orden de prioridad: 1) la que se carga acá; 2) si no hay, la foto principal del último producto ingresado de esa categoría
// (la tienda lo resuelve sola); 3) sin productos, la categoría no se muestra.
// FRASE: texto corto opcional (máx. 30 caracteres) que se ve arriba del nombre; vale con cualquiera de las dos fotos.
// Recomendación para la foto: vertical 1080×1350 px (4:5), con lo importante al centro (la tarjeta la recorta con "cover").
// ══════════════════════════════════════════
import { CATEGORIAS, claveCat, catPlural } from './categorias.js';
import { claveModelo } from './matching.js';

export const RECOMENDACION = 'Foto vertical 1080×1350 px (4:5). Lo importante al centro.';
export const MAX_FRASE = 30;

export const urlValida = (u) => typeof u === 'string' && /^https:\/\/[^\s"'<>]{4,600}$/.test(u.trim());
export const limpiarFrase = (f) => String(f ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_FRASE);

// Lo guardado (puede faltar o venir raro) → { "Camisetas": { foto?, frase? } } con nombres en plural; solo fotos https; sin entradas vacías; una por categoría (gana la primera).
export function leerCategorias(cfg) {
  const m = cfg && cfg.categoriasPortada; const salida = {}, vistas = new Set();
  if (!m || typeof m !== 'object' || Array.isArray(m)) return salida;
  for (const [nombre, v] of Object.entries(m)) {
    if (!String(nombre).trim() || !v || typeof v !== 'object' || Array.isArray(v)) continue;
    const e = {}; if (urlValida(v.foto)) e.foto = v.foto.trim(); const fr = limpiarFrase(v.frase); if (fr) e.frase = fr;
    if (!e.foto && !e.frase) continue;
    const clave = claveCat(nombre); if (!clave || vistas.has(clave)) continue;
    vistas.add(clave); salida[catPlural(nombre)] = e;
  }
  return salida;
}

// Categorías para las filas de la tarjeta: las que hay en el stock (todas las filas) y las que ya tienen foto o frase cargada; una sola por categoría,
// con nombre en plural, en el orden de la tabla de categorías (después, las que no están en la tabla, por nombre).
export function categoriasDeFilas(filasStock, datos = {}) {
  const m = new Map();
  for (const f of filasStock || []) { const c = String(f.cat ?? '').trim(); if (c && !m.has(claveCat(c))) m.set(claveCat(c), catPlural(c)); }
  for (const nombre of Object.keys(datos || {})) if (!m.has(claveCat(nombre))) m.set(claveCat(nombre), catPlural(nombre));
  const orden = (nombre) => { const i = CATEGORIAS.findIndex((c) => c.plural === nombre); return i === -1 ? 999 : i; };
  return [...m.entries()].map(([clave, nombre]) => ({ clave, nombre })).sort((a, b) => orden(a.nombre) - orden(b.nombre) || a.nombre.localeCompare(b.nombre, 'es'));
}

// Cuántos modelos de la categoría están marcados para el catálogo (la tienda solo muestra categorías con productos publicados).
export const modelosEnCatalogo = (filasStock, clave) => new Set((filasStock || []).filter((f) => f.catalogo === true && claveCat(f.cat) === clave).map(claveModelo)).size;

// Foto principal del último producto ingresado de la categoría (por fecha de alta del modelo: la más chica de sus filas), entre los marcados para el
// catálogo y con foto. productoFotos = { claveModelo: [urls] }. null si no hay. (Es lo que la tienda usa cuando no hay una foto cargada.)
export function ultimaFotoCategoria(filasStock, productoFotos, clave) {
  const modelos = new Map();
  for (const f of filasStock || []) {
    if (f.catalogo !== true || claveCat(f.cat) !== clave) continue;
    const k = claveModelo(f); const t = Number(f.createdAt) || 0;
    const m = modelos.get(k); if (!m) modelos.set(k, { k, t }); else m.t = Math.min(m.t, t);
  }
  let mejor = null;
  for (const m of modelos.values()) {
    const foto = ((productoFotos || {})[m.k] || []).find(urlValida); if (!foto) continue;
    if (!mejor || m.t > mejor.t) mejor = { t: m.t, foto };
  }
  return mejor ? mejor.foto : null;
}

// Mapas nuevos (no modifican el original). Una entrada sin foto ni frase se borra. Los nombres se normalizan a plural y no quedan dos entradas de la misma categoría.
function cambiar(mapa, nombre, fn) {
  const n = catPlural(nombre), c = claveCat(n); const salida = {}; let previo = {};
  for (const [k, v] of Object.entries(mapa || {})) { if (claveCat(k) === c) previo = { ...v }; else salida[k] = { ...v }; }
  const nuevo = fn(previo);
  if (nuevo.foto || nuevo.frase) salida[n] = nuevo.foto && nuevo.frase ? { foto: nuevo.foto, frase: nuevo.frase } : (nuevo.foto ? { foto: nuevo.foto } : { frase: nuevo.frase });
  return salida;
}
export function conFoto(mapa, nombre, url) {
  if (!urlValida(url)) throw new Error('La foto no es válida.');
  return cambiar(mapa, nombre, (e) => ({ foto: url.trim(), frase: e.frase }));
}
export const sinFoto = (mapa, nombre) => cambiar(mapa, nombre, (e) => ({ frase: e.frase }));
export const conFrase = (mapa, nombre, texto) => cambiar(mapa, nombre, (e) => ({ foto: e.foto, frase: limpiarFrase(texto) }));

// Lo que escribe el panel: SOLO el campo categoriasPortada, REEMPLAZÁNDOLO entero (mergeFields; con merge:true un mapa se mezcla y "Quitar" no borraría nada).
export const camposPortada = (mapa) => ({ categoriasPortada: mapa });
export const OPCIONES_GUARDAR = { mergeFields: ['categoriasPortada'] };

// Miniatura de Cloudinary para las filas (no baja la foto de 1080 px entera). Otras urls o ya transformadas quedan igual.
export function miniatura(url, ancho = 240) {
  if (typeof url !== 'string') return url;
  const marca = '/image/upload/'; const i = url.indexOf(marca);
  if (i === -1 || !/^https:\/\/res\.cloudinary\.com\//.test(url)) return url;
  const resto = url.slice(i + marca.length); const primero = resto.split('/')[0];
  if (primero.includes(',') || /^(?:w|h|c|f|q|e|ar|g)_/.test(primero)) return url;
  return url.slice(0, i + marca.length) + `f_auto,q_auto:eco,c_limit,w_${ancho}/` + resto;
}
