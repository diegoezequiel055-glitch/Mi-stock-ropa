import { state } from './state.js';
import { db, doc, setDoc } from './firebase-config.js';
import { REDONDEOS, configPrecioTarjeta, validarConfig, vistaPrevia } from './precio-tarjeta.js';

// ══════════════════════════════════════════
// PRECIO DE TARJETA — pantalla (Catálogo y sitio) y vista previa en la edición del producto.
// La lógica de cuentas está en precio-tarjeta.js; acá solo se leen/escriben los campos y se dibuja.
// Guarda en config_sitio/config (merge, sin tocar los demás campos): recargoTarjetaPct, redondeoTarjeta, mostrarPrecioTarjeta.
// ══════════════════════════════════════════
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');
const ETIQ_REDONDEO = { 0: 'Sin redondeo', 100: 'A múltiplos de $100 (hacia arriba)', 500: 'A múltiplos de $500 (hacia arriba)', 1000: 'A múltiplos de $1.000 (hacia arriba)' };

const cfgGuardada = () => configPrecioTarjeta(state.configSitio);

// Lo que hay escrito hoy en la pantalla (sin guardar). Si el porcentaje es inválido, usa el guardado para la vista previa.
function cfgEnPantalla() {
  const v = validarConfig({ pct: $('pt-pct')?.value, redondeo: $('pt-redondeo')?.value });
  const g = cfgGuardada();
  return { v, cfg: { pct: v.ok ? v.pct : g.pct, redondeo: v.ok ? v.redondeo : g.redondeo, mostrar: $('pt-mostrar')?.checked === true } };
}

// Hasta 3 productos reales del stock (solo lectura) para mostrar el cálculo: prefiere los del catálogo.
function ejemplos() {
  const con = state.stockData.filter((p) => p.pventa > 0);
  const vistos = new Set(), lista = [];
  for (const p of [...con.filter((x) => x.catalogo === true), ...con]) {
    const k = [p.cat, p.modelo, p.color].join('|');
    if (vistos.has(k)) continue;
    vistos.add(k); lista.push(p);
    if (lista.length === 3) break;
  }
  return lista;
}

const lineaPrecios = (p, cfg) => {
  const v = vistaPrevia(p.pventa, p.ptarjeta, cfg);
  return `<div style="display:flex;flex-direction:column;gap:2px;padding:7px 0;border-bottom:1px solid var(--border);font-size:.8rem">
    <span style="min-width:0;overflow-wrap:anywhere">${esc(p.modelo)}${p.color ? ' · ' + esc(p.color) : ''}</span>
    <span style="color:var(--text2);display:flex;gap:4px 14px;flex-wrap:wrap"><span style="white-space:nowrap">Efectivo/Transferencia: <b style="color:var(--text)">$${fmt(v.efectivo)}</b></span><span style="white-space:nowrap">Tarjeta: <b style="color:var(--accent)">${v.tarjeta ? '$' + fmt(v.tarjeta) : '—'}</b>${v.manual ? ' <em style="font-size:.68rem">(manual)</em>' : ''}</span></span>
  </div>`;
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

window.ptPreview = function () {
  const cont = $('pt-preview'); if (!cont) return;
  const { v, cfg } = cfgEnPantalla();
  const err = $('pt-error');
  if (err) err.textContent = v.ok ? '' : v.error;
  const ej = ejemplos();
  cont.innerHTML = ej.length
    ? ej.map((p) => lineaPrecios(p, cfg)).join('') + `<p style="font-size:.7rem;color:var(--muted);margin-top:8px">Ejemplo con 3 productos de tu stock (solo lectura). ${cfg.mostrar ? '' : 'El interruptor está apagado: la tienda todavía no muestra este precio.'}</p>`
    : '<p style="font-size:.78rem;color:var(--muted)">Todavía no hay productos con precio por menor para mostrar un ejemplo.</p>';
};

// Llena la pantalla con lo guardado (no pisa lo que se está escribiendo).
window.ptRender = function () {
  if (!$('pt-pct')) return;
  const g = cfgGuardada();
  if (document.activeElement !== $('pt-pct')) $('pt-pct').value = g.pct;
  const sel = $('pt-redondeo');
  if (sel && !sel.options.length) sel.innerHTML = REDONDEOS.map((r) => `<option value="${r}">${ETIQ_REDONDEO[r]}</option>`).join('');
  if (sel && document.activeElement !== sel) sel.value = String(g.redondeo);
  if ($('pt-mostrar') && document.activeElement !== $('pt-mostrar')) $('pt-mostrar').checked = g.mostrar;
  ptPreview();
};

window.ptGuardar = async function () {
  const { v, cfg } = cfgEnPantalla();
  const estado = $('pt-estado');
  if (!v.ok) { estado.style.color = 'var(--danger)'; estado.textContent = v.error + ' No se guardó nada.'; toast(v.error, 'error'); return; }
  const g = cfgGuardada();
  const cambios = [];
  if (v.pct !== g.pct) cambios.push(`recargo ${g.pct} % → ${v.pct} %`);
  if (v.redondeo !== g.redondeo) cambios.push(`redondeo: ${ETIQ_REDONDEO[v.redondeo].toLowerCase()}`);
  if (cfg.mostrar !== g.mostrar) cambios.push(cfg.mostrar ? 'ENCENDER el precio de tarjeta en la tienda' : 'APAGAR el precio de tarjeta en la tienda');
  const msg = cambios.length ? `Se va a guardar: ${cambios.join('; ')}.${cfg.mostrar ? ' La tienda pública mostrará el precio de tarjeta.' : ''}` : 'No hay cambios respecto de lo guardado.';
  const ok = await confirm2('Guardar precio de tarjeta', msg, 'Guardar', 'var(--accent)');
  if (!ok) return;
  const btn = $('pt-guardar-btn'); btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    await setDoc(doc(db, 'config_sitio', 'config'), { recargoTarjetaPct: v.pct, redondeoTarjeta: v.redondeo, mostrarPrecioTarjeta: cfg.mostrar }, { merge: true });
    estado.style.color = 'var(--success)';
    estado.textContent = cfg.mostrar ? 'Guardado ✓ — la tienda va a mostrar el precio de tarjeta.' : 'Guardado ✓ — el precio de tarjeta sigue sin mostrarse en la tienda.';
  } catch (e) { estado.style.color = 'var(--danger)'; estado.textContent = 'Error: ' + e.message; }
  finally { btn.disabled = false; btn.textContent = '💾 Guardar'; setTimeout(() => { if (estado) estado.textContent = ''; }, 6000); }
};

// Vista previa dentro de la edición del producto: usa la configuración GUARDADA y lo que se escribe en el formulario.
window.ptModalPreview = function () {
  const cont = $('pm-pt-preview'); if (!cont) return;
  const precio = parseFloat($('pm-pventa').value) || 0;
  const manualTxt = $('pm-ptarjeta').value;
  const manual = manualTxt === '' ? null : parseFloat(manualTxt);
  if (!(precio > 0)) { cont.innerHTML = 'Cargá el precio por menor para ver el precio de tarjeta.'; return; }
  const g = cfgGuardada();
  const v = vistaPrevia(precio, manual, g);
  const ignorado = manual != null && !v.manual ? '<br><span style="color:var(--warning)">El manual se ignora: tiene que ser mayor que el de efectivo. Se usa el automático.</span>' : '';
  cont.innerHTML = `Efectivo/Transferencia: <b style="color:var(--text)">$${fmt(precio)}</b> · Tarjeta: <b style="color:var(--accent)">${v.tarjeta ? '$' + fmt(v.tarjeta) : '—'}</b>${v.manual ? ' (manual)' : ` (automático: ${g.pct} %, ${g.redondeo ? 'hacia arriba a $' + fmt(g.redondeo) : 'sin redondeo'})`}${ignorado}${g.mostrar ? '' : '<br><span style="color:var(--muted)">Interruptor apagado: la tienda todavía no muestra el precio de tarjeta.</span>'}`;
};

// Lo llama config.js cada vez que llega config_sitio/config (o falla): marca la configuración como lista y, si cambió
// algo del precio de tarjeta, vuelve a armar el catálogo público. Solo se refresca ante cambios de estos 3 campos.
let ultima = null;
window.ptConfigCambio = function (listo = true) {
  if (listo) state.configListo = true;
  const g = cfgGuardada();
  const firma = [g.pct, g.redondeo, g.mostrar].join('|');
  if ((ultima === null || firma !== ultima) && window.catalogoRefresh) catalogoRefresh(); // la 1.ª vez asegura que haya una sincronización con la config ya leída
  ultima = firma;
};
