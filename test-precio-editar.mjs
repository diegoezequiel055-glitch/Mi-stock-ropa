// Pruebas puras de precio-editar.js. Correr: node test-precio-editar.mjs
import assert from 'node:assert/strict';
import { validarPrecio, esCambioGrande, precioActual, planDeCambio, camposNuevos, camposDeshacer, vistaPrevia, manualDelProducto } from './precio-editar.js';
let n = 0; const ok = (t) => { n++; console.log('  ✔ ' + t); };
const cfg = { pct: 27, redondeo: 500, mostrar: true };
const filas = [
  { id: 'a', talle: 'S', pventa: 35000, pmayorista: 20000, pcurva: 18000, costo: 10000 },
  { id: 'b', talle: 'M', pventa: 35000, pmayorista: 20000, pcurva: 18000, costo: 10000 },
  { id: 'c', talle: 'L', pventa: 35000, pmayorista: 20000, pcurva: 18000, costo: 10000, ptarjeta: 50000 },
];
console.log('Validación');
assert.deepEqual(validarPrecio('35000'), { ok: true, valor: 35000 });
assert.equal(validarPrecio('35.000').valor, 35000);
for (const mal of ['0', '-5', 'abc', '', '  ', '12,5', '1e5', '10.5.x', '-0']) assert.equal(validarPrecio(mal).ok, false, mal);
ok('enteros > 0 (acepta 35.000); rechaza 0, negativos, texto, vacío, decimales');
console.log('Cambio grande');
assert.equal(esCambioGrande(10000, 15000), false); assert.equal(esCambioGrande(10000, 15001), true);
assert.equal(esCambioGrande(10000, 5000), false); assert.equal(esCambioGrande(10000, 4999), true);
assert.equal(esCambioGrande(35000, 350000), true); assert.equal(esCambioGrande(35000, 3500), true);
ok('50 % justo no pide segunda confirmación; más de 50 % hacia arriba o abajo sí');
console.log('Plan y campos');
let plan = planDeCambio(filas, 40000);
assert.equal(plan.length, 3);
for (const c of plan) { const o = camposNuevos(c, 40000); assert.deepEqual(Object.keys(o), ['pventa']); }
ok('todas las filas (talles) cambian, y solo se escribe pventa (mayorista, curva, costo y ptarjeta no viajan)');
plan = planDeCambio(filas, 35000); assert.equal(plan.length, 0); ok('mismo precio: nada que cambiar');
plan = planDeCambio(filas, 40000, { borrarManual: true });
assert.deepEqual(camposNuevos(plan[2], 40000), { pventa: 40000, ptarjeta: null }); assert.deepEqual(camposNuevos(plan[0], 40000), { pventa: 40000 });
ok('borrar manual: solo la fila con ptarjeta lo recibe (null = automático)');
plan = planDeCambio(filas, 40000, { borrarManual: true });
assert.deepEqual(camposDeshacer(plan[2]), { pventa: 35000, ptarjeta: 50000 }); assert.deepEqual(camposDeshacer(plan[0]), { pventa: 35000 });
ok('Deshacer devuelve el precio (y el manual) anteriores de cada fila');
const mixtas = [{ id: 'x', pventa: 30000 }, { id: 'y', pventa: 35000 }];
assert.equal(precioActual(mixtas).precio, 30000); assert.equal(precioActual(mixtas).variosPrecios, true);
assert.deepEqual(camposDeshacer(planDeCambio(mixtas, 40000)[0]), { pventa: 30000 }); assert.deepEqual(camposDeshacer(planDeCambio(mixtas, 40000)[1]), { pventa: 35000 });
ok('talles con precios distintos: se avisa y Deshacer restaura cada uno');
console.log('Vista previa');
const sinManual = filas.slice(0, 2);
let v = vistaPrevia(sinManual, 35000, cfg); assert.equal(v.tarjeta, 44500); assert.equal(v.cuota, 14833); assert.equal(v.manual, false);
ok('35.000 → tarjeta 44.500, 3 cuotas de 14.833');
v = vistaPrevia(filas, 35000, cfg); assert.equal(v.tarjeta, 50000); assert.equal(v.manual, true); assert.equal(v.cuota, 16667);
v = vistaPrevia(filas, 60000, cfg); assert.equal(v.manual, false); assert.equal(v.manualIgnorado, true); assert.equal(v.tarjeta, 76500);
ok('respeta el manual si sigue siendo mayor; si el precio nuevo lo iguala o supera, se ignora y se avisa');
assert.equal(vistaPrevia(sinManual, 35000, { pct: 0, redondeo: 500 }).tarjeta, null);
ok('recargo 0 %: sin precio de tarjeta');
assert.equal(manualDelProducto(filas), 50000); assert.equal(manualDelProducto(sinManual), null);
ok('manualDelProducto');
console.log(`\nTodo OK: ${n} grupos de pruebas pasaron.`);
