// Emparejamiento de lo que interpretó la IA contra el stock real.
// Reglas exactas, sin IA: nunca elige un producto si hay más de una opción posible.

export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// camisetas→camiseta, negros→negro, shorts→short, pantalones→pantalon
const singular = (w) => (w.endsWith('ones') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
export const tokens = (s) => norm(s).split(' ').filter(Boolean).map(singular);

export const normTalle = (t) => String(t ?? '').toUpperCase().replace(/\s+/g, '');

// Palabras de "tipo de prenda" → categorías del stock (ya normalizadas) a las que pueden referirse.
const PALABRAS_CATEGORIA = {
  remera: ['camiseta', 'remera'], camiseta: ['camiseta'], camisa: ['camiseta'], conjunto: ['conjunto'],
  short: ['short'], pantalon: ['pantalon'], campera: ['campera'], buzo: ['buzo'], jean: ['jean'],
  chaleco: ['chaleco'], bermuda: ['bermuda'], perfume: ['perfume'],
};
const RELLENO = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'con', 'en', 'un', 'una', 'para', 'por', 'tipo', 'modelo', 'pack', 'surtido', 'nuevo', 'producto']);
// Palabras que describen la prenda: suman puntaje pero no son obligatorias para encontrarla.
const BLANDAS = new Set([...Object.keys(PALABRAS_CATEGORIA), 'musculosa']);

const coincide = (hay, t) => hay.some((h) => h === t || (t.length >= 4 && h.length >= 4 && (h.startsWith(t) || t.startsWith(h))));

// Agrupa las filas de stock (una por talle) en modelos: categoría + modelo + color.
export function armarModelos(stock) {
  const mapa = new Map();
  for (const p of stock) {
    const key = [norm(p.cat), norm(p.modelo), norm(p.color)].join('|');
    if (!mapa.has(key)) mapa.set(key, { key, cat: p.cat, modelo: p.modelo, color: p.color || '', catNorm: tokens(p.cat).join(' '), hay: [...tokens(p.modelo), ...tokens(p.color)], filas: [] });
    mapa.get(key).filas.push(p);
  }
  return [...mapa.values()];
}

export const filaPorTalle = (modelo, talle) => modelo.filas.find((f) => normTalle(f.talle) === normTalle(talle)) || null;

function categoriasPosibles(item, modelos) {
  const reales = new Set(modelos.map((m) => m.catNorm));
  const set = new Set();
  const ct = tokens(item.categoria).join(' ');
  if (ct && reales.has(ct)) set.add(ct);
  const toksProd = tokens(item.producto);
  if (toksProd.includes('remera')) { set.add('camiseta'); set.add('remera'); }
  if (!set.size) {
    const primera = toksProd.find((t) => PALABRAS_CATEGORIA[t]);
    if (primera) PALABRAS_CATEGORIA[primera].forEach((c) => set.add(c));
  }
  return new Set([...set].filter((c) => reales.has(c)));
}

// Devuelve los modelos que pueden corresponder al item, ordenados. Lista vacía = no encontrado.
// `aviso` explica si hubo que relajar un filtro (p. ej. el color).
export function buscarModelos(item, modelos) {
  const toks = tokens(item.producto).filter((t) => !RELLENO.has(t));
  const duros = toks.filter((t) => !BLANDAS.has(t));
  const blandos = toks.filter((t) => BLANDAS.has(t));
  const colorT = tokens(item.color);
  const cats = categoriasPosibles(item, modelos);
  if (!duros.length && !cats.size && !colorT.length) return { modelos: [], aviso: 'sin_datos' };

  const filtrar = (usarColor) => modelos.filter((m) =>
    (!cats.size || cats.has(m.catNorm)) &&
    duros.every((t) => coincide(m.hay, t)) &&
    (!usarColor || !colorT.length || colorT.every((t) => coincide(m.hay, t))));

  let lista = filtrar(true), aviso = null;
  if (!lista.length && colorT.length) { lista = filtrar(false); aviso = lista.length ? 'sin_color' : null; }

  const puntaje = (m) => blandos.filter((t) => coincide(m.hay, t)).length;
  lista.sort((a, b) => puntaje(b) - puntaje(a) || b.filas.reduce((s, f) => s + f.qty, 0) - a.filas.reduce((s, f) => s + f.qty, 0) || a.modelo.localeCompare(b.modelo));
  return { modelos: lista, aviso };
}

// ¿Se puede elegir solo? Únicamente si hay UNA sola opción posible.
export const eleccionAutomatica = (res) => (res.modelos.length === 1 ? res.modelos[0] : null);

export const etiquetaModelo = (m) => `${m.cat} · ${m.modelo}${m.color ? ' · ' + m.color : ''}`;
