// Pruebas puras del medio de pago (medio-pago.js). Correr: node test-medio-pago.mjs
// Los mensajes de WhatsApp de prueba tienen el formato que arma la tienda (tienda-premium/pedido-mensaje.js).
import assert from 'node:assert/strict';
import { MEDIOS, MEDIO_POR_DEFECTO, etiquetaMedio, medioValido, cobradoTarjetaLinea, resumenPorMedio, totalParaFacturar, medioDelMensaje, subtotalDelMensaje } from './medio-pago.js';

let n = 0; const ok = (t) => { n++; console.log('  ✔ ' + t); };
const cfg = { pct: 27, redondeo: 500, mostrar: true };
const fila = (pventa, ptarjeta) => ({ pventa, ptarjeta });

console.log('Cobrado con tarjeta por línea');
assert.equal(cobradoTarjetaLinea({ pventa: 35000, cant: 1, esMenor: true, filas: [fila(35000)], pventaStock: 35000 }, cfg), 44500);
assert.equal(cobradoTarjetaLinea({ pventa: 35000, cant: 2, esMenor: true, filas: [fila(35000)], pventaStock: 35000 }, cfg), 89000);
ok('35.000 → 44.500 con 27 % y redondeo 500 (×2 = 89.000)');
assert.equal(cobradoTarjetaLinea({ pventa: 38000, cant: 1, esMenor: true, filas: [fila(38000, 55000)], pventaStock: 38000 }, cfg), 55000);
ok('respeta el ptarjeta manual válido del producto');
assert.equal(cobradoTarjetaLinea({ pventa: 38000, cant: 1, esMenor: true, filas: [fila(38000, 30000)], pventaStock: 38000 }, cfg), 48500);
ok('un ptarjeta manual inválido (menor al de efectivo) se ignora → automático');
assert.equal(cobradoTarjetaLinea({ pventa: 30000, cant: 1, esMenor: true, filas: [fila(38000, 55000)], pventaStock: 38000 }, cfg), 38500);
ok('precio por menor escrito a mano (distinto al de stock): recargo automático sobre ese precio (30.000 → 38.500), sin usar el manual');
assert.equal(cobradoTarjetaLinea({ pventa: 28000, cant: 3, esMenor: false, filas: [fila(40000)], pventaStock: 40000 }, cfg), 84000);
ok('mayorista y curva no llevan recargo: se cobran a su precio');
assert.equal(cobradoTarjetaLinea({ pventa: 38000, cant: 1, esMenor: true, filas: [fila(38000)], pventaStock: 38000 }, { pct: 0, redondeo: 500 }), 38000);
assert.equal(cobradoTarjetaLinea({ pventa: 38000, cant: 1, esMenor: true, filas: [fila(38000)], pventaStock: 38000 }, { pct: 27, redondeo: 0 }), 48260);
assert.equal(cobradoTarjetaLinea({ pventa: 0, cant: 1, esMenor: true, filas: [], pventaStock: 0 }, cfg), 0);
ok('recargo 0 % → el de efectivo; sin redondeo → 48.260; sin precio → 0');
assert.equal(cobradoTarjetaLinea({ pventa: 35000, cant: 1, esMenor: true, filas: [fila(35000)], pventaStock: 35000 }, { pct: 27, redondeo: 500, mostrar: false }), 44500);
ok('cuenta con la config aunque el interruptor de la tienda esté apagado (es un dato interno de la venta)');

console.log('\nMedios');
assert.deepEqual(MEDIOS, ['Efectivo', 'Transferencia', 'Tarjeta']);
assert.equal(MEDIO_POR_DEFECTO, 'Transferencia');
assert.equal(etiquetaMedio(undefined), 'Sin dato'); assert.equal(etiquetaMedio('Tarjeta'), 'Tarjeta'); assert.equal(etiquetaMedio('Bitcoin'), 'Sin dato');
assert.equal(medioValido('Efectivo'), 'Efectivo'); assert.equal(medioValido(''), null);
ok('tres medios, defecto Transferencia, sin campo = "Sin dato"');

console.log('\nLectura del mensaje de WhatsApp (Carga rápida)');
const msg = (pago, subtotal, extra = '') => `¡Hola! Quiero hacer este pedido en TIENDAPREMIUM.OK:\nNombre: Juan\n• Camiseta — X (Talle M) x1 = $40.000\n\nSubtotal${extra}: $${subtotal}\nEntrega: Retiro en showroom\nEnvío: Sin costo (retiro)\nForma de pago: ${pago}\nTotal: $${subtotal}\n\nPedido a confirmar, sujeto a stock y costo de envío.`;
assert.equal(medioDelMensaje(msg('Efectivo', '65.000')), 'Efectivo');
assert.equal(medioDelMensaje(msg('Efectivo (Solo para entregas en CABA o zona AMBA.)', '65.000')), 'Efectivo');
assert.equal(medioDelMensaje(msg('Transferencia', '65.000')), 'Transferencia');
assert.equal(medioDelMensaje(msg('Tarjeta (hasta 3 cuotas sin interés)', '83.000')), 'Tarjeta');
assert.equal(medioDelMensaje(msg('Tarjeta', '65.000', ' (precio efectivo/transferencia)')), 'Tarjeta');
assert.equal(medioDelMensaje('Vendí una camiseta Boca talle M'), null);
assert.equal(medioDelMensaje('forma de pago: TARJETA'), 'Tarjeta');
assert.equal(medioDelMensaje('Forma de pago: Mercado Pago'), null);
ok('Efectivo, Transferencia, Tarjeta (con y sin leyenda de cuotas); sin línea → null (la pantalla usa Transferencia)');
assert.deepEqual(subtotalDelMensaje(msg('Tarjeta (hasta 3 cuotas sin interés)', '83.000')), { monto: 83000, esDeEfectivo: false });
assert.deepEqual(subtotalDelMensaje(msg('Tarjeta', '65.000', ' (precio efectivo/transferencia)')), { monto: 65000, esDeEfectivo: true });
assert.deepEqual(subtotalDelMensaje(msg('Efectivo', '1.234.567')), { monto: 1234567, esDeEfectivo: false });
assert.equal(subtotalDelMensaje('sin subtotal'), null);
ok('Subtotal del mensaje: $83.000, $65.000 (marcado "precio efectivo/transferencia") y $1.234.567');

console.log('\nDashboard');
const D = (d, h, m, c, p, cant = 1) => ({ fecha: new Date(2026, 9, d, h).getTime(), pventa: p, cant, ...(m ? { medioPago: m } : {}), ...(c != null ? { cobradoTarjeta: c } : {}) });
const desde = new Date(2026, 9, 1).getTime(), hasta = new Date(2026, 10, 1).getTime();
const historicas = Array.from({ length: 779 }, (_, i) => D(1 + (i % 14), 12, null, null, 40000));
let r = resumenPorMedio(historicas, desde, hasta); let f = totalParaFacturar(historicas, desde, hasta);
assert.equal(r.filas.find((x) => x.medio === 'Sin dato').n, 779); assert.equal(r.filas.find((x) => x.medio === 'Sin dato').monto, 779 * 40000);
assert.ok(r.filas.filter((x) => x.medio !== 'Sin dato').every((x) => x.n === 0 && x.monto === 0));
assert.equal(f.total, 0); assert.equal(f.transferencia.n, 0); assert.equal(f.tarjeta.n, 0);
ok('779 ventas históricas: todas "Sin dato" y Total para facturar = 0');
const mix = [...historicas, D(2, 10, 'Efectivo', null, 40000), D(3, 10, 'Transferencia', null, 40000), D(3, 11, 'Transferencia', null, 25000, 2), D(4, 10, 'Tarjeta', 51000, 40000), D(5, 10, 'Tarjeta', 89000, 35000, 2), D(6, 10, 'Efectivo', null, 38000)];
r = resumenPorMedio(mix, desde, hasta); f = totalParaFacturar(mix, desde, hasta);
const fila_ = (m) => r.filas.find((x) => x.medio === m);
assert.deepEqual([fila_('Efectivo').n, fila_('Efectivo').monto], [2, 78000]);
assert.deepEqual([fila_('Transferencia').n, fila_('Transferencia').monto], [2, 90000]);
assert.deepEqual([fila_('Tarjeta').n, fila_('Tarjeta').monto], [2, 110000]);
assert.equal(fila_('Sin dato').n, 779);
assert.equal(f.transferencia.monto, 90000); assert.equal(f.tarjeta.cobrado, 51000 + 89000); assert.equal(f.total, 90000 + 140000);
ok('por medio (cantidad y monto a precio de venta) y Total para facturar = Transferencia 90.000 + Tarjeta cobrado 140.000 = 230.000; efectivo y sin dato no entran');
assert.equal(f.tarjeta.aPrecioVenta, 110000);
const fuera = [{ ...D(30, 12, 'Transferencia', null, 99999), fecha: new Date(2026, 8, 30).getTime() }];
assert.equal(totalParaFacturar(fuera, desde, hasta).total, 0); assert.equal(resumenPorMedio(fuera, desde, hasta).n, 0);
ok('respeta el período elegido');
f = totalParaFacturar([D(2, 9, 'Tarjeta', null, 40000)], desde, hasta);
assert.equal(f.tarjetaSinCobrado, 1); assert.equal(f.total, 40000);
ok('una venta Tarjeta sin cobradoTarjeta cuenta a precio de venta y se avisa');

console.log(`\nTodo OK: ${n} grupos de pruebas pasaron.`);
