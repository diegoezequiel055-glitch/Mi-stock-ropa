// ══════════════════════════════════════════
// EDITAR PRECIO DESDE "CATÁLOGO Y SITIO" — lógica pura (sin DOM ni Firestore).
//
// Cambia SOLO el precio por menor (`pventa`, efectivo/transferencia) de todas las filas de stock (talles) de un mismo producto
// (categoría | modelo | color). Mayorista, curva, costo y las ventas ya registradas no se tocan.
// El precio de tarjeta se calcula con precio-tarjeta.js (respeta `ptarjeta` manual y la configuración).
// ══════════════════════════════════════════
import { resolverPrecioTarjeta, ptarjetaValido } from './precio-tarjeta.js';

export const UMBRAL_CAMBIO_GRANDE = 0.5; // más de 50 % hacia arriba o hacia abajo → segunda confirmación

// Lo que se escribe en el campo ("35000", "35.000", " 35 000 "). Solo enteros mayores a 0.
export function validarPrecio(texto) {
  const t = String(texto ?? '').trim().replace(/[.\s]/g, '');
  if (t === '') return { ok: false, error: 'Escribí el precio.' };
  if (!/^\d+$/.test(t)) return { ok: false, error: 'El precio tiene que ser un número entero, sin letras ni decimales.' };
  const valor = Number(t);
  if (!Number.isSafeInteger(valor) || valor <= 0) return { ok: false, error: 'El precio tiene que ser mayor a 0.' };
  return { ok: true, valor };
}

// ¿El cambio supera el 50 % (hacia arriba o hacia abajo) respecto del precio actual?
export function esCambioGrande(antes, despues) {
  if (!(antes > 0)) return false;
  return Math.abs(despues - antes) / antes > UMBRAL_CAMBIO_GRANDE;
}

// Precio actual del producto = el que usa la ficha (primera fila con precio). `variosPrecios` avisa si los talles no coinciden.
export function precioActual(filas) {
  const con = (filas || []).filter((f) => f.pventa > 0);
  const precio = con.length ? con[0].pventa : 0;
  return { precio, variosPrecios: con.some((f) => f.pventa !== precio) };
}

// Qué se escribiría: una entrada por fila cuyo precio realmente cambia. `antes` sirve para Deshacer.
// Con borrarManual también se limpia `ptarjeta` (vuelve a automático = null).
export function planDeCambio(filas, nuevo, { borrarManual = false } = {}) {
  const cambios = [];
  for (const f of filas || []) {
    const c = { id: f.id, talle: f.talle, pventaAntes: f.pventa ?? null, ptarjetaAntes: f.ptarjeta ?? null };
    c.cambiaPrecio = f.pventa !== nuevo;
    c.cambiaManual = borrarManual && f.ptarjeta != null;
    if (c.cambiaPrecio || c.cambiaManual) cambios.push(c);
  }
  return cambios;
}

// Campos a escribir en una fila (nunca costo, mayorista ni curva).
export const camposNuevos = (c, nuevo) => {
  const o = {};
  if (c.cambiaPrecio) o.pventa = nuevo;
  if (c.cambiaManual) o.ptarjeta = null;
  return o;
};
// Campos para volver atrás una fila (solo lo que se cambió).
export const camposDeshacer = (c) => {
  const o = {};
  if (c.cambiaPrecio) o.pventa = c.pventaAntes;
  if (c.cambiaManual) o.ptarjeta = c.ptarjetaAntes;
  return o;
};

// Vista previa en vivo con el precio que se está escribiendo.
// → { tarjeta, cuota, manual, manualIgnorado } ; tarjeta=null si no corresponde (p. ej. recargo 0 %).
//   manual = hay ptarjeta cargado; manualIgnorado = hay uno pero con el precio nuevo ya no es mayor, se ignora.
export function vistaPrevia(filas, nuevo, config) {
  const simuladas = (filas || []).map((f) => ({ pventa: nuevo, ptarjeta: f.ptarjeta }));
  const r = resolverPrecioTarjeta(simuladas, nuevo, config);
  const hayManual = (filas || []).some((f) => f.ptarjeta != null && f.ptarjeta !== '');
  return {
    tarjeta: r.valor,
    cuota: r.valor ? Math.round(r.valor / 3) : null, // igual que la tienda (precios.js: montoCuota)
    manual: r.manual,
    manualIgnorado: hayManual && !(simuladas.some((f) => ptarjetaValido(f.ptarjeta, nuevo))),
  };
}

// ptarjeta manual del producto (el de la fila de menor precio entre las válidas) para mostrarlo en pantalla.
export function manualDelProducto(filas) {
  const { precio } = precioActual(filas);
  const r = resolverPrecioTarjeta(filas, precio, { pct: 0, redondeo: 0 });
  return r.manual ? r.valor : ((filas || []).find((f) => f.ptarjeta != null)?.ptarjeta ?? null);
}
