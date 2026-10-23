// ══════════════════════════════════════════
// PRECIO EN OFERTA — lógica pura (sin DOM ni Firestore). Se prueba con `node test-ofertas.mjs`.
//
// Cada fila de stock (talle) puede tener `poferta`: el precio en oferta, en los MISMOS términos que `pventa` (efectivo o
// transferencia). Se carga para todo el producto (todas las filas de categoría | modelo | color), igual que el precio.
// Vacío / null = sin oferta. Una oferta solo vale si es un número > 0 y MENOR que el precio normal.
//
// A la tienda viaja (dentro de la ficha de catalogo_publico y del documento único config_sitio/catalogo; sin colecciones
// nuevas, sin lecturas extra):
//   precioOferta          → el precio en oferta (efectivo o transferencia)
//   precioOfertaTarjeta   → su precio de lista con tarjeta (mismo recargo y redondeo que el precio normal; solo si el
//                           interruptor "Mostrar precio de tarjeta" está encendido y queda más caro que el de efectivo)
// `precio` y `precioTarjeta` siguen siendo los NORMALES: la tienda (ofertas.js) arma el precio tachado con ellos y el
// porcentaje de la etiqueta con precio vs. precioOferta. Un producto sin esos campos se ve como siempre.
// El precio de tarjeta manual (`ptarjeta`) es del precio normal: la oferta siempre usa el cálculo automático.
// ══════════════════════════════════════════
import { calcularPrecioTarjeta } from './precio-tarjeta.js';

const esNumero = (n) => typeof n === 'number' && Number.isFinite(n);

// ¿Sirve como oferta de un producto con este precio normal? (número > 0 y menor que el normal)
export const ofertaValida = (oferta, precio) => esNumero(oferta) && oferta > 0 && esNumero(precio) && precio > 0 && oferta < precio;

// Lo que se escribe en el campo ("25000", "25.000"). Vacío = sin oferta (ok, vacio). Solo enteros > 0 y menores al precio normal.
export function validarOferta(texto, precioNormal) {
  const t = String(texto ?? '').trim().replace(/[.\s]/g, '');
  if (t === '') return { ok: true, vacio: true, valor: null };
  if (!/^\d+$/.test(t)) return { ok: false, error: 'El precio en oferta tiene que ser un número entero, sin letras ni decimales.' };
  const valor = Number(t);
  if (!Number.isSafeInteger(valor) || valor <= 0) return { ok: false, error: 'El precio en oferta tiene que ser mayor a 0.' };
  if (!(precioNormal > 0)) return { ok: false, error: 'Primero cargá el precio normal del producto.' };
  if (valor >= precioNormal) return { ok: false, error: `El precio en oferta tiene que ser menor que el precio normal ($${Number(precioNormal).toLocaleString('es-AR')}).` };
  return { ok: true, vacio: false, valor };
}

// Oferta actual del producto = la de la primera fila que tiene `poferta` válido (>0). `variasOfertas` avisa si los talles no coinciden.
export function ofertaActual(filas) {
  const con = (filas || []).filter((f) => esNumero(f.poferta) && f.poferta > 0);
  const valor = con.length ? con[0].poferta : null;
  return { valor, variasOfertas: con.some((f) => f.poferta !== valor) || (con.length > 0 && con.length < (filas || []).length) };
}

// Qué se escribiría: una entrada por fila cuyo `poferta` realmente cambia (nuevo = null quita la oferta). `pofertaAntes` sirve para Deshacer.
export function planOferta(filas, nuevo) {
  const cambios = [];
  for (const f of filas || []) {
    const antes = esNumero(f.poferta) && f.poferta > 0 ? f.poferta : null;
    if (antes !== (nuevo ?? null)) cambios.push({ id: f.id, talle: f.talle, pofertaAntes: antes });
  }
  return cambios;
}
export const camposOferta = (nuevo) => ({ poferta: nuevo ?? null });
export const camposDeshacerOferta = (c) => ({ poferta: c.pofertaAntes });

// Porcentaje de la etiqueta de la tienda: precio normal vs. oferta, ambos de efectivo/transferencia, redondeado al entero.
export const porcentajeOferta = (precio, oferta) => (ofertaValida(oferta, precio) ? Math.round((1 - oferta / precio) * 100) : 0);

// Para catalogoSync (armarFicha): suma precioOferta (y precioOfertaTarjeta) a la ficha si el producto tiene una oferta válida.
// Sin oferta, o con una oferta que ya no es menor que el precio normal: devuelve la ficha tal cual (el campo desaparece solo).
export function conOferta(ficha, filas, config) {
  const { valor } = ofertaActual(filas);
  if (!ofertaValida(valor, ficha.precio)) return ficha;
  const salida = { ...ficha, precioOferta: valor };
  if (config && config.mostrar) {
    const t = calcularPrecioTarjeta(valor, config.pct, config.redondeo);
    if (t > valor) salida.precioOfertaTarjeta = t;
  }
  return salida;
}

// Vista previa en vivo en la pantalla de carga: { pct, tarjeta, cuota } (tarjeta/cuota = null si no corresponde).
export function vistaPreviaOferta(precio, oferta, config) {
  if (!ofertaValida(oferta, precio)) return null;
  const t = config ? calcularPrecioTarjeta(oferta, config.pct, config.redondeo) : null;
  const tarjeta = t > oferta ? t : null;
  return { pct: porcentajeOferta(precio, oferta), tarjeta, cuota: tarjeta ? Math.round(tarjeta / 3) : null };
}
