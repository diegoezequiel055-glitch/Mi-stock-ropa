import { state } from './state.js';
import { deleteField } from './firebase-config.js';
import { claveModelo } from './matching.js';
import { configPrecioTarjeta } from './precio-tarjeta.js';
import { MEDIOS, MEDIO_POR_DEFECTO, SIN_DATO, medioValido, cobradoTarjetaLinea, medioDelMensaje, subtotalDelMensaje } from './medio-pago.js';

// ══════════════════════════════════════════
// MEDIO DE PAGO — conexión con la pantalla (venta manual, edición de ventas y Carga rápida).
// Las cuentas están en medio-pago.js. Acá solo se leen los campos, se dibujan los selectores y se arman los
// campos extra que se suman a cada venta (medioPago y, con Tarjeta, cobradoTarjeta — informativo).
// ══════════════════════════════════════════
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cfg = () => configPrecioTarjeta(state.configSitio);
const filasDe = (p) => (p ? state.stockData.filter((f) => claveModelo(f) === claveModelo(p)) : []);

// Lo que paga el cliente por una línea con tarjeta. `p` = fila de stock del producto vendido.
function cobradoLinea({ p, pventa, cant, esMenor }) {
  return cobradoTarjetaLinea({ pventa, cant, esMenor, filas: filasDe(p), pventaStock: p?.pventa }, cfg());
}

// Campos que se suman a cada documento de ventas al guardarlo (guardarVentaItems los usa).
window.mpCamposVenta = function (item, p, medio) {
  const m = medioValido(medio) || MEDIO_POR_DEFECTO;
  const extra = { medioPago: m };
  if (m === 'Tarjeta') extra.cobradoTarjeta = cobradoLinea({ p, pventa: item.pventa, cant: item.cant, esMenor: item.tipoPrecio === 'menor' });
  return extra;
};

// ── Venta manual: selector (por defecto Transferencia) ──
function llenarSelect(sel, conSinDato) {
  if (!sel || sel.options.length) return;
  sel.innerHTML = (conSinDato ? `<option value="">${SIN_DATO}</option>` : '') + MEDIOS.map((m) => `<option value="${m}">${m}</option>`).join('');
}
window.mpIniciar = function () {
  llenarSelect($('uv-medio'), false); if ($('uv-medio')) $('uv-medio').value = MEDIO_POR_DEFECTO;
  llenarSelect($('ev-medio'), true);
};
window.mpMedioCarrito = () => ($('uv-medio')?.value) || MEDIO_POR_DEFECTO;
window.mpReiniciarCarrito = function () { if ($('uv-medio')) $('uv-medio').value = MEDIO_POR_DEFECTO; mpPreviewCarrito(); };
window.mpModoCobro = function (modo) { const w = $('uv-medio-wrap'); if (w) w.style.display = modo === 'cuotas' ? 'none' : ''; };
// Con Tarjeta: muestra cuánto paga el cliente (solo informativo; la venta se registra a precio de efectivo/transferencia)
window.mpPreviewCarrito = function () {
  const n = $('uv-medio-nota'); if (!n) return;
  if (window.mpMedioCarrito() !== 'Tarjeta' || !state.ventaCart?.length) { n.textContent = ''; return; }
  const total = state.ventaCart.reduce((a, it) => a + cobradoLinea({ p: state.stockData.find((x) => x.id === it.prodId), pventa: it.pventa, cant: it.cant, esMenor: it.tipoPrecio === 'menor' }), 0);
  const base = state.ventaCart.reduce((a, it) => a + (it.pventa || 0) * (it.cant || 1), 0);
  n.textContent = `El cliente paga $${fmt(total)} con tarjeta (informativo). La venta se registra a $${fmt(base)}.`;
};

// ── Editar una venta existente (incluidas las "sin dato") ──
window.mpMostrarEnEdicion = function (v) { llenarSelect($('ev-medio'), true); if ($('ev-medio')) $('ev-medio').value = medioValido(v.medioPago) || ''; };
// Devuelve los campos a cambiar. cobradoTarjeta se recalcula solo si pasa a Tarjeta o cambió el precio/cantidad de una venta con Tarjeta;
// si no, se respeta el que ya tenía (aunque la configuración haya cambiado después).
window.mpCambiosEdicion = function (v, { pventa, cant, medio }) {
  const cambios = {};
  const actual = medioValido(v.medioPago) || '';
  const nuevo = medioValido(medio) || '';
  if (nuevo !== actual) cambios.medioPago = nuevo || deleteField();
  if (nuevo === 'Tarjeta') {
    if (actual !== 'Tarjeta' || pventa !== v.pventa || cant !== v.cant || typeof v.cobradoTarjeta !== 'number') {
      const p = state.stockData.find((x) => x.id === v.prodId);
      cambios.cobradoTarjeta = cobradoLinea({ p, pventa, cant, esMenor: (v.tipo || 'minorista') === 'minorista' });
    }
  } else if (actual === 'Tarjeta') cambios.cobradoTarjeta = deleteField();
  return cambios;
};

// ── Carga rápida ──
// Después de interpretar el texto: preselecciona el medio según la línea "Forma de pago:" (si no hay, Transferencia)
// y guarda el "Subtotal" del mensaje para compararlo con lo calculado. Los precios del mensaje se siguen ignorando.
window.mpDesdeTexto = function (texto) {
  const c = state.cr; if (!c) return;
  c.medioPago = medioDelMensaje(texto) || MEDIO_POR_DEFECTO;
  c.medioDelTexto = medioDelMensaje(texto);
  c.subtotalMensaje = subtotalDelMensaje(texto);
  if (window.crRender) crRender(); // cargarResultado ya dibujó la pantalla antes de saber el medio: se redibuja
};
window.crSetMedio = function (m) { if (state.cr) { state.cr.medioPago = medioValido(m) || MEDIO_POR_DEFECTO; window.crRender && crRender(); } };
window.mpMedioCarga = () => medioValido(state.cr?.medioPago) || MEDIO_POR_DEFECTO;
// Bloque de la pantalla de confirmación (solo ventas). t = resultado de evaluarTodo() de carga-rapida.js.
window.mpCrHtml = function (c, t) {
  const medio = medioValido(c.medioPago) || MEDIO_POR_DEFECTO;
  const lab = 'font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px';
  let h = `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px"><span style="${lab}">Medio de pago:</span>${MEDIOS.map((m) => `<button class="date-btn${medio === m ? ' active' : ''}" onclick="crSetMedio('${m}')">${m}</button>`).join('')}</div>`;
  h += `<div style="font-size:.7rem;color:var(--muted);margin-top:4px">${c.medioDelTexto ? `Lo tomé de la línea "Forma de pago" del mensaje.` : 'El mensaje no trae "Forma de pago": usé Transferencia.'} La venta se registra al precio de stock.</div>`;
  if (medio === 'Tarjeta') {
    let cobrado = 0, completo = true;
    c.items.forEach((it, k) => {
      const e = t.ev[k]; if (!e || !e.fila || !e.precio) { completo = false; return; }
      cobrado += cobradoLinea({ p: e.fila, pventa: e.precio, cant: it.cantidad, esMenor: e.tipo === 'menor' });
    });
    h += `<div style="font-size:.78rem;color:var(--text2);margin-top:6px">💳 Cobrado con tarjeta (calculado): <b>$${fmt(cobrado)}</b> — solo informativo, no entra en ingresos ni ganancia.</div>`;
    const s = c.subtotalMensaje;
    if (completo && s) {
      if (s.monto !== cobrado) {
        h += `<div style="font-size:.78rem;color:var(--warning);margin-top:6px">⚠ El mensaje trae un Subtotal de $${fmt(s.monto)}${s.esDeEfectivo ? ' (a precio de efectivo/transferencia: con tarjeta el total quedaba "a confirmar")' : ''} y yo calculo $${fmt(cobrado)}. Revisá los precios de tarjeta antes de confirmar.</div>`;
      } else h += `<div style="font-size:.74rem;color:var(--success);margin-top:6px">✔ Coincide con el Subtotal del mensaje ($${fmt(s.monto)}).</div>`;
    }
  }
  return h;
};
window.mpIniciar();
