// ══════════════════════════════════════════
// DOCUMENTOS ÚNICOS PARA LA TIENDA (catálogo y localidades de envío) — lógica pura (sin DOM ni Firebase).
// Se prueba con `node test-catalogo-sync.mjs` (y el mismo formato lo lee tienda-premium › catalogo-bundle.js).
//
// Por qué: la tienda leía una colección entera en cada visita (73 fichas + 152 localidades = ~226 lecturas). Ahora lee UN documento
// de catálogo y UNO de localidades (2 lecturas, más la configuración = 3). Las colecciones `catalogo_publico` y `envios_publico`
// SIGUEN existiendo y sincronizándose: son el respaldo (la tienda vuelve a leerlas si estos documentos no existen o fallan).
//
// FORMATO (colección `config_sitio`, lectura pública / escritura solo del dueño — sin reglas nuevas):
//   documento `catalogo` (parte 1), `catalogo_2`, `catalogo_3`... y `envios`, `envios_2`...
//   { v: 1, parte: k, partes: N, total: <fichas en TODAS las partes>, hash: "<hash de todo el contenido>",
//     datos: "<JSON (texto) de un arreglo de elementos de esta parte>", actualizado: <ms> }
//   catálogo: elemento = { id: <clave del modelo>, ...ficha SIN `actualizado` }     envíos: { id, localidad, precio, estimado }
// Límite de Firestore: 1 MiB por documento. Cada parte se arma con hasta LIMITE_PARTE bytes (600 KB): al llegar a ese tamaño el
// contenido se reparte solo en más partes (la tienda lee N documentos). Hoy: 73 fichas ≈ 46 KB (una parte de 600 KB entra ~950 fichas).
// `datos` va como TEXTO (no como arreglo de mapas) para que Firestore no cree un índice por elemento y no haya límites de anidado.
// ══════════════════════════════════════════

export const LIMITE_PARTE = 600000; // bytes de `datos` por documento (el límite de Firestore es 1 MiB)
export const VERSION = 1;

export const idParte = (base, k) => (k === 1 ? base : `${base}_${k}`);

// Hash de 53 bits (cyrb53), igual en la tienda. Sirve para saber si el contenido cambió y para detectar partes desparejas.
export function hashTexto(s, semilla = 0) {
  let h1 = 0xdeadbeef ^ semilla, h2 = 0x41c6ce57 ^ semilla;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

const bytes = (s) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : unescape(encodeURIComponent(s)).length);

// items: arreglo de elementos (cada uno con `id`). Se ordenan por id para que el contenido sea siempre el mismo.
// Devuelve [{ id: <id del documento>, data: {v, parte, partes, total, hash, datos} }] (falta `actualizado`, que se agrega al escribir).
export function armarPartes(base, items, { limite = LIMITE_PARTE } = {}) {
  const orden = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const grupos = []; let actual = [], tam = 2;
  for (const it of orden) {
    const t = bytes(JSON.stringify(it)) + 1;
    if (actual.length && tam + t > limite) { grupos.push(actual); actual = []; tam = 2; }
    actual.push(it); tam += t;
  }
  grupos.push(actual); // (si no hay elementos queda una parte con [])
  const datos = grupos.map((g) => JSON.stringify(g));
  const hash = hashTexto(datos.join('\u0001'));
  return datos.map((d, i) => ({ id: idParte(base, i + 1), data: { v: VERSION, parte: i + 1, partes: datos.length, total: orden.length, hash, datos: d } }));
}

// actual: lo que hay publicado hoy ({ hash, partes } de la parte 1, o null si no existe). Devuelve qué escribir y qué borrar.
// Si el contenido no cambió: nada (0 escrituras, nadie relee).
export function planBundle(base, nuevas, actual, sello = Date.now()) {
  const n = nuevas.length;
  if (actual && actual.hash === nuevas[0].data.hash && actual.partes === n) return { escribir: [], borrar: [] };
  const borrar = [];
  if (actual && actual.partes > n) for (let k = n + 1; k <= actual.partes; k++) borrar.push(idParte(base, k));
  return { escribir: nuevas.map((p) => [p.id, { ...p.data, actualizado: sello }]), borrar };
}

// Elementos a partir de lo que debería estar publicado (Map id → ficha / localidad).
export const itemsCatalogo = (deseados) => [...deseados].map(([id, f]) => { const { actualizado, ...resto } = f; return { id, ...resto }; });
export const itemsEnvios = (deseados) => [...deseados].map(([id, e]) => ({ id, ...e }));
