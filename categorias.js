// ══════════════════════════════════════════
// CATEGORÍAS — nombre visible (plural) y clave fija para los IDs.
//
// Las categorías del stock pasan a plural ("Camiseta" → "Camisetas"). Pero el ID de cada ficha de
// catalogo_publico y de producto_fotos se arma con la categoría (matching.js › claveModelo), y esos IDs
// ya están en links compartidos (?p=ID) y en las fotos. Por eso el ID NO usa el nombre visible: usa la
// "clave" de esta tabla, que es la que esos IDs ya tienen hoy ("camiseta", "conjunto", "buzo", "chombas"…;
// "gorra g5" para Gorras). Singular y plural dan siempre la misma clave.
//
// NO CAMBIAR las claves de esta tabla: cambiar una rompe links y fotos de esa categoría.
// ══════════════════════════════════════════
const n = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export const CATEGORIAS = [
  { plural: 'Camisetas', clave: 'camiseta' },
  { plural: 'Conjuntos', clave: 'conjunto' },
  { plural: 'Camperas', clave: 'campera' },
  { plural: 'Pantalones', clave: 'pantalon' },
  { plural: 'Shorts', clave: 'short' },
  { plural: 'Buzos', clave: 'buzo' },
  { plural: 'Bermudas', clave: 'bermuda' },
  { plural: 'Jeans', clave: 'jean' },
  { plural: 'Perfumes', clave: 'perfume' },
  { plural: 'Gorras', clave: 'gorra g5', alias: ['gorra'] },
  // ya estaban en plural: su clave es la de siempre
  { plural: 'Chombas', clave: 'chombas', alias: ['chomba'] },
  { plural: 'Chalecos', clave: 'chalecos', alias: ['chaleco'] },
  { plural: 'Remeras', clave: 'remeras', alias: ['remera'] },
];

const POR_TEXTO = new Map(); // texto normalizado (plural o clave) → fila de la tabla
CATEGORIAS.forEach((c) => { POR_TEXTO.set(n(c.plural), c); POR_TEXTO.set(c.clave, c); (c.alias || []).forEach((a) => POR_TEXTO.set(n(a), c)); });

// Clave para IDs y comparaciones: "Camiseta", "camisetas" y "CAMISETAS " dan "camiseta".
// Una categoría que no está en la tabla usa su nombre normalizado (como antes).
export const claveCat = (cat) => (POR_TEXTO.get(n(cat)) || { clave: n(cat) }).clave;

// Nombre para mostrar: el plural de la tabla; si no está en la tabla, el texto original.
export const catPlural = (cat) => (POR_TEXTO.get(n(cat)) || { plural: String(cat ?? '').trim() }).plural;

// Lo que se guarda al crear/editar un producto: el plural si es una categoría conocida; si no, lo escrito.
export const catCanonica = catPlural;

// Misma categoría aunque una esté en singular y otra en plural.
export const mismaCat = (a, b) => claveCat(a) === claveCat(b);

// Lista para menús y autocompletar: una sola entrada por categoría, en plural, ordenada.
export const categoriasUnicas = (lista) => {
  const m = new Map();
  for (const c of lista) { if (c && !m.has(claveCat(c))) m.set(claveCat(c), catPlural(c)); }
  return [...m.values()].sort((a, b) => a.localeCompare(b, 'es'));
};
