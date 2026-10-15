// Pruebas puras del precio de tarjeta (precio-tarjeta.js). Correr: node test-precio-tarjeta.mjs
import assert from 'node:assert/strict';
import { REDONDEOS, POR_DEFECTO, configPrecioTarjeta, validarConfig, calcularPrecioTarjeta, ptarjetaValido, resolverPrecioTarjeta, conPrecioTarjeta, vistaPrevia } from './precio-tarjeta.js';

let n = 0; const ok = (t) => { n++; console.log('  ✔ ' + t); };

console.log('Cálculo');
assert.equal(calcularPrecioTarjeta(38000, 27, 0), 48260);   // sin redondeo
assert.equal(calcularPrecioTarjeta(38000, 27, 500), 48500); // 38.000 → 48.260 → 48.500
assert.equal(calcularPrecioTarjeta(40000, 27, 0), 50800);
assert.equal(calcularPrecioTarjeta(40000, 27, 500), 51000); // 40.000 → 50.800 → 51.000
assert.equal(calcularPrecioTarjeta(38000, 27, 100), 48300);
assert.equal(calcularPrecioTarjeta(38000, 27, 1000), 49000);
assert.equal(calcularPrecioTarjeta(40000, 27, 100), 50800);
assert.equal(calcularPrecioTarjeta(40000, 27, 1000), 51000);
ok('38.000 → 48.260 → 48.500 · 40.000 → 50.800 → 51.000 · redondeo 100 y 1000 · sin redondeo');
assert.equal(calcularPrecioTarjeta(38000, 0, 500), 38000);
assert.equal(calcularPrecioTarjeta(38000, 0, 0), 38000);
ok('porcentaje 0 → el mismo precio (y por eso no hay precio de tarjeta)');
// un múltiplo exacto NO debe subir por error de coma flotante
assert.equal(calcularPrecioTarjeta(50000, 20, 500), 60000);
assert.equal(calcularPrecioTarjeta(10000, 15, 500), 11500);
assert.equal(calcularPrecioTarjeta(30000, 10, 1000), 33000);
assert.equal(calcularPrecioTarjeta(33333, 27, 0), 42333); // 42332,91 → hacia arriba al peso
assert.equal(calcularPrecioTarjeta(38000, 27.5, 500), 48500); // 48450 → 48500
ok('múltiplos exactos no suben (60.000, 11.500, 33.000); sin redondeo sube al peso; porcentaje con decimales');
assert.equal(calcularPrecioTarjeta(0, 27, 500), null);
assert.equal(calcularPrecioTarjeta(null, 27, 500), null);
assert.equal(calcularPrecioTarjeta(-5, 27, 500), null);
ok('sin precio de efectivo → null');
for (let precio = 1000; precio <= 200000; precio += 250) for (const r of REDONDEOS) for (const pct of [0, 5, 27, 33.3, 100]) {
  const v = calcularPrecioTarjeta(precio, pct, r);
  assert.ok(v >= precio * (1 + pct / 100) - 1e-6, `nunca por debajo del bruto ${precio}/${pct}/${r}`);
  assert.ok(v - precio * (1 + pct / 100) < (r || 1) + 1e-6, `redondeo hacia arriba mínimo ${precio}/${pct}/${r}`);
  if (r) assert.equal(v % r, 0);
}
ok('barrido de 800 precios × 4 redondeos × 5 porcentajes: siempre ≥ bruto, a menos de un paso, múltiplo exacto');

console.log('\nPrecio manual (ptarjeta) por producto');
const cfg = { pct: 27, redondeo: 500, mostrar: true };
const fila = (pventa, ptarjeta) => ({ pventa, ptarjeta });
assert.deepEqual(resolverPrecioTarjeta([fila(38000, 55000)], 38000, cfg), { valor: 55000, manual: true }); // tal cual, sin recargo ni redondeo
assert.deepEqual(resolverPrecioTarjeta([fila(38000, 48123)], 38000, cfg), { valor: 48123, manual: true });
ok('manual válido (mayor que efectivo): se usa tal cual, aunque no sea múltiplo de nada');
assert.deepEqual(resolverPrecioTarjeta([fila(38000, 38000)], 38000, cfg), { valor: 48500, manual: false });
assert.deepEqual(resolverPrecioTarjeta([fila(38000, 30000)], 38000, cfg), { valor: 48500, manual: false });
assert.deepEqual(resolverPrecioTarjeta([fila(38000, 0)], 38000, cfg), { valor: 48500, manual: false });
assert.deepEqual(resolverPrecioTarjeta([fila(38000, 'abc')], 38000, cfg), { valor: 48500, manual: false });
ok('manual inválido (igual, menor, cero o texto): se ignora y se calcula automático');
assert.deepEqual(resolverPrecioTarjeta([fila(38000, null)], 38000, cfg), { valor: 48500, manual: false });
assert.deepEqual(resolverPrecioTarjeta([fila(38000, undefined)], 38000, cfg), { valor: 48500, manual: false });
assert.deepEqual(resolverPrecioTarjeta([fila(38000, '')], 38000, cfg), { valor: 48500, manual: false });
ok('manual vacío (null / sin el campo / ""): automático (así se "borra" el manual)');
assert.deepEqual(resolverPrecioTarjeta([fila(38000, null)], 38000, { pct: 0, redondeo: 500 }), { valor: null, manual: false });
assert.deepEqual(resolverPrecioTarjeta([fila(0, null)], 0, cfg), { valor: null, manual: false });
ok('con 0 % o sin precio: no hay precio de tarjeta (solo se publica si es mayor que efectivo)');

console.log('\nVarias filas (talles) con distinto ptarjeta');
// Se usa el de la fila de MENOR precio de efectivo entre las que tienen un manual válido.
assert.deepEqual(resolverPrecioTarjeta([fila(40000, 60000), fila(38000, 52000), fila(42000, 70000)], 38000, cfg), { valor: 52000, manual: true });
// la de menor precio no tiene manual: se usa la de menor precio ENTRE las que sí tienen
assert.deepEqual(resolverPrecioTarjeta([fila(38000, null), fila(40000, 60000), fila(42000, 70000)], 38000, cfg), { valor: 60000, manual: true });
// manuales inválidos no cuentan
assert.deepEqual(resolverPrecioTarjeta([fila(38000, 30000), fila(40000, 60000)], 38000, cfg), { valor: 60000, manual: true });
// empate de precio: la primera
assert.deepEqual(resolverPrecioTarjeta([fila(38000, 61000), fila(38000, 52000)], 38000, cfg), { valor: 61000, manual: true });
// ninguna con manual: automático
assert.deepEqual(resolverPrecioTarjeta([fila(38000, null), fila(38000, null)], 38000, cfg), { valor: 48500, manual: false });
ok('menor precio de efectivo entre las filas con manual válido; empate = la primera; sin manual = automático');

console.log('\nConfiguración');
assert.deepEqual(configPrecioTarjeta(undefined), POR_DEFECTO);
assert.deepEqual(configPrecioTarjeta({}), { pct: 27, redondeo: 500, mostrar: false });
assert.deepEqual(configPrecioTarjeta({ recargoTarjetaPct: 30, redondeoTarjeta: 1000, mostrarPrecioTarjeta: true }), { pct: 30, redondeo: 1000, mostrar: true });
assert.deepEqual(configPrecioTarjeta({ recargoTarjetaPct: 0, redondeoTarjeta: 0 }), { pct: 0, redondeo: 0, mostrar: false });
assert.deepEqual(configPrecioTarjeta({ recargoTarjetaPct: 150, redondeoTarjeta: 250, mostrarPrecioTarjeta: 'true' }), { pct: 27, redondeo: 500, mostrar: false });
assert.deepEqual(configPrecioTarjeta({ recargoTarjetaPct: -1 }).pct, 27);
assert.equal(configPrecioTarjeta({ mostrarPrecioTarjeta: 1 }).mostrar, false);
ok('valores por defecto (27 %, $500, apagado); un valor inválido guardado vuelve al defecto; "mostrar" solo con true');
assert.deepEqual(validarConfig({ pct: '27', redondeo: '500' }), { ok: true, pct: 27, redondeo: 500 });
assert.deepEqual(validarConfig({ pct: '27,5', redondeo: 0 }), { ok: true, pct: 27.5, redondeo: 0 });
assert.deepEqual(validarConfig({ pct: ' 0 ', redondeo: '100' }), { ok: true, pct: 0, redondeo: 100 });
assert.deepEqual(validarConfig({ pct: '100', redondeo: '1000' }), { ok: true, pct: 100, redondeo: 1000 });
for (const malo of ['101', '-1', 'abc', '', '  ', '27%', null, undefined]) assert.equal(validarConfig({ pct: malo, redondeo: 500 }).ok, false, `pct ${malo}`);
assert.equal(validarConfig({ pct: '27', redondeo: '250' }).ok, false);
ok('validación: 0 a 100 (con coma o punto); rechaza 101, -1, texto, vacío y un redondeo fuera de la lista');

console.log('\nFicha de catalogo_publico');
const ficha = { nombre: 'X', categoria: 'Camisetas', color: null, precio: 38000, talles: [{ talle: 'M', stock: 2 }], fotos: ['a'], destacado: false, creadoEn: 1, actualizado: 2 };
const filas = [fila(38000, null)];
assert.equal(conPrecioTarjeta(ficha, filas, { pct: 27, redondeo: 500, mostrar: false }), ficha); // el MISMO objeto: nada cambia
assert.deepEqual(conPrecioTarjeta(ficha, filas, { pct: 27, redondeo: 500, mostrar: false }), ficha);
assert.ok(!('precioTarjeta' in conPrecioTarjeta(ficha, [fila(38000, 99999)], { pct: 27, redondeo: 500, mostrar: false })));
ok('interruptor apagado: la ficha sale idéntica, aun con ptarjeta manual cargado');
const on = conPrecioTarjeta(ficha, filas, cfg);
assert.deepEqual(on, { ...ficha, precioTarjeta: 48500 });
assert.deepEqual(Object.keys(on).filter((k) => !(k in ficha)), ['precioTarjeta']);
ok('interruptor encendido: la ficha suma solo precioTarjeta (todos los demás campos iguales)');
assert.ok(!('precioTarjeta' in conPrecioTarjeta(ficha, filas, { pct: 0, redondeo: 500, mostrar: true })));
assert.ok(!('precioTarjeta' in conPrecioTarjeta({ ...ficha, precio: null }, filas, cfg)));
assert.ok(!('precioTarjeta' in conPrecioTarjeta({ ...ficha, precio: 0 }, filas, cfg)));
ok('encendido pero sin recargo (0 %) o sin precio: no lleva precioTarjeta');
for (const precio of [15000, 20000, 25000, 38000, 40000, 55000, 67000, 99999]) for (const r of REDONDEOS) for (const pct of [1, 27, 50]) {
  const f = conPrecioTarjeta({ ...ficha, precio }, [fila(precio, null)], { pct, redondeo: r, mostrar: true });
  assert.ok(f.precioTarjeta > f.precio, `precioTarjeta > precio (${precio}/${r}/${pct})`);
}
ok('encendido: ninguna ficha queda con precioTarjeta menor o igual al precio');

console.log('\nVista previa');
assert.deepEqual(vistaPrevia(38000, null, cfg), { efectivo: 38000, tarjeta: 48500, manual: false });
assert.deepEqual(vistaPrevia(38000, 55000, cfg), { efectivo: 38000, tarjeta: 55000, manual: true });
assert.deepEqual(vistaPrevia(38000, 30000, cfg), { efectivo: 38000, tarjeta: 48500, manual: false });
assert.ok(ptarjetaValido(55000, 38000) && !ptarjetaValido(38000, 38000) && !ptarjetaValido(null, 38000));
ok('vista previa: automático, manual válido y manual ignorado');

console.log(`\nTodo OK: ${n} grupos de pruebas pasaron.`);
