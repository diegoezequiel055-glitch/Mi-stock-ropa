// Prueba de que pasar las categorías a plural NO cambia ningún ID de catalogo_publico ni de producto_fotos.
// Usa un backup real (carpeta backups/AAAA-MM-DD del repo mi-stock-ropa-backups). Esos datos son privados:
// NO se guardan en este repo, se pasan por parámetro.
//
//   node test-categorias.mjs RUTA\mi-stock-ropa-backups\backups\2026-10-14
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { claveModelo, norm } from './matching.js';
import { CATEGORIAS, claveCat, catPlural, mismaCat, categoriasUnicas } from './categorias.js';

const dir = process.argv[2] || process.env.BACKUP_DIR;
if (!dir) { console.error('Falta la carpeta del backup. Uso: node test-categorias.mjs RUTA/backups/AAAA-MM-DD'); process.exit(1); }
const leer = (n) => JSON.parse(readFileSync(`${dir}/${n}.json`, 'utf8'));
const stock = leer('stock').map((d) => ({ id: d._id, ...d.datos }));
const publicados = leer('catalogo_publico').map((d) => d._id);
const fotos = leer('producto_fotos');
const fotosPorId = new Map(fotos.map((d) => [d._id, d.datos.fotos || []]));
let pruebas = 0;
const ok = (msg) => { pruebas++; console.log('  ✔ ' + msg); };

// Fórmula ANTERIOR (la que generó los IDs que existen hoy)
const claveVieja = (p) => [norm(p.cat), norm(p.modelo), norm(p.color)].join('|');
// Cambio de datos propuesto (tabla aprobada): categoría vieja → plural
const APROBADA = { Camiseta: 'Camisetas', Conjunto: 'Conjuntos', Campera: 'Camperas', 'Pantalón': 'Pantalones', Short: 'Shorts', Buzo: 'Buzos', Bermuda: 'Bermudas', Jean: 'Jeans', Perfume: 'Perfumes', 'Gorra G5': 'Gorras' };
const migrado = (p) => ({ ...p, cat: APROBADA[p.cat] || p.cat });

console.log(`Backup: ${dir}\n  ${stock.length} productos, ${publicados.length} fichas en catalogo_publico, ${fotos.length} en producto_fotos\n`);

// 1) La tabla cubre todas las categorías del stock, y cada una se migra a una que está en la tabla
const catsStock = [...new Set(stock.map((p) => p.cat))];
for (const c of catsStock) assert.ok(CATEGORIAS.some((t) => t.plural === (APROBADA[c] || c)), `categoría sin fila en la tabla: ${c}`);
ok(`las ${catsStock.length} categorías del stock están en la tabla`);

// 2) Para CADA producto del stock, el ID con el código nuevo es idéntico al de siempre (antes y después de migrar)
let distintos = 0;
for (const p of stock) {
  const v = claveVieja(p);
  if (claveModelo(p) !== v) distintos++;
  if (claveModelo(migrado(p)) !== v) distintos++;
}
assert.equal(distintos, 0);
ok(`${stock.length} productos: ID nuevo = ID viejo, con la categoría actual y con la plural`);

// 3) Regenerar el catálogo: los modelos marcados, con foto + precio + talle con stock (misma regla que catalogo.js)
const regenerar = (lista) => {
  const modelos = new Map();
  for (const p of lista.filter((x) => x.catalogo === true)) {
    const k = claveModelo(p);
    if (!modelos.has(k)) modelos.set(k, []);
    modelos.get(k).push(p);
  }
  return [...modelos].filter(([k, filas]) =>
    (fotosPorId.get(k) || []).length > 0 && filas.some((f) => f.pventa > 0) && filas.some((f) => f.qty > 0)).map(([k]) => k).sort();
};
const esperado = [...publicados].sort();
assert.deepEqual(regenerar(stock), esperado);
ok(`catalogo_publico: se regeneran las ${esperado.length} fichas con IDs idénticos (stock como está hoy)`);
assert.deepEqual(regenerar(stock.map(migrado)), esperado);
ok(`catalogo_publico: se regeneran las ${esperado.length} fichas con IDs idénticos (stock ya migrado a plural)`);

// 4) producto_fotos: los 34 IDs. Cada uno se arma de nuevo desde su categoría en plural y da exactamente el mismo
let nFotos = 0;
for (const { _id } of fotos) {
  const [clave, modelo, color] = _id.split('|');
  const fila = CATEGORIAS.find((t) => t.clave === clave);
  assert.ok(fila, `foto con categoría fuera de la tabla: ${_id}`);
  assert.equal(claveModelo({ cat: fila.plural, modelo, color }), _id, `ID de foto cambiaría: ${_id}`);
  assert.equal(claveModelo({ cat: clave, modelo, color }), _id);
  nFotos++;
}
assert.equal(nFotos, fotos.length);
ok(`producto_fotos: los ${nFotos} IDs se regeneran idénticos desde la categoría en plural (incluye ${fotos.filter((f) => !stock.some((p) => claveVieja(p) === f._id)).length} sin producto en stock hoy)`);

// 5) Casos especiales pedidos
assert.equal(claveModelo({ cat: 'Gorra G5', modelo: 'Bulls', color: 'Roja' }), 'gorra g5|bulls|roja');
assert.equal(claveModelo({ cat: 'Gorras', modelo: 'Bulls', color: 'Roja' }), 'gorra g5|bulls|roja');
ok('Gorra G5 y Gorras generan exactamente "gorra g5|bulls|roja"');
for (const c of ['Chombas', 'Chalecos', 'Remeras']) assert.equal(claveModelo({ cat: c, modelo: 'x', color: '' }), `${c.toLowerCase()}|x|`);
ok('Chombas, Chalecos y Remeras mantienen su clave actual');

// 6) Funciones de equivalencia
assert.ok(mismaCat('Camiseta', 'camisetas ') && mismaCat('PANTALÓN', 'Pantalones') && !mismaCat('Camisetas', 'Conjuntos'));
assert.equal(catPlural('Gorra G5'), 'Gorras');
assert.equal(catPlural('Categoría nueva'), 'Categoría nueva');
assert.deepEqual(categoriasUnicas(['Camiseta', 'Camisetas', 'Conjunto', 'Chombas', 'Pantalón', '']), ['Camisetas', 'Chombas', 'Conjuntos', 'Pantalones']);
ok('singular y plural se reconocen como la misma categoría; el menú no repite');

// 7) La categoría automática en plural NO altera las que ya están bien y no crea duplicados
for (const c of catsStock) {
  const esperada = APROBADA[c] || c;
  if (c === 'Gorra G5') continue; // la edita Diego a mano
  assert.equal(catPlural(c), esperada, `${c} → ${catPlural(c)}`);
  assert.equal(catPlural(esperada), esperada, `${esperada} no debe cambiar`);
}
for (const [escrito, final] of [['chombas', 'Chombas'], ['CHOMBAS ', 'Chombas'], ['Chomba', 'Chombas'], ['chalecos', 'Chalecos'], ['Chaleco', 'Chalecos'], ['remeras', 'Remeras'], ['Remera', 'Remeras'], ['camiseta', 'Camisetas'], ['PANTALON', 'Pantalones'], ['Zapatillas', 'Zapatillas']]) {
  assert.equal(catPlural(escrito), final, `${escrito} → ${catPlural(escrito)}`);
}
ok('Chombas, Chalecos y Remeras quedan igual; escrito en singular o con otra forma no crea una categoría nueva');

console.log(`\nTodo OK: ${pruebas} pruebas pasaron.`);
