// ══════════════════════════════════════════
// MEDIO DE PAGO DE LAS VENTAS — lógica pura (sin DOM ni Firestore).
//
// Cada venta nueva guarda `medioPago` ("Efectivo" | "Transferencia" | "Tarjeta"). Las ventas anteriores no lo tienen:
// se muestran como "Sin dato" y NUNCA se tocan.
// Si el medio es Tarjeta se guarda además `cobradoTarjeta`: lo que paga el cliente por esa línea con el precio de tarjeta
// (precio-tarjeta.js: respeta `ptarjeta` manual y la configuración de recargo/redondeo). Es solo INFORMATIVO: ingresos y
// ganancia se siguen calculando con `pventa` (precio de efectivo/transferencia) como siempre.
// ══════════════════════════════════════════
import { calcularPrecioTarjeta, resolverPrecioTarjeta } from './precio-tarjeta.js';

export const MEDIOS = ['Efectivo', 'Transferencia', 'Tarjeta'];
export const MEDIO_POR_DEFECTO = 'Transferencia';
export const SIN_DATO = 'Sin dato';
export const medioValido = (m) => (MEDIOS.includes(m) ? m : null);
export const etiquetaMedio = (m) => medioValido(m) || SIN_DATO;

const esNum = (n) => typeof n === 'number' && Number.isFinite(n);

// Lo que paga el cliente por UNA línea de venta con Tarjeta.
//   • Solo el precio por MENOR lleva recargo: mayorista y curva se cobran a su precio.
//   • Menor al precio de stock → precio de tarjeta del producto (ptarjeta manual si es válido, si no el automático).
//   • Menor con otro precio escrito a mano → recargo automático sobre ese precio (la config actual).
//   • Si no corresponde precio de tarjeta (p. ej. recargo 0 %), se cobra el de efectivo.
// `filas` = filas de stock (talles) del modelo; `pventaStock` = precio por menor cargado en stock.
export function cobradoTarjetaLinea({ pventa, cant, esMenor, filas, pventaStock }, cfg) {
  if (!esNum(pventa) || pventa <= 0) return 0;
  let unit = pventa;
  if (esMenor) {
    if (pventa === pventaStock) {
      const r = resolverPrecioTarjeta(filas || [], pventa, cfg);
      if (r.valor) unit = r.valor;
    } else {
      const auto = calcularPrecioTarjeta(pventa, cfg.pct, cfg.redondeo);
      if (auto > pventa) unit = auto;
    }
  }
  return Math.round(unit * (esNum(cant) && cant > 0 ? cant : 1));
}

// ── Dashboard ──
const enRango = (t, desde, hasta) => t >= desde && t < hasta;
const montoVenta = (v) => (v.pventa || 0) * (v.cant || 1);

// Ventas del período por medio de pago (cantidad de ventas y monto a precio de venta). No incluye planes de cuotas.
export function resumenPorMedio(ventas, desde, hasta) {
  const orden = [...MEDIOS, SIN_DATO];
  const filas = new Map(orden.map((m) => [m, { medio: m, n: 0, monto: 0, unidades: 0 }]));
  for (const v of ventas) {
    if (!enRango(v.fecha, desde, hasta)) continue;
    const f = filas.get(etiquetaMedio(v.medioPago));
    f.n++; f.monto += montoVenta(v); f.unidades += v.cant || 1;
  }
  const lista = orden.map((m) => filas.get(m));
  return { filas: lista, n: lista.reduce((a, f) => a + f.n, 0), monto: lista.reduce((a, f) => a + f.monto, 0) };
}

// Total para facturar = Transferencia (a precio de venta) + Tarjeta (lo cobrado con tarjeta). Efectivo y "Sin dato" no entran.
// Una venta Tarjeta sin cobradoTarjeta (no debería pasar) cuenta a precio de venta y se avisa en `tarjetaSinCobrado`.
export function totalParaFacturar(ventas, desde, hasta) {
  const t = { transferencia: { n: 0, monto: 0 }, tarjeta: { n: 0, cobrado: 0, aPrecioVenta: 0 }, tarjetaSinCobrado: 0, total: 0 };
  for (const v of ventas) {
    if (!enRango(v.fecha, desde, hasta)) continue;
    if (v.medioPago === 'Transferencia') { t.transferencia.n++; t.transferencia.monto += montoVenta(v); }
    else if (v.medioPago === 'Tarjeta') {
      t.tarjeta.n++; t.tarjeta.aPrecioVenta += montoVenta(v);
      if (esNum(v.cobradoTarjeta)) t.tarjeta.cobrado += v.cobradoTarjeta;
      else { t.tarjeta.cobrado += montoVenta(v); t.tarjetaSinCobrado++; }
    }
  }
  t.total = t.transferencia.monto + t.tarjeta.cobrado;
  return t;
}

// ── Carga rápida: datos del mensaje de WhatsApp de la tienda ──
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// "Forma de pago: Efectivo | Transferencia | Tarjeta (hasta 3 cuotas sin interés)" → medio, o null si no hay línea.
export function medioDelMensaje(texto) {
  const m = /forma\s+de\s+pago\s*:\s*([^\n]*)/i.exec(String(texto || ''));
  if (!m) return null;
  const p = sinTildes(m[1]);
  if (/^\s*efectivo/.test(p)) return 'Efectivo';
  if (/^\s*transferencia/.test(p)) return 'Transferencia';
  if (/^\s*tarjeta/.test(p)) return 'Tarjeta';
  return null;
}
// "Subtotal: $83.000" / "Subtotal (precio efectivo/transferencia): $65.000" → { monto, esDeEfectivo } o null.
export function subtotalDelMensaje(texto) {
  const m = /subtotal([^:\n]*):\s*\$?\s*([\d.,]+)/i.exec(String(texto || ''));
  if (!m) return null;
  const monto = Number(m[2].replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(monto) ? { monto, esDeEfectivo: /efectivo/i.test(m[1]) } : null;
}
