// ══════════════════════════════════════════
// PRECIO DE TARJETA — lógica pura (sin DOM ni Firestore). Precio de lista de la tienda: hasta 3 cuotas sin interés.
//
// El precio que se carga en Stock (pventa) es el de efectivo o transferencia y NO se toca. A partir de él:
//   • Si el producto tiene `ptarjeta` manual y es MAYOR que el precio de efectivo → se usa tal cual (sin recargo ni redondeo).
//   • Si no (vacío, o menor/igual al de efectivo → se ignora) → precio * (1 + pct/100), redondeado HACIA ARRIBA al múltiplo elegido.
//   • Solo hay precio de tarjeta si es mayor que el de efectivo (con 0 % no hay).
// Mayorista y curva no entran: esto es solo el precio por menor.
//
// Configuración (config_sitio/config, campos nuevos): recargoTarjetaPct, redondeoTarjeta, mostrarPrecioTarjeta.
// Con mostrarPrecioTarjeta apagado (por defecto) las fichas de catalogo_publico salen EXACTAMENTE como siempre.
// ══════════════════════════════════════════

export const REDONDEOS = [0, 100, 500, 1000]; // 0 = sin redondeo
export const POR_DEFECTO = { pct: 27, redondeo: 500, mostrar: false };

const esNumero = (n) => typeof n === 'number' && Number.isFinite(n);

// Lee la configuración guardada; lo que falte o sea inválido toma el valor por defecto. `mostrar` solo es true si es true.
export function configPrecioTarjeta(cfg) {
  const c = cfg || {};
  return {
    pct: esNumero(c.recargoTarjetaPct) && c.recargoTarjetaPct >= 0 && c.recargoTarjetaPct <= 100 ? c.recargoTarjetaPct : POR_DEFECTO.pct,
    redondeo: REDONDEOS.includes(c.redondeoTarjeta) ? c.redondeoTarjeta : POR_DEFECTO.redondeo,
    mostrar: c.mostrarPrecioTarjeta === true,
  };
}

// Valida lo que se escribe en la pantalla. pct puede venir como texto ("27", "27,5"). Devuelve { ok, error?, pct, redondeo }.
export function validarConfig({ pct, redondeo }) {
  const txt = String(pct ?? '').trim().replace(',', '.');
  const p = txt === '' ? NaN : Number(txt);
  if (!Number.isFinite(p)) return { ok: false, error: 'El porcentaje tiene que ser un número (por ejemplo 27).' };
  if (p < 0 || p > 100) return { ok: false, error: 'El porcentaje tiene que estar entre 0 y 100.' };
  const r = Number(redondeo);
  if (!REDONDEOS.includes(r)) return { ok: false, error: 'Elegí una opción de redondeo de la lista.' };
  return { ok: true, pct: p, redondeo: r };
}

// precio * (1 + pct/100) redondeado hacia arriba al múltiplo `redondeo` (0 = sin redondeo, al peso entero hacia arriba).
// Se redondea a 6 decimales antes del techo para que un múltiplo exacto no suba por error de coma flotante.
export function calcularPrecioTarjeta(precio, pct, redondeo) {
  if (!esNumero(precio) || precio <= 0) return null;
  const bruto = Math.round(precio * (100 + pct) / 100 * 1e6) / 1e6;
  const paso = redondeo > 0 ? redondeo : 1;
  return Math.ceil(Math.round(bruto / paso * 1e6) / 1e6) * paso;
}

// ¿El manual sirve? Tiene que ser un número mayor que el precio de efectivo.
export const ptarjetaValido = (ptarjeta, precio) => esNumero(ptarjeta) && ptarjeta > 0 && esNumero(precio) && ptarjeta > precio;

// Precio de tarjeta de UN producto. `filas` = filas de stock (talles) del modelo; `precio` = el precio de efectivo de la ficha.
// Varias filas con ptarjeta: se usa el de la fila de MENOR precio de efectivo entre las que tienen un manual válido
// (si hay empate, la primera). Devuelve { valor, manual } o { valor: null }.
export function resolverPrecioTarjeta(filas, precio, config) {
  if (!esNumero(precio) || precio <= 0) return { valor: null, manual: false };
  const candidatas = (filas || []).filter((f) => ptarjetaValido(f.ptarjeta, precio));
  if (candidatas.length) {
    const f = candidatas.reduce((mejor, x) => ((x.pventa || Infinity) < (mejor.pventa || Infinity) ? x : mejor));
    return { valor: f.ptarjeta, manual: true };
  }
  const auto = calcularPrecioTarjeta(precio, config.pct, config.redondeo);
  return auto > precio ? { valor: auto, manual: false } : { valor: null, manual: false };
}

// Para catalogoSync: devuelve la ficha tal cual si el interruptor está apagado; si está encendido, le suma precioTarjeta
// (solo cuando es mayor que precio). No toca ningún otro campo.
export function conPrecioTarjeta(ficha, filas, config) {
  if (!config || !config.mostrar) return ficha;
  const { valor } = resolverPrecioTarjeta(filas, ficha.precio, config);
  return valor ? { ...ficha, precioTarjeta: valor } : ficha;
}

// Vista previa de un precio: { efectivo, tarjeta, manual } (tarjeta = null si no corresponde).
export function vistaPrevia(precio, ptarjetaManual, config) {
  const r = resolverPrecioTarjeta([{ pventa: precio, ptarjeta: ptarjetaManual }], precio, config);
  return { efectivo: precio, tarjeta: r.valor, manual: r.manual };
}
